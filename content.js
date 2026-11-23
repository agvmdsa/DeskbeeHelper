// content.js
//
// Runs only on https://*.deskbee.app/* (isolated world).
// - Detects the company account from the subdomain (e.g. "acme" in acme.deskbee.app).
// - Syncs the auth token / user data from the page's storage.
// - Receives app version / floor UUID observed by page-hook.js.
// Everything is saved in chrome.storage.local (not synced to the Google account).

const TOKEN_KEY = "desko-app-token";
const USER_KEY = "desko-app-user";

function detectAccountFromHost() {
  const m = location.hostname.match(/^([^.]+)\.deskbee\.app$/i);
  return m ? m[1].toLowerCase() : null;
}

function mergeDetected(patch) {
  chrome.storage.local.get(["detected"], ({ detected }) => {
    const next = { ...(detected || {}), ...patch, detectedAt: Date.now() };
    chrome.storage.local.set({ detected: next });
  });
}

function readToken() {
  const raw =
    window.localStorage.getItem(TOKEN_KEY) ||
    window.sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;

  let token = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      token = parsed.token || parsed.access_token || parsed.value || raw;
    } else {
      token = parsed || raw;
    }
  } catch (_) {}

  if (typeof token !== "string") return null;
  token = token.trim().replace(/^"|"$/g, "");
  return token && token !== "undefined" && token !== "null" ? token : null;
}

function syncSession() {
  const token = readToken();
  if (!token) return;

  let userData = null;
  const rawUser = window.localStorage.getItem(USER_KEY);
  if (rawUser) {
    try {
      userData = JSON.parse(rawUser);
    } catch (_) {}
  }

  chrome.storage.local.set({ authToken: token, userData, lastSync: Date.now() });
}

const account = detectAccountFromHost();
if (account) mergeDetected({ xAppAccount: account, origin: location.origin });

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "deskbee-helper") return;
  const info = event.data.info || {};
  const patch = {};
  if (info.xAppVersion) patch.xAppVersion = info.xAppVersion;
  if (info.xAppAccount) patch.xAppAccount = info.xAppAccount;
  if (info.plantId) patch.plantId = info.plantId;
  if (Object.keys(patch).length) mergeDetected(patch);
});

// The token may only appear after login, so check on load and periodically.
window.addEventListener("load", syncSession);
setInterval(syncSession, 30000);
window.addEventListener("storage", (e) => {
  if (e.key === TOKEN_KEY || e.key === USER_KEY) syncSession();
});
