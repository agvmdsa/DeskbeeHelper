import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toISODate,
  toDeskbeeDate,
  deskNumberOf,
  parseDeskList,
  bookingDateISO,
  buildBookingPlan,
  filterBookings,
  isCancellable,
  addDaysISO,
  bookingDeskNumber,
  floorFromBookings,
  jwtExpiry,
  timeForDay,
  validateSchedule,
  bookingTimeRange,
  bookingPlaceUuid,
  buildEditPlan,
  editBody,
  canCheckin,
  canCheckout,
  checkinTime,
  checkinBody,
  checkoutBody,
  isCheckedIn,
  canCancel,
} from "../lib/planner.js";

test("toISODate uses local date, not UTC", () => {
  // 23:30 local on Nov 22 must stay Nov 22 regardless of timezone offset
  assert.equal(toISODate(new Date(2026, 10, 22, 23, 30)), "2026-11-22");
  assert.equal(toISODate(new Date(2026, 0, 5, 0, 1)), "2026-01-05");
});

test("toDeskbeeDate converts ISO to DD/MM/YYYY", () => {
  assert.equal(toDeskbeeDate("2026-03-09"), "09/03/2026");
});

test("deskNumberOf extracts desk number from place names", () => {
  assert.equal(deskNumberOf("3A_DESK.308"), "308");
  assert.equal(deskNumberOf("Desk 308"), "308");
  assert.equal(deskNumberOf("A.B.12"), "12");
  assert.equal(deskNumberOf(""), "");
  assert.equal(deskNumberOf(undefined), "");
});

test("parseDeskList splits, trims and dedupes", () => {
  assert.deepEqual(parseDeskList(" 309, 310 ,,309;311 "), ["309", "310", "311"]);
  assert.deepEqual(parseDeskList(""), []);
  assert.deepEqual(parseDeskList(undefined), []);
});

test("bookingDateISO reads local date of start_date", () => {
  assert.equal(bookingDateISO({ start_date: "2026-11-23T13:00:00" }), "2026-11-23");
  assert.equal(bookingDateISO({ start_date: "2026-11-23 13:00:00" }), "2026-11-23");
  assert.equal(bookingDateISO({}), null);
});

test("buildBookingPlan only includes selected weekdays in range", () => {
  // 2026-11-23 is a Monday
  const plan = buildBookingPlan({
    start: "2026-11-23",
    end: "2026-11-29",
    weekdays: [1, 3, 5],
  });
  assert.deepEqual(
    plan.map((p) => [p.date, p.action]),
    [
      ["2026-11-23", "book"],
      ["2026-11-25", "book"],
      ["2026-11-27", "book"],
    ],
  );
});

test("buildBookingPlan marks already-booked days as skipped", () => {
  const plan = buildBookingPlan({
    start: "2026-11-23",
    end: "2026-11-25",
    weekdays: [1, 2, 3],
    bookedDates: new Set(["2026-11-25"]),
  });
  assert.deepEqual(plan, [
    { date: "2026-11-23", action: "book" },
    { date: "2026-11-24", action: "book" },
    { date: "2026-11-25", action: "skip-booked" },
  ]);
});

test("buildBookingPlan handles month boundary and DST-free iteration", () => {
  const plan = buildBookingPlan({
    start: "2026-12-30",
    end: "2027-01-02",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  });
  assert.deepEqual(
    plan.map((p) => p.date),
    ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"],
  );
});

test("buildBookingPlan returns empty when end before start", () => {
  assert.deepEqual(
    buildBookingPlan({ start: "2026-11-25", end: "2026-11-24", weekdays: [1, 2, 3] }),
    [],
  );
});

const bookings = [
  { uuid: "a", start_date: "2026-11-23T13:00:00", place: { name: "X.308" }, status: { name: "reserved" } },
  { uuid: "b", start_date: "2026-11-24T13:00:00", place: { name: "X.309" }, status: { name: "reserved" } },
  { uuid: "c", start_date: "2026-11-25T13:00:00", place: { name: "X.308" }, status: { name: "reserved" } },
  { uuid: "d", start_date: "2026-12-01T13:00:00", place: { name: "X.308" }, status: { name: "reserved" } },
];

test("filterBookings by date range and weekday", () => {
  const uuids = filterBookings(bookings, {
    start: "2026-11-23",
    end: "2026-11-30",
    weekdays: [1, 3],
  }).map((b) => b.uuid);
  assert.deepEqual(uuids, ["a", "c"]);
});

test("filterBookings by desk, with open-ended range", () => {
  const uuids = filterBookings(bookings, { desk: "308", weekdays: [0, 1, 2, 3, 4, 5, 6] }).map(
    (b) => b.uuid,
  );
  assert.deepEqual(uuids, ["a", "c", "d"]);
});

