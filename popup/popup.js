// popup.js — UI only. Batch work runs in background.js; this file renders its progress.
import { getEffectiveOptions } from "../config/constants.js";
import { listMyBookings, fetchDeskMap } from "../lib/api.js";
import { t, locale, weekdayName, applyI18n, setupLangSwitch } from "../lib/i18n.js";
import { checkForUpdate } from "../lib/update.js";
import {
  toISODate,
  parseISODate,
  addDaysISO,
  deskNumberOf,
  parseDeskList,
  bookingDateISO,
  bookingDeskNumber,
  buildBookingPlan,
  filterBookings,
  isCancellable,
  floorFromBookings,
  jwtExpiry,
  timeForDay,
  validateSchedule,
  bookingTimeRange,
  buildEditPlan,
} from "../lib/planner.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const STALE_JOB_MS = 60_000;
const X_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const DEFAULT_MAX_DAYS_AHEAD = 30;
const PENCIL_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>';

async function getMaxDaysAhead() {
  const { settings = {} } = await chrome.storage.local.get(["settings"]);
  const n = settings.maxDaysAhead ?? DEFAULT_MAX_DAYS_AHEAD;
  return Number(n) > 0 ? Number(n) : 0; // 0 = no limit
}

const state = {
  opts: null,
  deskMap: {},
  bookings: [],
  selected: new Set(),
  jobRunning: false,
  exceptions: [], // [{ day: 0-6, startTime, endTime }] — per-weekday time overrides
};

// ---------- small helpers ----------

function fmtDay(iso) {
  const d = parseISODate(iso);
  const day = d.toLocaleDateString(locale(), { day: "2-digit", month: "short" }).replace(".", "");
  return `${weekdayName(d.getDay())} ${day}`;
}

function bookingLabel(b) {
  const iso = bookingDateISO(b);
  return t("label_desk", { day: iso ? fmtDay(iso) : "?", desk: bookingDeskNumber(b) || "?" });
}

function renderWeekdayPickers() {
  document.querySelectorAll(".weekday-picker").forEach((el) => {
    const name = el.dataset.name;
    el.innerHTML = WEEKDAY_ORDER.map(
      (v) => `
        <label class="weekday-toggle">
          <input type="checkbox" name="${name}" value="${v}" ${DEFAULT_WEEKDAYS.includes(v) ? "checked" : ""} />
          <span>${weekdayName(v)}</span>
        </label>`,
    ).join("");
  });
}

const getWeekdays = (name) =>
  [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((cb) => Number(cb.value));

function setWeekdays(name, days) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((cb) => {
    cb.checked = days.includes(Number(cb.value));
  });
}

function errorBox(html) {
  return `<div class="error-box">${html}</div>`;
}

// ---------- My Reserves ----------

function renderBookings() {
  const container = $("reserves");
  const list = [...state.bookings].sort((a, b) =>
    String(a.start_date).localeCompare(String(b.start_date)),
  );

  if (!list.length) {
    container.innerHTML = `<div class="no-data">${t("no_reserves")}</div>`;
    updateCancelButton();
    return;
  }

  container.innerHTML =
    '<div class="booking-list">' +
    list
      .map((b) => {
        const iso = bookingDateISO(b);
        const d = iso ? parseISODate(iso) : null;
        const toTime = (v) => {
          const t = new Date(String(v || "").replace(" ", "T"));
          return Number.isNaN(t.getTime())
            ? ""
            : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        };
        const time = [toTime(b.start_date), toTime(b.end_date)].filter(Boolean).join("–");
        const status = b.status?.name || "reserved";
        const statusLabel = t(`status_${status.toLowerCase()}`);
        const statusText = statusLabel.startsWith("status_") ? status : statusLabel;
        const can = isCancellable(b);
        const uuid = esc(b.uuid);
        const sel = state.selected.has(b.uuid);
        const fullName = b.place?.name_display || b.place?.name || t("unknown_desk");
        const num = bookingDeskNumber(b);
        const dateText = iso ? fmtDay(iso) : "?";
        return `
          <div class="booking-item ${sel ? "selected" : ""}">
            <input type="checkbox" class="row-check" data-uuid="${uuid}" aria-label="${esc(t("select_x", { x: bookingLabel(b) }))}"
              ${sel ? "checked" : ""} ${can ? "" : "disabled"} />
            <div class="booking-main">
              <span class="booking-date">${esc(dateText)}</span>
              <span class="booking-info" title="${esc(fullName)}">${num ? esc(t("desk_n", { n: num })) : esc(fullName)}</span>
            </div>
            <div class="booking-meta">
              <span class="booking-time">${esc(time)}</span>
              <span class="status-badge status-${esc(status.toLowerCase())}">${esc(statusText)}</span>
            </div>
            <div class="row-actions">
              <button type="button" class="row-edit" data-uuid="${uuid}" title="${esc(t("edit_this"))}"
                aria-label="${esc(t("edit_x", { x: bookingLabel(b) }))}" ${can ? "" : "disabled"}>${PENCIL_ICON}</button>
              <button type="button" class="row-cancel" data-uuid="${uuid}" title="${esc(t("cancel_this"))}"
                aria-label="${esc(t("cancel_x", { x: bookingLabel(b) }))}" ${can ? "" : "disabled"}>${X_ICON}</button>
            </div>
          </div>`;
      })
      .join("") +
    "</div>";
  updateCancelButton();
}

