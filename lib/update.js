// update.js — checks the latest GitHub release and flags the toolbar icon.
// Unpacked extensions don't auto-update, so this only notifies; the user downloads the zip.
import { GITHUB_REPO, RELEASES_URL } from "../config/constants.js";
import { isNewer } from "./version.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export const currentVersion = () => chrome.runtime.getManifest().version;

async function setBadge(available) {
  await chrome.action.setBadgeText({ text: available ? "1" : "" });
  if (available) await chrome.action.setBadgeBackgroundColor({ color: "#C1521C" });
}

/**
 * Returns { current, latest, url, available, checkedAt, error? }.
 * Uses the cached result for 24 h unless `force` is true.
 * error: "not_found" (no release / private repo) | "network".
 */
export async function checkForUpdate({ force = false } = {}) {
  const current = currentVersion();
  const { update } = await chrome.storage.local.get(["update"]);

  let result = update;
  if (force || !update || Date.now() - (update.checkedAt || 0) > DAY_MS) {
    result = { checkedAt: Date.now(), latest: update?.latest, url: update?.url || RELEASES_URL };
    try {
      const res = await fetch(API, { headers: { Accept: "application/vnd.github+json" } });
      if (res.status === 404) result.error = "not_found";
      else if (!res.ok) result.error = "network";
      else {
        const body = await res.json();
        result.latest = String(body.tag_name || "").replace(/^v/i, "");
        result.url = body.html_url || RELEASES_URL;
      }
    } catch (_) {
      result.error = "network";
    }
    await chrome.storage.local.set({ update: result });
  }

  const available = isNewer(result.latest, current);
  await setBadge(available);
  return { ...result, current, available };
}
