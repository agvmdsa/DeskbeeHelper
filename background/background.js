// background.js — runs batch jobs (book / cancel) so they survive the popup closing.
// Progress is written to chrome.storage.local "job"; the popup only renders it.
import { getEffectiveOptions } from "../config/constants.js";
import { createBooking, deleteBooking, updateBooking, checkinBooking, checkoutBooking } from "../lib/api.js";
import { toDeskbeeDate } from "../lib/planner.js";
import { checkForUpdate } from "../lib/update.js";

const DELAY_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = false;

async function saveJob(job) {
  job.updatedAt = Date.now();
  await chrome.storage.local.set({ job });
}

async function bookOne(token, opts, item) {
  let lastError;
  for (const desk of item.desks) {
    try {
      await createBooking(token, opts, {
        placeUuid: desk.uuid,
        date: toDeskbeeDate(item.date),
        startTime: item.startTime,
        endTime: item.endTime,
      });
      return { ok: true, desk: desk.number };
    } catch (e) {
      if (e.message === "Unauthorized") throw e;
      lastError = { desk: desk.number, error: e.message };
      await sleep(DELAY_MS);
    }
  }
  return { ok: false, ...lastError };
}

async function cancelOne(token, opts, item) {
  try {
    await deleteBooking(token, opts, item.uuid);
    return { ok: true };
  } catch (e) {
    if (e.message === "Unauthorized") throw e;
    return { ok: false, error: e.message };
  }
}

async function editOne(token, opts, item) {
  try {
    await updateBooking(token, opts, item.uuid, {
      placeUuid: item.placeUuid,
      date: toDeskbeeDate(item.date),
      startTime: item.startTime,
      endTime: item.endTime,
    });
    return { ok: true, desk: item.deskNumber };
  } catch (e) {
    if (e.message === "Unauthorized") throw e;
    return { ok: false, desk: item.deskNumber, error: e.message };
  }
}

async function checkOne(action, token, opts, item) {
  try {
    if (action === "checkin") await checkinBooking(token, opts, { placeUuid: item.placeUuid, bookingUuid: item.uuid });
    else await checkoutBooking(token, opts, item.uuid);
    return { ok: true };
  } catch (e) {
    if (e.message === "Unauthorized") throw e;
    return { ok: false, error: e.message };
  }
}

const RUNNERS = {
  book: bookOne,
  cancel: cancelOne,
  edit: editOne,
  checkin: (...args) => checkOne("checkin", ...args),
  checkout: (...args) => checkOne("checkout", ...args),
};

async function runJob(kind, items) {
  running = true;
  const job = {
    kind,
    running: true,
    total: items.length,
    done: 0,
    results: [],
    startedAt: Date.now(),
  };
  await saveJob(job);

  try {
    const { authToken } = await chrome.storage.local.get(["authToken"]);
    const opts = await getEffectiveOptions();
    if (!authToken) throw new Error("Unauthorized");

    for (const item of items) {
      job.current = item.label;
      await saveJob(job);

      const result = await RUNNERS[kind](authToken, opts, item);
      job.results.push({ label: item.label, ...result });
      job.done++;
      await saveJob(job);
      await sleep(DELAY_MS);
    }
  } catch (e) {
    // UI translates errorCode; other errors are the server's own message
    if (e.message === "Unauthorized") job.errorCode = "job_session_expired";
    else job.error = e.message;
  } finally {
    job.running = false;
    job.current = null;
    job.finishedAt = Date.now();
    await saveJob(job);
    running = false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "start-job") return;
  if (running) {
    sendResponse({ ok: false, errorCode: "job_busy" });
    return;
  }
  if (!Object.hasOwn(RUNNERS, msg.kind) || !Array.isArray(msg.items) || !msg.items.length) {
    sendResponse({ ok: false, errorCode: "job_empty" });
    return;
  }
  runJob(msg.kind, msg.items);
  sendResponse({ ok: true });
});

// If the worker was killed mid-job, don't leave the UI stuck on "running".
chrome.runtime.onStartup.addListener(async () => {
  const { job } = await chrome.storage.local.get(["job"]);
  if (job?.running) {
    await saveJob({ ...job, running: false, errorCode: "job_interrupted" });
  }
});

// ---------- update check (daily) ----------

const UPDATE_ALARM = "update-check";

function scheduleUpdateCheck() {
  chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: 1, periodInMinutes: 24 * 60 });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleUpdateCheck();
  checkForUpdate({ force: true }).catch(() => {});
});
chrome.runtime.onStartup.addListener(scheduleUpdateCheck);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) checkForUpdate().catch(() => {});
});