function updateCancelButton() {
  const n = state.selected.size;
  const btn = $("cancel-selected");
  btn.textContent = t("cancel_selected", { n });
  btn.disabled = n === 0 || state.jobRunning;
  const editBtn = $("edit-selected");
  editBtn.textContent = t("edit_selected", { n });
  editBtn.disabled = n === 0 || state.jobRunning;

  const cancellable = state.bookings.filter(isCancellable);
  const all = $("select-all");
  all.checked = cancellable.length > 0 && cancellable.every((b) => state.selected.has(b.uuid));
  all.indeterminate = n > 0 && !all.checked;
}

function confirmCancel(items) {
  const status = $("list-status");
  status.innerHTML = `
    <div class="confirm-box">
      <div><strong>${esc(t("cancel_n_question", { n: items.length }))}</strong></div>
      <ul class="plan-list">${items.map((i) => `<li>${esc(i.label)}</li>`).join("")}</ul>
      <div class="button-row">
        <button type="button" class="danger" id="confirm-cancel">${t("yes_cancel")}</button>
        <button type="button" class="ghost" id="back-cancel">${t("back")}</button>
      </div>
    </div>`;
  $("back-cancel").onclick = () => (status.innerHTML = "");
  $("confirm-cancel").onclick = () => startJob("cancel", items);
}

// ---------- Edit (individual or batch) ----------

const selectedBookings = () =>
  state.bookings
    .filter((b) => state.selected.has(b.uuid))
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

function openEditPanel(list, values) {
  const single = list.length === 1;
  const cur = single ? bookingTimeRange(list[0]) : null;
  const v = values || {
    startTime: cur?.startTime || "",
    endTime: cur?.endTime || "",
    desk: single ? bookingDeskNumber(list[0]) : "",
  };
  const status = $("list-status");
  status.innerHTML = `
    <div class="confirm-box">
      <div><strong>${esc(single ? t("edit_title_one") : t("edit_title_n", { n: list.length }))}</strong>
        ${single ? `· ${esc(bookingLabel(list[0]))}` : ""}</div>
      <div class="form-row">
        <div class="form-group">
          <label for="edit-start">${esc(t("edit_start"))}</label>
          <input type="time" id="edit-start" value="${esc(v.startTime)}" />
        </div>
        <div class="form-group">
          <label for="edit-end">${esc(t("edit_end"))}</label>
          <input type="time" id="edit-end" value="${esc(v.endTime)}" />
        </div>
        <div class="form-group narrow">
          <label for="edit-desk">${esc(t("edit_desk"))}</label>
          <input type="text" id="edit-desk" value="${esc(v.desk)}" placeholder="${esc(t("edit_keep"))}" />
        </div>
      </div>
      ${single ? "" : `<small>${esc(t("edit_batch_hint"))}</small>`}
      <div class="button-row">
        <button type="button" id="review-edit">${esc(t("review"))}</button>
        <button type="button" class="ghost" id="close-edit">${esc(t("back"))}</button>
      </div>
    </div>`;
  $("close-edit").onclick = () => (status.innerHTML = "");
  $("review-edit").onclick = () =>
    reviewEdit(list, {
      startTime: $("edit-start").value,
      endTime: $("edit-end").value,
      desk: $("edit-desk").value.trim(),
    });
}

