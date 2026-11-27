export const urls = {
  bookings: "https://api.deskbee.io/api/bookings",
  myBookings: "https://api.deskbee.io/api/bookings/me",
  checkin: "https://api.deskbee.io/api/checkins",
  checkout: "https://api.deskbee.io/api/checkins/checkout",
};

// GitHub repository whose releases are checked for updates (must be public).
export const GITHUB_REPO = "agvmdsa/DeskbeeHelper";
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

// Used only if the version could not be detected from the Deskbee web app.
export const FALLBACK_APP_VERSION = "1.266.6607";

/**
 * Effective options = values detected automatically on *.deskbee.app,
 * overridden by any non-empty value the user saved in the Options page.
 */
export async function getEffectiveOptions() {
  const { detected = {}, overrides = {} } = await chrome.storage.local.get([
    "detected",
    "overrides",
  ]);

  const pick = (key) => (overrides[key] || "").trim() || detected[key] || "";

  const xAppAccount = pick("xAppAccount");
  return {
    xAppAccount,
    xAppVersion: pick("xAppVersion") || FALLBACK_APP_VERSION,
    plantId: pick("plantId"),
    origin: xAppAccount ? `https://${xAppAccount}.deskbee.app` : "",
    detected,
    overrides,
  };
}

export function apiHeaders(authToken, opts) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${authToken}`,
    "x-app-account": opts.xAppAccount,
    "x-app-version": opts.xAppVersion,
  };
}
