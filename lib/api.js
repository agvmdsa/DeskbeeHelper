// api.js — thin client for api.deskbee.io (used by popup and background).
import { urls, apiHeaders } from "../config/constants.js";
import { editBody } from "./planner.js";

const PAGE_SIZE = 30;
const MAX_PAGES = 20;

async function parseError(response, fallback) {
  try {
    const body = await response.json();
    return body.message || fallback;
  } catch (_) {
    return fallback;
  }
}

async function getJSON(url, token, opts) {
  const response = await fetch(url, { headers: apiHeaders(token, opts) });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await parseError(response, `HTTP ${response.status}`));
  return response.json();
}

/** All of the user's bookings, following pagination. */
export async function listMyBookings(token, opts) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      search: "type:;search:;period:;filter:;uuid:",
      include:
        "service;recurrences;meeting;calendar_integration;is_extend;resources;checkin;type;parking;tolerance;reason;parent",
    });
    const body = await getJSON(`${urls.myBookings}?${params}`, token, opts);
    const data = body.data || [];
    all.push(...data);

    const lastPage = body.meta?.last_page;
    if (lastPage ? page >= lastPage : data.length < PAGE_SIZE) break;
  }
  return all;
}

/** Map of desk number -> place UUID for the configured floor. */
export async function fetchDeskMap(token, opts, deskNumberOf) {
  if (!opts.plantId) return {};

  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const from = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  d.setMinutes(d.getMinutes() + 15);
  const to = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date();
  const datetime = encodeURIComponent(
    `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()};${from};${to}`,
  );

  const url = `https://api.deskbee.io/api/plant/${opts.plantId}/places?datetime=${datetime}&type=workspace&is_by_pass_restriction=false&is_by_pass_state=false`;
  const body = await getJSON(url, token, opts);

  const map = {};
  for (const place of body.data || []) {
    const num = deskNumberOf(place.name);
    if (num) map[num] = place.uuid;
  }
  return map;
}

export async function createBooking(token, opts, { placeUuid, date, startTime, endTime }) {
  const response = await fetch(urls.bookings, {
    method: "POST",
    headers: { ...apiHeaders(token, opts), "Content-Type": "application/json" },
    body: JSON.stringify({
      booking_uuid_identifier: null,
      uuid: placeUuid,
      start_date: date,
      end_date: date,
      start_hour: startTime,
      end_hour: endTime,
      reason: "",
    }),
  });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await parseError(response, `Booking failed: ${response.status}`));
  return response.json();
}

export async function deleteBooking(token, opts, bookingUuid) {
  const response = await fetch(`${urls.bookings}/${encodeURIComponent(bookingUuid)}`, {
    method: "DELETE",
    headers: apiHeaders(token, opts),
  });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await parseError(response, `Cancel failed: ${response.status}`));
}

/**
 * Edits a booking in place (PUT, same call the Deskbee web app makes).
 * The server cancels and recreates it, so the booking gets a new UUID.
 */
export async function updateBooking(token, opts, bookingUuid, { placeUuid, date, startTime, endTime }) {
  const response = await fetch(`${urls.bookings}/${encodeURIComponent(bookingUuid)}`, {
    method: "PUT",
    headers: { ...apiHeaders(token, opts), "Content-Type": "application/json" },
    body: JSON.stringify(editBody(bookingUuid, { placeUuid, date, startTime, endTime })),
  });
  if (response.status === 401) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await parseError(response, `Edit failed: ${response.status}`));
  return response.json();
}