function reviewEdit(list, changes) {
  const status = $("list-status");
  const plan = buildEditPlan({
    bookings: list,
    changes,
    deskMap: state.deskMap,
    today: toISODate(new Date()),
  });
  const toEdit = plan.filter((p) => p.action === "edit");
  const byUuid = new Map(list.map((b) => [b.uuid, b]));
  const rangeText = (r) => (r ? `${r.startTime}–${r.endTime}` : "?");

  const line = (p) => {
    const b = byUuid.get(p.uuid);
    const day = esc(p.date ? fmtDay(p.date) : "?");
    const tag = `<span class="tag ${p.action === "edit" ? "tag-book" : "tag-skip"}">${esc(t(`tag_${p.action}`))}</span>`;
    if (p.action !== "edit") return `<li>${tag} <span class="plan-day">${day}</span></li>`;
    const before = bookingTimeRange(b);
    const oldDesk = bookingDeskNumber(b);
    const parts = [
      `${esc(rangeText(before))} → ${esc(rangeText(p))}`,
      p.deskNumber !== oldDesk ? esc(`${t("desk_n", { n: oldDesk })} → ${t("desk_n", { n: p.deskNumber })}`) : "",
    ].filter(Boolean);
    return `<li>${tag} <span class="plan-day">${day}</span> <small>${parts.join(" · ")}</small></li>`;
  };

  status.innerHTML = `
    <div class="confirm-box">
      <div><strong>${esc(t("edit_n_question", { n: toEdit.length }))}</strong></div>
      <ul class="plan-list">${plan.map(line).join("")}</ul>
      <small>${esc(t("edit_emails_notice"))}</small>
      <div class="button-row">
        <button type="button" id="confirm-edit" ${toEdit.length ? "" : "disabled"}>${esc(t("confirm"))}</button>
        <button type="button" class="ghost" id="back-edit">${esc(t("back"))}</button>
      </div>
    </div>`;
  $("back-edit").onclick = () => openEditPanel(list, changes);
  $("confirm-edit").onclick = () =>
    startJob(
      "edit",
      toEdit.map((p) => ({
        uuid: p.uuid,
        date: p.date,
        placeUuid: p.placeUuid,
        deskNumber: p.deskNumber,
        startTime: p.startTime,
        endTime: p.endTime,
        label: bookingLabel(byUuid.get(p.uuid)),
      })),
    );
}

function setupListTab() {
  const container = $("reserves");

  container.addEventListener("change", (e) => {
    const cb = e.target.closest(".row-check");
    if (!cb) return;
    if (cb.checked) state.selected.add(cb.dataset.uuid);
    else state.selected.delete(cb.dataset.uuid);
    cb.closest(".booking-item").classList.toggle("selected", cb.checked);
    updateCancelButton();
  });

  container.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".row-edit");
    if (editBtn && !editBtn.disabled && !state.jobRunning) {
      const booking = state.bookings.find((b) => b.uuid === editBtn.dataset.uuid);
      if (booking) openEditPanel([booking]);
      return;
    }
    const btn = e.target.closest(".row-cancel");
    if (!btn || btn.disabled || state.jobRunning) return;
    const booking = state.bookings.find((b) => b.uuid === btn.dataset.uuid);
    if (!booking) return;

    if (btn.dataset.armed) {
      startJob("cancel", [{ uuid: booking.uuid, label: bookingLabel(booking) }]);
      return;
    }
    btn.dataset.armed = "1";
    btn.textContent = t("cancel_confirm_short");
    btn.classList.add("armed");
    setTimeout(() => {
      delete btn.dataset.armed;
      btn.innerHTML = X_ICON;
      btn.classList.remove("armed");
    }, 3000);
  });

  $("select-all").addEventListener("change", (e) => {
    state.selected = e.target.checked
      ? new Set(state.bookings.filter(isCancellable).map((b) => b.uuid))
      : new Set();
    renderBookings();
  });

  $("toggle-filter").addEventListener("click", () => {
    $("filter-panel").hidden = !$("filter-panel").hidden;
  });

  $("apply-filter").addEventListener("click", () => {
    const matches = filterBookings(state.bookings, {
      start: $("filter-start").value || undefined,
      end: $("filter-end").value || undefined,
      weekdays: getWeekdays("filter-weekday"),
      desk: $("filter-desk").value.trim() || undefined,
    });
    state.selected = new Set(matches.map((b) => b.uuid));
    renderBookings();
    $("list-status").innerHTML = `<div class="hint-box">${esc(t("n_selected_hint", { n: matches.length }))}</div>`;
  });

  $("edit-selected").addEventListener("click", () => {
    const list = selectedBookings();
    if (list.length) openEditPanel(list);
  });

  $("cancel-selected").addEventListener("click", () => {
    const items = state.bookings
      .filter((b) => state.selected.has(b.uuid))
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
      .map((b) => ({ uuid: b.uuid, label: bookingLabel(b) }));
    if (items.length) confirmCancel(items);
  });
}

