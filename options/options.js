import { t, applyI18n, setupLangSwitch } from "../lib/i18n.js";
import { checkForUpdate } from "../lib/update.js";

function renderUpdate(info, { showStatus = false } = {}) {
  document.getElementById("update-versions").textContent = t("opt_installed_latest", {
    cur: info.current,
    latest: info.latest || t("opt_latest_unknown"),
  });
  const status = document.getElementById("update-status");
  status.textContent = "";
  status.className = "update-status";
  if (info.available) {
    status.innerHTML = `${t("update_available", { v: info.latest })} · <a href="${info.url}" target="_blank" rel="noopener">${t("update_download")}</a><br>${t("update_how")}`;
    status.classList.add("is-new");
  } else if (info.error && showStatus) {
    status.textContent = t(`opt_update_${info.error === "not_found" ? "not_found" : "network"}`);
  } else if (showStatus) {
    status.textContent = t("opt_up_to_date");
  }
}

const FIELDS = ["xAppAccount", "plantId", "xAppVersion"];

function flash(el, text, cls) {
  el.textContent = text;
  el.className = cls;
  setTimeout(() => {
    el.textContent = "";
    el.className = "";
  }, 3000);
}

async function load({ placeholdersOnly = false } = {}) {
  const { detected = {}, overrides = {}, settings = {} } = await chrome.storage.local.get([
    "detected",
    "overrides",
    "settings",
  ]);
  if (!placeholdersOnly) {
    document.getElementById("maxDaysAhead").value = settings.maxDaysAhead ?? 30;
  }
  for (const f of FIELDS) {
    const input = document.getElementById(f);
    if (!placeholdersOnly) input.value = overrides[f] || "";
    input.placeholder = detected[f] ? t("opt_detected", { v: detected[f] }) : t("opt_not_detected");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("options-form");
  const status = document.getElementById("status-message");

  applyI18n();
  setupLangSwitch();
  document.getElementById("version").textContent = t("opt_version_n", {
    v: chrome.runtime.getManifest().version,
  });
  document.getElementById("theme-toggle").addEventListener("click", () => window.deskbeeTheme.toggle());
  checkForUpdate().then((info) => renderUpdate(info)).catch(() => {});
  document.getElementById("check-updates").addEventListener("click", async (e) => {
    e.target.disabled = true;
    document.getElementById("update-status").textContent = t("opt_checking");
    const info = await checkForUpdate({ force: true });
    renderUpdate(info, { showStatus: true });
    e.target.disabled = false;
  });
  load();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.detected) load({ placeholdersOnly: true });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const overrides = {};
    for (const f of FIELDS) {
      const v = document.getElementById(f).value.trim();
      if (v) overrides[f] = f === "xAppAccount" ? v.toLowerCase() : v;
    }
    const settings = {
      maxDaysAhead: Math.max(0, Number(document.getElementById("maxDaysAhead").value) || 0),
    };
    await chrome.storage.local.set({ overrides, settings });
    flash(status, t("opt_saved"), "text-success");
  });

  document.getElementById("reset-options").addEventListener("click", async () => {
    await chrome.storage.local.remove(["overrides", "detected"]);
    await load();
    flash(status, t("opt_cleared"), "text-success");
  });
});
