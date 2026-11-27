// planner.js
// Pure functions (no chrome.* or fetch) so they can be unit tested with node --test.
// Dates are handled as local "YYYY-MM-DD" strings to avoid UTC off-by-one bugs.

const pad = (n) => String(n).padStart(2, "0");

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses "YYYY-MM-DD" into a local Date at noon (safe against DST/UTC shifts). */
export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDaysISO(iso, days) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function toDeskbeeDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "3A_DESK.308" -> "308", "Desk 308" -> "308". Same rule used for the floor map. */
export function deskNumberOf(name) {
  if (!name) return "";
  return name.includes(".") ? name.split(".").pop() : name.replace(/\D/g, "");
}

export function parseDeskList(text) {
  if (!text) return [];
  const out = [];
  for (const part of text.split(/[,;\s]+/)) {
    const v = part.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export function bookingDateISO(booking) {
  if (!booking?.start_date) return null;
  const d = new Date(String(booking.start_date).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : toISODate(d);
}

export function bookingDeskNumber(booking) {
  return deskNumberOf(booking?.place?.name || booking?.place?.name_display || "");
}

export function isCancellable(booking) {
  const status = (booking?.status?.name || "").toLowerCase();
  return !/cancel|finish|expired/.test(status);
}

/**
 * Builds the list of days a batch booking will touch.
 * Each entry: { date, action, reason? } where action is
 * "book" | "skip-past" | "skip-too-far" | "skip-booked".
 * `today` (ISO) enables the past/too-far checks; `maxDaysAhead` is inclusive.
 */
export function buildBookingPlan({
  start,
  end,
  weekdays,
  bookedDates = new Set(),
  today,
  maxDaysAhead,
}) {
  const days = new Set(weekdays);
  const lastBookable = today && maxDaysAhead > 0 ? addDaysISO(today, maxDaysAhead) : null;
  const plan = [];
  const current = parseISODate(start);
  const last = parseISODate(end);

  while (current <= last) {
    if (days.has(current.getDay())) {
      const date = toISODate(current);
      if (today && date < today) {
        plan.push({ date, action: "skip-past" });
      } else if (lastBookable && date > lastBookable) {
        plan.push({ date, action: "skip-too-far" });
      } else if (bookedDates.has(date)) {
        plan.push({ date, action: "skip-booked" });
      } else {
        plan.push({ date, action: "book" });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return plan;
}

/** Checked in and not yet checked out: only a check-out is allowed on it. */
export function isCheckedIn(booking) {
  const inDone = booking?.is_checkin === true || Boolean(booking?.checkin?.checkin);
  const outDone = booking?.is_checkout === true || Boolean(booking?.checkin?.checkout);
  return inDone && !outDone;
}

/** Can be canceled: live status and no check-in (a checked-in booking only allows check-out). */
export function canCancel(booking) {
  return isCancellable(booking) && !isCheckedIn(booking);
}

/** Bookings matching an optional date range, weekdays and desk number. */
export function filterBookings(bookings, { start, end, weekdays, desk } = {}) {
  const days = weekdays ? new Set(weekdays) : null;
  return bookings.filter((b) => {
    if (!canCancel(b)) return false;
    const date = bookingDateISO(b);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (days && !days.has(parseISODate(date).getDay())) return false;
    if (desk && bookingDeskNumber(b) !== desk.trim()) return false;
    return true;
  });
}

/**
 * Floor of the most recently created booking, from booking.place.area
 * ({ uuid, type: "floor", name }). Lets the extension find the floor without
 * the user opening the map. Returns { uuid, name } or null.
 */
export function floorFromBookings(bookings) {
  let best = null;
  for (const b of bookings || []) {
    const area = b?.place?.area;
    if (area?.type !== "floor" || !area.uuid) continue;
    if (!best || String(b.created_at || "") > String(best.created_at || "")) {
      best = { created_at: b.created_at, uuid: area.uuid, name: area.name || "" };
    }
  }
  return best ? { uuid: best.uuid, name: best.name } : null;
}

/** Expiry (ms since epoch) from a JWT's "exp" claim, or null if unreadable. */
export function jwtExpiry(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? Math.floor(exp * 1000) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Check-in/out for one date: the exception for its weekday if any, else the default.
 * exceptions: [{ day: 0-6, startTime: "HH:MM", endTime: "HH:MM" }]
 */
export function timeForDay(iso, defaultTime, exceptions = []) {
  const day = parseISODate(iso).getDay();
  const ex = exceptions.find((e) => e.day === day);
  return ex ? { startTime: ex.startTime, endTime: ex.endTime } : { ...defaultTime };
}

/**
 * Problems with a schedule as codes (translated by the UI); empty array = valid.
 * { code: "default-range" } | { code: "range" | "duplicate" | "unselected", day }
 */
export function validateSchedule({ defaultTime, weekdays, exceptions = [] }) {
  const errors = [];
  if (!(defaultTime.endTime > defaultTime.startTime)) errors.push({ code: "default-range" });
  const selected = new Set(weekdays);
  const seen = new Set();
  for (const ex of exceptions) {
    if (!(ex.endTime > ex.startTime)) errors.push({ code: "range", day: ex.day });
    if (seen.has(ex.day)) errors.push({ code: "duplicate", day: ex.day });
    seen.add(ex.day);
    if (!selected.has(ex.day)) errors.push({ code: "unselected", day: ex.day });
  }
  const key = (e) => `${e.code}:${e.day ?? ""}`;
  return errors.filter((e, i) => errors.findIndex((x) => key(x) === key(e)) === i);
}

// ---------- edit ----------

const hhmm = (value) => {
  const d = new Date(String(value || "").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** { startTime, endTime } ("HH:MM", local) of a booking, or null if unreadable. */
export function bookingTimeRange(booking) {
  const startTime = hhmm(booking?.start_date);
  const endTime = hhmm(booking?.end_date);
  return startTime && endTime ? { startTime, endTime } : null;
}

/** UUID of the booking's desk: place.uuid, else looked up by number in the floor map. */
export function bookingPlaceUuid(booking, deskMap = {}) {
  return booking?.place?.uuid || deskMap[bookingDeskNumber(booking)] || null;
}

/**
 * What an edit would do to each booking. Empty fields in `changes`
 * ({ startTime?, endTime?, desk? }) keep the booking's current value.
 * Each entry: { uuid, date, action, startTime, endTime, placeUuid, deskNumber } where action is
 * "edit" | "skip-status" | "skip-past" | "skip-no-desk" | "skip-range" | "skip-unchanged".
 */
export function buildEditPlan({ bookings, changes = {}, deskMap = {}, today }) {
  const wantedDesk = (changes.desk || "").trim();
  return bookings.map((b) => {
    const current = bookingTimeRange(b);
    const date = bookingDateISO(b);
    const currentDesk = bookingDeskNumber(b);
    const startTime = changes.startTime || current?.startTime;
    const endTime = changes.endTime || current?.endTime;
    const deskNumber = wantedDesk || currentDesk;
    const placeUuid = wantedDesk ? deskMap[wantedDesk] || null : bookingPlaceUuid(b, deskMap);
    const item = { uuid: b.uuid, date, startTime, endTime, placeUuid, deskNumber, checkedIn: isCheckedIn(b) };

    if (!isCancellable(b)) return { ...item, action: "skip-status" };
    if (!current || !date) return { ...item, action: "skip-unchanged" };
    if (today && date < today) return { ...item, action: "skip-past" };
    if (!placeUuid) return { ...item, action: "skip-no-desk" };
    if (!(endTime > startTime)) return { ...item, action: "skip-range" };
    if (startTime === current.startTime && endTime === current.endTime && deskNumber === currentDesk) {
      return { ...item, action: "skip-unchanged" };
    }
    return { ...item, action: "edit" };
  });
}

/** Body of PUT /api/bookings/{uuid}, as sent by the Deskbee web app. `date` is DD/MM/YYYY. */
export function editBody(bookingUuid, { placeUuid, date, startTime, endTime }) {
  return {
    date,
    start_hour: startTime,
    end_hour: endTime,
    type: "workspace",
    uuid: placeUuid,
    booking_uuid: placeUuid,
    booking_uuid_identifier: bookingUuid,
  };
}

// ---------- check-in / check-out ----------
// The server decides when each is allowed (is_can_checkin / is_can_checkout on the booking),
// so the extension never computes the check-in window itself.

export const canCheckin = (booking) => booking?.is_can_checkin === true;
export const canCheckout = (booking) => booking?.is_can_checkout === true;

/** "HH:MM" (local) of the check-in already made on a booking, or null. */
export const checkinTime = (booking) => hhmm(booking?.checkin?.checkin);

/** Body of POST /api/checkins, as sent by the Deskbee web app. */
export function checkinBody(placeUuid, bookingUuid) {
  return { uuid: placeUuid, booking_uuid: bookingUuid, person_uuid: null };
}

/** Body of POST /api/checkins/checkout. */
export function checkoutBody(bookingUuid) {
  return { uuid: bookingUuid, is_thirdparty_checkout: false };
}