// ---------- New Booking ----------

function updateDeskLookup() {
  const status = $("desk-lookup-status");
  status.className = "";

  if (!state.opts?.plantId) {
    status.textContent = t("floor_unknown");
    status.className = "text-error";
    return;
  }
  if (!Object.keys(state.deskMap).length) {
    status.textContent = t("loading_map");
    return;
  }

  const primary = $("desk-number").value.trim();
  const unknown = parseDeskList($("secondary-desks").value).filter((d) => !state.deskMap[d]);

  if (!primary) {
    status.textContent = t("enter_desk");
  } else if (!state.deskMap[primary]) {
    status.textContent = t("desk_not_found", { desk: primary });
    status.className = "text-error";
  } else if (unknown.length) {
    status.textContent = t("desk_found_but", { list: unknown.join(", ") });
    status.className = "text-error";
  } else {
    status.textContent = t("desk_found");
    status.className = "text-success";
  }
}

// ---------- Schedule: default time + per-day exceptions ----------

const defaultTime = () => ({ startTime: $("start-time").value, endTime: $("end-time").value });
const fmtRange = (t) => `${t.startTime}–${t.endTime}`;

function currentSchedule() {
  return { defaultTime: defaultTime(), weekdays: getWeekdays("weekday"), exceptions: state.exceptions };
}

function renderExceptions() {
  const selected = getWeekdays("weekday");
  const order = WEEKDAY_ORDER;
  $("time-exceptions").innerHTML = state.exceptions
    .map((ex, i) => {
      const days = order.filter((d) => selected.includes(d) || d === ex.day);
      return `
        <div class="time-row exception-row" data-index="${i}">
          <select class="ex-day" aria-label="${esc(t("day_with_different_time"))}">
            ${days.map((d) => `<option value="${d}" ${d === ex.day ? "selected" : ""}>${weekdayName(d)}</option>`).join("")}
          </select>
          <input type="time" class="ex-start" value="${esc(ex.startTime)}" aria-label="${esc(t("checkin_of", { day: weekdayName(ex.day) }))}" />
          <span class="time-sep" aria-hidden="true">–</span>
          <input type="time" class="ex-end" value="${esc(ex.endTime)}" aria-label="${esc(t("checkout_of", { day: weekdayName(ex.day) }))}" />
          <button type="button" class="icon-btn ex-remove" aria-label="${esc(t("remove_time_of", { day: weekdayName(ex.day) }))}" title="${esc(t("remove"))}">${X_ICON}</button>
        </div>`;
    })
    .join("");
  validateScheduleUI();
}

const scheduleErrorText = (e) => t(`sched_${e.code}`, { day: weekdayName(e.day) });

function validateScheduleUI() {
  const errors = validateSchedule(currentSchedule());
  $("schedule-status").textContent = errors.length ? scheduleErrorText(errors[0]) : "";
  const selected = new Set(getWeekdays("weekday"));
  document.querySelectorAll(".exception-row").forEach((row) => {
    const ex = state.exceptions[Number(row.dataset.index)];
    const dup = state.exceptions.filter((e) => e.day === ex.day).length > 1;
    row.classList.toggle("invalid", !(ex.endTime > ex.startTime) || dup || !selected.has(ex.day));
  });
  const used = new Set(state.exceptions.map((e) => e.day));
  $("add-exception").disabled = !getWeekdays("weekday").some((d) => !used.has(d));
  return errors;
}