test("filterBookings skips non-cancellable bookings", () => {
  const list = [
    ...bookings,
    { uuid: "e", start_date: "2026-11-26T13:00:00", place: { name: "X.308" }, status: { name: "canceled" } },
  ];
  const uuids = filterBookings(list, { weekdays: [4] }).map((b) => b.uuid);
  assert.deepEqual(uuids, []);
});

test("isCancellable rejects finished or canceled statuses", () => {
  assert.equal(isCancellable({ status: { name: "reserved" } }), true);
  assert.equal(isCancellable({}), true);
  assert.equal(isCancellable({ status: { name: "Canceled" } }), false);
  assert.equal(isCancellable({ status: { name: "cancelled" } }), false);
  assert.equal(isCancellable({ status: { name: "finished" } }), false);
  assert.equal(isCancellable({ status: { name: "expired" } }), false);
});

test("buildBookingPlan skips days beyond maxDaysAhead (inclusive limit)", () => {
  // today = Sun 2026-11-22, limit 30 -> last bookable day 2026-12-22
  const plan = buildBookingPlan({
    start: "2026-12-21",
    end: "2026-12-23",
    weekdays: [1, 2, 3],
    today: "2026-11-22",
    maxDaysAhead: 30,
  });
  assert.deepEqual(plan, [
    { date: "2026-12-21", action: "book" },
    { date: "2026-12-22", action: "book" },
    { date: "2026-12-23", action: "skip-too-far" },
  ]);
});

test("buildBookingPlan skips past days and ignores limit when not set", () => {
  const plan = buildBookingPlan({
    start: "2026-11-20",
    end: "2027-03-01",
    weekdays: [1, 5],
    today: "2026-11-22",
  });
  assert.deepEqual(plan[0], { date: "2026-11-20", action: "skip-past" });
  assert.equal(plan.at(-1).date, "2027-03-01");
  assert.equal(plan.at(-1).action, "book");
});

test("addDaysISO crosses month and year boundaries", () => {
  assert.equal(addDaysISO("2026-11-22", 30), "2026-12-22");
  assert.equal(addDaysISO("2026-12-20", 15), "2027-01-04");
});

// Same shape as a real /api/bookings/me item (values are fictional)
const realBooking = {
  uuid: "11111111-2222-4333-8444-555555555555",
  start_date: "2026-11-23T07:00:00-03:00",
  created_at: "2026-11-22T21:48:43-03:00",
  place: {
    name: "DESK_EAST.325",
    name_display: "DESK_EAST.325",
    area: {
      uuid: "00000000-0000-4000-8000-000000000003",
      type: "floor",
      name: "Floor 3 · East wing",
    },
  },
  status: { id: 1, name: "reserved", description: "Valid booking" },
};

test("real booking shape: desk number, cancellable status", () => {
  assert.equal(bookingDeskNumber(realBooking), "325");
  assert.equal(isCancellable(realBooking), true);
});

test("floorFromBookings returns floor of the most recently created booking", () => {
  const older = {
    ...realBooking,
    created_at: "2026-10-01T10:00:00-03:00",
    place: { ...realBooking.place, area: { uuid: "00000000-0000-4000-8000-000000000002", type: "floor", name: "Floor 2" } },
  };
  assert.deepEqual(floorFromBookings([older, realBooking]), {
    uuid: "00000000-0000-4000-8000-000000000003",
    name: "Floor 3 · East wing",
  });
});

test("floorFromBookings ignores non-floor areas and empty lists", () => {
  assert.equal(floorFromBookings([]), null);
  assert.equal(
    floorFromBookings([{ ...realBooking, place: { area: { uuid: "x", type: "building" } } }]),
    null,
  );
});