function setupSchedule() {
  $("add-exception").addEventListener("click", () => {
    const used = new Set(state.exceptions.map((e) => e.day));
    // Friday first (the common case), then the latest free selected day
    const free = [5, 4, 3, 2, 1, 6, 0].filter((d) => getWeekdays("weekday").includes(d) && !used.has(d));
    if (!free.length) return;
    state.exceptions.push({ day: free[0], ...defaultTime() });
    renderExceptions();
    document.querySelector(".exception-row:last-child .ex-start")?.focus();
  });

  const box = $("time-exceptions");
  box.addEventListener("input", (e) => {
    const row = e.target.closest(".exception-row");
    if (!row) return;
    const ex = state.exceptions[Number(row.dataset.index)];
    if (e.target.classList.contains("ex-start")) ex.startTime = e.target.value;
    if (e.target.classList.contains("ex-end")) ex.endTime = e.target.value;
    validateScheduleUI();
  });
  box.addEventListener("change", (e) => {
    if (!e.target.classList.contains("ex-day")) return;
    state.exceptions[Number(e.target.closest(".exception-row").dataset.index)].day = Number(e.target.value);
    renderExceptions();
  });
  box.addEventListener("click", (e) => {
    const btn = e.target.closest(".ex-remove");
    if (!btn) return;
    state.exceptions.splice(Number(btn.closest(".exception-row").dataset.index), 1);
    renderExceptions();
  });

  $("start-time").addEventListener("input", validateScheduleUI);
  $("end-time").addEventListener("input", validateScheduleUI);
  document.querySelector('.weekday-picker[data-name="weekday"]').addEventListener("change", renderExceptions);
}

async function preview() {
  const statusDiv = $("booking-status");
  const primary = $("desk-number").value.trim();
  const start = $("start-date").value;
  const end = $("end-date").value;
  const weekdays = getWeekdays("weekday");
  const schedule = currentSchedule();

  if (!state.deskMap[primary]) {
    statusDiv.innerHTML = errorBox(esc(t("pick_desk")));
    return;
  }
  if (!weekdays.length) {
    statusDiv.innerHTML = errorBox(esc(t("pick_weekday")));
    return;
  }
  if (end < start) {
    statusDiv.innerHTML = errorBox(esc(t("end_after_start")));
    return;
  }
  const scheduleErrors = validateSchedule(schedule);
  if (scheduleErrors.length) {
    statusDiv.innerHTML = errorBox(scheduleErrors.map((e) => esc(scheduleErrorText(e))).join("<br>"));
    return;
  }

  const desks = [primary, ...parseDeskList($("secondary-desks").value).filter((d) => d !== primary)]
    .filter((d) => state.deskMap[d])
    .map((number) => ({ number, uuid: state.deskMap[number] }));

  statusDiv.innerHTML = `<div class="loading">${t("building_preview")}</div>`;

  const bookedDates = $("skip-booked").checked
    ? new Set(state.bookings.filter(isCancellable).map(bookingDateISO).filter(Boolean))
    : new Set();

  const today = toISODate(new Date());
  const maxDaysAhead = await getMaxDaysAhead();
  const plan = buildBookingPlan({ start, end, weekdays, bookedDates, today, maxDaysAhead });
  const toBook = plan
    .filter((p) => p.action === "book")
    .map((p) => ({ ...p, time: timeForDay(p.date, schedule.defaultTime, schedule.exceptions) }));
  const timeOf = new Map(toBook.map((p) => [p.date, p.time]));
  const isException = (iso) => schedule.exceptions.some((e) => e.day === parseISODate(iso).getDay());
  const timeSummary = [
    fmtRange(schedule.defaultTime),
    ...schedule.exceptions.map((e) => `${weekdayName(e.day)} ${fmtRange(e)}`),
  ].join(" · ");

  const badge = (action) => `<span class="tag ${action === "book" ? "tag-book" : "tag-skip"}">${esc(t(`tag_${action}`))}</span>`;

  statusDiv.innerHTML = `
    <div class="confirm-box">
      <div><strong>${esc(t("n_bookings", { n: toBook.length }))}</strong>
        · ${t("desk_lower")} ${esc(desks.map((d) => d.number).join(" → "))} · ${esc(timeSummary)}</div>
      ${
        plan.length
          ? `<ul class="plan-list">${plan
              .map((p) => {
                const t = timeOf.get(p.date);
                const time = t
                  ? ` <span class="plan-time ${isException(p.date) ? "is-exception" : ""}">${esc(fmtRange(t))}</span>`
                  : "";
                return `<li>${badge(p.action)} <span class="plan-day">${esc(fmtDay(p.date))}</span>${time}${
                  p.action === "skip-too-far"
                    ? ` <small>${esc(t("too_far_reason", { n: maxDaysAhead }))}</small>`
                    : p.reason
                      ? ` <small>${esc(p.reason)}</small>`
                      : ""
                }</li>`;
              })
              .join("")}</ul>`
          : `<div class="no-data">${t("no_days")}</div>`
      }
      <div class="button-row">
        <button type="button" id="confirm-booking" ${toBook.length ? "" : "disabled"}>${t("confirm")}</button>
        <button type="button" class="ghost" id="back-booking">${t("back")}</button>
      </div>
    </div>`;

  $("back-booking").onclick = () => (statusDiv.innerHTML = "");
  $("confirm-booking").onclick = () =>
    startJob(
      "book",
      toBook.map((p) => ({
        date: p.date,
        desks,
        startTime: p.time.startTime,
        endTime: p.time.endTime,
        label: `${fmtDay(p.date)} ${fmtRange(p.time)}`,
      })),
    );
}

// ---------- Presets ----------

async function loadPresets(selectName) {
  const { presets = [] } = await chrome.storage.local.get(["presets"]);
  const select = $("preset-select");
  select.innerHTML =
    `<option value="">${esc(t("no_preset"))}</option>` +
    presets.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  if (selectName) select.value = selectName;
  $("delete-preset").disabled = !select.value;
  return presets;
}

function setupPresets() {
  $("preset-select").addEventListener("change", async (e) => {
    const { presets = [] } = await chrome.storage.local.get(["presets"]);
    const p = presets.find((x) => x.name === e.target.value);
    $("delete-preset").disabled = !p;
    if (!p) return;
    $("desk-number").value = p.desk || "";
    $("secondary-desks").value = p.secondary || "";
    setWeekdays("weekday", p.weekdays || DEFAULT_WEEKDAYS);
    $("start-time").value = p.startTime || "13:00";
    $("end-time").value = p.endTime || "17:00";
    state.exceptions = (p.exceptions || []).map((e) => ({ ...e }));
    renderExceptions();
    $("preset-name").value = p.name;
    updateDeskLookup();
  });

  $("save-preset").addEventListener("click", async () => {
    const name = $("preset-name").value.trim();
    if (!name) {
      $("preset-name").focus();
      return;
    }
    const { presets = [] } = await chrome.storage.local.get(["presets"]);
    const preset = {
      name,
      desk: $("desk-number").value.trim(),
      secondary: $("secondary-desks").value.trim(),
      weekdays: getWeekdays("weekday"),
      startTime: $("start-time").value,
      endTime: $("end-time").value,
      exceptions: state.exceptions.map((e) => ({ ...e })),
    };
    const next = [...presets.filter((p) => p.name !== name), preset].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    await chrome.storage.local.set({ presets: next });
    await loadPresets(name);
  });

  $("delete-preset").addEventListener("click", async () => {
    const name = $("preset-select").value;
    const { presets = [] } = await chrome.storage.local.get(["presets"]);
    await chrome.storage.local.set({ presets: presets.filter((p) => p.name !== name) });
    $("preset-name").value = "";
    await loadPresets();
  });
}

// ---------- Jobs (run in background) ----------

async function startJob(kind, items) {
  const target = kind === "book" ? $("booking-status") : $("list-status");
  const res = await chrome.runtime.sendMessage({ type: "start-job", kind, items });
  if (!res?.ok) target.innerHTML = errorBox(esc(res?.errorCode ? t(res.errorCode) : t("could_not_start")));
}