test("jwtExpiry reads exp (seconds) from a JWT payload", () => {
  const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${b64url({ alg: "RS256" })}.${b64url({ exp: 1795998215.79, sub: "1" })}.sig`;
  assert.equal(jwtExpiry(token), Math.floor(1795998215.79 * 1000));
  assert.equal(jwtExpiry("not-a-jwt"), null);
  assert.equal(jwtExpiry(undefined), null);
});

test("timeForDay uses the exception for that weekday, else the default", () => {
  const def = { startTime: "13:00", endTime: "17:00" };
  const exceptions = [{ day: 5, startTime: "08:00", endTime: "12:00" }];
  assert.deepEqual(timeForDay("2026-11-27", def, exceptions), { startTime: "08:00", endTime: "12:00" }); // Fri
  assert.deepEqual(timeForDay("2026-11-26", def, exceptions), def); // Thu
  assert.deepEqual(timeForDay("2026-11-27", def, []), def);
});

test("validateSchedule flags bad ranges, duplicates and unselected days", () => {
  const errors = validateSchedule({
    defaultTime: { startTime: "13:00", endTime: "17:00" },
    weekdays: [1, 2, 3, 4, 5],
    exceptions: [
      { day: 5, startTime: "12:00", endTime: "08:00" },
      { day: 5, startTime: "08:00", endTime: "12:00" },
      { day: 6, startTime: "08:00", endTime: "12:00" },
    ],
  });
  assert.deepEqual(errors, [
    { code: "range", day: 5 },
    { code: "duplicate", day: 5 },
    { code: "unselected", day: 6 },
  ]);
  assert.deepEqual(
    validateSchedule({ defaultTime: { startTime: "17:00", endTime: "13:00" }, weekdays: [1], exceptions: [] }),
    [{ code: "default-range" }],
  );
  assert.deepEqual(
    validateSchedule({
      defaultTime: { startTime: "13:00", endTime: "17:00" },
      weekdays: [1, 5],
      exceptions: [{ day: 5, startTime: "08:00", endTime: "12:00" }],
    }),
    [],
  );
});

test("i18n: Portuguese and English dictionaries have the same keys", async () => {
  const { dictionaries } = await import("../lib/i18n.js");
  const en = Object.keys(dictionaries.en).sort();
  const pt = Object.keys(dictionaries.pt).sort();
  assert.deepEqual(pt.filter((k) => !en.includes(k)), [], "keys only in pt");
  assert.deepEqual(en.filter((k) => !pt.includes(k)), [], "keys only in en");
});

// ---------- edit ----------

const mk = (uuid, date, start, end, desk, placeUuid) => ({
  uuid,
  start_date: `${date}T${start}:00`,
  end_date: `${date}T${end}:00`,
  place: { name: `X.${desk}`, ...(placeUuid ? { uuid: placeUuid } : {}) },
  status: { name: "reserved" },
});

test("bookingTimeRange reads local HH:MM from start/end dates", () => {
  assert.deepEqual(bookingTimeRange(mk("a", "2026-11-26", "13:00", "17:30", "308")), {
    startTime: "13:00",
    endTime: "17:30",
  });
  assert.equal(bookingTimeRange({}), null);
});

test("bookingPlaceUuid prefers place.uuid, falls back to desk map", () => {
  assert.equal(bookingPlaceUuid(mk("a", "2026-11-26", "13:00", "17:00", "308", "P1"), {}), "P1");
  assert.equal(bookingPlaceUuid(mk("a", "2026-11-26", "13:00", "17:00", "308"), { 308: "P2" }), "P2");
  assert.equal(bookingPlaceUuid(mk("a", "2026-11-26", "13:00", "17:00", "308"), {}), null);
});

const today = "2026-11-25";
const bk = [
  mk("a", "2026-11-26", "13:00", "17:00", "308", "P308"),
  mk("b", "2026-11-27", "13:00", "17:00", "308", "P308"),
];

test("buildEditPlan: empty fields keep current values", () => {
  const plan = buildEditPlan({ bookings: bk, changes: { startTime: "14:00" }, deskMap: {}, today });
  assert.deepEqual(plan.map((p) => [p.uuid, p.action, p.startTime, p.endTime, p.placeUuid, p.deskNumber]), [
    ["a", "edit", "14:00", "17:00", "P308", "308"],
    ["b", "edit", "14:00", "17:00", "P308", "308"],
  ]);
  assert.equal(plan[0].date, "2026-11-26");
});

test("buildEditPlan: new desk resolves uuid from the desk map", () => {
  const plan = buildEditPlan({ bookings: bk, changes: { desk: "309" }, deskMap: { 309: "P309" }, today });
  assert.equal(plan[0].action, "edit");
  assert.equal(plan[0].placeUuid, "P309");
  assert.equal(plan[0].deskNumber, "309");
});

test("buildEditPlan: unknown desk is skipped", () => {
  const plan = buildEditPlan({ bookings: bk, changes: { desk: "999" }, deskMap: {}, today });
  assert.deepEqual(plan.map((p) => p.action), ["skip-no-desk", "skip-no-desk"]);
});

test("buildEditPlan: no effective change is skipped", () => {
  const plan = buildEditPlan({
    bookings: bk,
    changes: { startTime: "13:00", desk: "308" },
    deskMap: { 308: "P308" },
    today,
  });
  assert.deepEqual(plan.map((p) => p.action), ["skip-unchanged", "skip-unchanged"]);
});

test("buildEditPlan: end before start is skipped per booking", () => {
  const plan = buildEditPlan({
    bookings: [mk("a", "2026-11-26", "13:00", "17:00", "308", "P"), mk("b", "2026-11-27", "10:00", "11:00", "308", "P")],
    changes: { startTime: "12:00" },
    deskMap: {},
    today,
  });
  assert.deepEqual(plan.map((p) => p.action), ["edit", "skip-range"]);
});

test("buildEditPlan: past days and non-cancellable bookings are skipped", () => {
  const past = mk("p", "2026-11-24", "13:00", "17:00", "308", "P");
  const canceled = { ...mk("c", "2026-11-28", "13:00", "17:00", "308", "P"), status: { name: "canceled" } };
  const plan = buildEditPlan({ bookings: [past, canceled], changes: { startTime: "14:00" }, deskMap: {}, today });
  assert.deepEqual(plan.map((p) => p.action), ["skip-past", "skip-status"]);
});

test("editBody mirrors the Deskbee web app PUT payload", () => {
  assert.deepEqual(
    editBody("BOOKING", { placeUuid: "PLACE", date: "26/11/2026", startTime: "13:01", endTime: "17:00" }),
    {
      date: "26/11/2026",
      start_hour: "13:01",
      end_hour: "17:00",
      type: "workspace",
      uuid: "PLACE",
      booking_uuid: "PLACE",
      booking_uuid_identifier: "BOOKING",
    },
  );
});

// ---------- check-in / check-out ----------

test("canCheckin / canCheckout follow the server flags only", () => {
  assert.equal(canCheckin({ is_can_checkin: true }), true);
  assert.equal(canCheckin({ is_can_checkin: false, is_can_checkout: true }), false);
  assert.equal(canCheckin({}), false);
  assert.equal(canCheckout({ is_can_checkout: true }), true);
  assert.equal(canCheckout({ is_can_checkout: false, is_can_checkin: true }), false);
  assert.equal(canCheckout(undefined), false);
});

test("checkinTime reads the local HH:MM of booking.checkin.checkin", () => {
  assert.equal(checkinTime({ checkin: { checkin: "2026-11-27T15:56:10" } }), "15:56");
  assert.equal(checkinTime({ checkin: null }), null);
  assert.equal(checkinTime({}), null);
});

test("checkinBody mirrors the Deskbee web app payload", () => {
  assert.deepEqual(checkinBody("PLACE", "BOOKING"), {
    uuid: "PLACE",
    booking_uuid: "BOOKING",
    person_uuid: null,
  });
});

test("checkoutBody mirrors the Deskbee web app payload", () => {
  assert.deepEqual(checkoutBody("BOOKING"), { uuid: "BOOKING", is_thirdparty_checkout: false });
});

// ---------- checked-in bookings can only be checked out ----------

const inBooking = {
  ...mk("in", "2026-11-26", "13:00", "17:00", "308", "P"),
  is_checkin: true,
  is_checkout: false,
  checkin: { checkin: "2026-11-26T12:40:00", checkout: null },
};

test("isCheckedIn is true only between check-in and check-out", () => {
  assert.equal(isCheckedIn(inBooking), true);
  assert.equal(isCheckedIn({ ...inBooking, is_checkout: true }), false);
  assert.equal(isCheckedIn({ ...inBooking, is_checkout: false, checkin: { checkin: "x", checkout: "y" } }), false);
  assert.equal(isCheckedIn(mk("a", "2026-11-26", "13:00", "17:00", "308")), false);
});

test("canCancel: cancellable status and not checked in", () => {
  assert.equal(canCancel(mk("a", "2026-11-26", "13:00", "17:00", "308")), true);
  assert.equal(canCancel(inBooking), false);
  assert.equal(canCancel({ ...mk("c", "2026-11-26", "13:00", "17:00", "308"), status: { name: "canceled" } }), false);
});

test("filterBookings never selects a checked-in booking for cancel", () => {
  const free = mk("free", "2026-11-26", "13:00", "17:00", "309");
  assert.deepEqual(filterBookings([inBooking, free], {}).map((b) => b.uuid), ["free"]);
});

test("buildEditPlan allows a checked-in booking but flags it", () => {
  const free = mk("free", "2026-11-27", "13:00", "17:00", "308", "P");
  const plan = buildEditPlan({ bookings: [inBooking, free], changes: { startTime: "14:00" }, deskMap: {}, today: "2026-11-25" });
  assert.deepEqual(plan.map((p) => [p.action, p.checkedIn]), [["edit", true], ["edit", false]]);
});

test("isCancellable still counts a checked-in booking as booked", () => {
  assert.equal(isCancellable(inBooking), true);
});