const PROGRESS_KEY = { book: "booking_progress", cancel: "canceling_progress", edit: "editing_progress" };
const DONE_KEY = { book: "n_booked", cancel: "n_canceled", edit: "n_edited" };

let lastFinishedAt = null;

function renderJob(job) {
  if (!job) return;
  const target = job.kind === "book" ? $("booking-status") : $("list-status");
  const stale = job.running && Date.now() - (job.updatedAt || 0) > STALE_JOB_MS;
  const running = job.running && !stale;

  state.jobRunning = running;
  updateCancelButton();
  $("preview-booking").disabled = running;

  if (running) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    target.innerHTML = `
      <div class="progress-box">
        <div>${esc(t(PROGRESS_KEY[job.kind], { done: job.done, total: job.total }))}${job.current ? ` · ${esc(job.current)}` : ""}</div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <small>${esc(t("can_close"))}</small>
      </div>`;
    return;
  }

  const ok = job.results.filter((r) => r.ok);
  const failed = job.results.filter((r) => !r.ok);
  // results: { label, ok, desk?, error? } — error is the server's own message
  const detail = (r) =>
    [r.desk ? t("desk_n", { n: r.desk }) : "", r.error || ""].filter(Boolean).join(": ");
  const jobError = job.errorCode ? t(job.errorCode) : job.error || (stale ? t("job_interrupted") : "");
  target.innerHTML = `
    <div class="result-box">
      <div class="text-success" style="font-weight:500">${esc(t(DONE_KEY[job.kind], { n: ok.length }))}</div>
      ${job.kind !== "cancel" && ok.length ? `<small>${ok.map((r) => `${esc(r.label)}: ${esc(detail(r))}`).join("<br>")}</small>` : ""}
      ${failed.length ? `<div class="failed-text">${esc(t("failed_n", { n: failed.length }))}<br><small>${failed.map((r) => `${esc(r.label)}: ${esc(detail(r))}`).join("<br>")}</small></div>` : ""}
      ${jobError ? `<div class="failed-text">${esc(jobError)}</div>` : ""}
    </div>`;

  if (job.finishedAt && job.finishedAt !== lastFinishedAt) {
    lastFinishedAt = job.finishedAt;
    state.selected.clear();
    refreshBookings();
  }
}

// ---------- init ----------

function renderStatusLine(exp) {
  const where = [state.opts.xAppAccount];
  if (state.opts.plantId) where.push(state.opts.detected?.plantName || t("floor_set"));

  let session = "";
  if (exp) {
    const ms = exp - Date.now();
    if (ms <= 0) session = t("session_ended");
    else {
      const days = Math.floor(ms / 86_400_000);
      const hours = Math.floor((ms % 86_400_000) / 3_600_000);
      session = t("session_left", { d: days, h: hours });
    }
  }
  const line = $("status-line");
  line.innerHTML = `<span class="status-where">${esc(where.filter(Boolean).join(" · "))}</span>${
    session ? `<span class="status-session ${exp <= Date.now() ? "text-error" : ""}">${esc(session)}</span>` : ""
  }`;
  line.title = [...where, session].filter(Boolean).join(" · ");
}

async function refreshBookings() {
  const { authToken } = await chrome.storage.local.get(["authToken"]);
  try {
    state.bookings = await listMyBookings(authToken, state.opts);
    renderBookings();
  } catch (e) {
    $("reserves").innerHTML = errorBox(
      e.message === "Unauthorized" ? esc(t("session_expired_short")) : esc(e.message),
    );
  }
}

async function init() {
  const reserves = $("reserves");
  reserves.innerHTML = `<div class="loading">${t("checking_session")}</div>`;

  const { authToken } = await chrome.storage.local.get(["authToken"]);
  state.opts = await getEffectiveOptions();

  if (!state.opts.xAppAccount) {
    reserves.innerHTML = errorBox(
      `<p><strong>${t("company_not_detected_title")}</strong></p><p>${t("company_not_detected_body")}</p>`,
    );
    return;
  }

  // The Deskbee token is a JWT valid for ~7 days: trust its own "exp" claim.
  const exp = jwtExpiry(authToken);
  if (!authToken || (exp && exp <= Date.now())) {
    reserves.innerHTML = errorBox(
      `<p><strong>${t("session_expired_title")}</strong></p><p>${t("session_expired_body", {
        link: `<a href="${esc(state.opts.origin)}" target="_blank">Deskbee</a>`,
      })}</p>`,
    );
    renderStatusLine(exp);
    return;
  }

  updateDeskLookup();
  const loadMap = () =>
    fetchDeskMap(authToken, state.opts, deskNumberOf).catch((e) => {
      console.error("Failed to fetch desk map:", e);
      return {};
    });

  if (state.opts.plantId) {
    [, state.deskMap] = await Promise.all([refreshBookings(), loadMap()]);
  } else {
    // No floor yet: take it from one of the user's bookings (no need to open the map).
    await refreshBookings();
    const floor = floorFromBookings(state.bookings);
    if (floor) {
      const { detected = {} } = await chrome.storage.local.get(["detected"]);
      await chrome.storage.local.set({
        detected: { ...detected, plantId: floor.uuid, plantName: floor.name },
      });
      state.opts = await getEffectiveOptions();
      state.deskMap = await loadMap();
    }
  }
  updateDeskLookup();
  renderStatusLine(exp);

  const { job } = await chrome.storage.local.get(["job"]);
  if (job && (job.running || Date.now() - (job.finishedAt || 0) < 2 * 60 * 1000)) {
    lastFinishedAt = job.finishedAt;
    renderJob(job);
  }
}

// ---------- update notice ----------

async function showUpdateBanner() {
  const info = await checkForUpdate().catch(() => null);
  if (!info?.available) return;
  const { updateDismissed } = await chrome.storage.local.get(["updateDismissed"]);
  if (updateDismissed === info.latest) return;

  $("update-title").textContent = t("update_available", { v: info.latest });
  $("update-download").href = info.url;
  $("update-banner").hidden = false;
  $("update-dismiss").onclick = async () => {
    await chrome.storage.local.set({ updateDismissed: info.latest });
    $("update-banner").hidden = true;
  };
}

// ---------- detach ----------

const DETACHED = new URLSearchParams(location.search).has("detached");

async function openDetached() {
  const { detachedWindowId } = await chrome.storage.session.get(["detachedWindowId"]);
  if (detachedWindowId) {
    try {
      await chrome.windows.update(detachedWindowId, { focused: true });
      window.close();
      return;
    } catch (_) {
      // window was closed; open a new one
    }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("popup/popup.html?detached=1"),
    type: "popup",
    width: 460,
    height: 680,
  });
  await chrome.storage.session.set({ detachedWindowId: win.id });
  window.close();
}

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  setupLangSwitch();
  $("desk-lookup-status").textContent = t("enter_desk");
  if (DETACHED) document.body.classList.add("detached");
  $("detach").addEventListener("click", openDetached);
  renderWeekdayPickers();

  document.querySelectorAll(".tab-btn").forEach((btn, _, tabs) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => (c.style.display = "none"));
      btn.classList.add("active");
      $(`${btn.dataset.tab}-tab`).style.display = "block";
    });
  });

  const now = new Date();
  const today = toISODate(now);
  const endOfMonth = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  $("start-date").value = today;
  $("start-date").min = today;
  $("end-date").min = today;
  $("end-date").value = endOfMonth;
  getMaxDaysAhead().then((max) => {
    if (!max) return;
    const last = addDaysISO(today, max);
    $("start-date").max = last;
    $("end-date").max = last;
    if (endOfMonth > last) $("end-date").value = last;
  });

  $("desk-number").addEventListener("input", updateDeskLookup);
  $("secondary-desks").addEventListener("input", updateDeskLookup);
  $("booking-form").addEventListener("submit", (e) => {
    e.preventDefault();
    preview();
  });

  $("theme-toggle").addEventListener("click", () => window.deskbeeTheme.toggle());

  setupListTab();
  setupSchedule();
  setupPresets();
  loadPresets();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.job) renderJob(changes.job.newValue);
  });

  init();
  showUpdateBanner();
});
