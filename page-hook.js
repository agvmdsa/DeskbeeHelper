// page-hook.js
//
// Runs in the page's own JS world (MAIN) on *.deskbee.app.
// Observes the requests the Deskbee web app makes to api.deskbee.io and
// reports the values the extension needs (app version, account, floor UUID).
// It never changes requests and sends nothing anywhere except to content.js
// via window.postMessage.

(() => {
  const API_HOST = "api.deskbee.io";
  // The web app uses /app/plant/<uuid>/places; the public API uses /api/plant/<uuid>/places.
  const PLANT_RE = /\/(?:api|app)\/plant\/([0-9a-f-]{36})\/places/i;

  function report(url, headers) {
    try {
      const u = new URL(url, location.href);
      if (u.hostname !== API_HOST) return;

      const info = {};
      const m = u.pathname.match(PLANT_RE);
      if (m) info.plantId = m[1];

      for (const [k, v] of Object.entries(headers || {})) {
        const key = k.toLowerCase();
        if (key === "x-app-version") info.xAppVersion = v;
        if (key === "x-app-account") info.xAppAccount = v;
      }

      if (Object.keys(info).length) {
        window.postMessage({ source: "deskbee-helper", info }, location.origin);
      }
    } catch (_) {
      // ignore malformed URLs
    }
  }

  function headersToObject(h) {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return { ...h };
  }

  // fetch
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = input instanceof Request ? input.url : String(input);
      const headers = {
        ...(input instanceof Request ? headersToObject(input.headers) : {}),
        ...headersToObject(init && init.headers),
      };
      report(url, headers);
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };

  // XMLHttpRequest (axios)
  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__dbhUrl = url;
    this.__dbhHeaders = {};
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__dbhHeaders) this.__dbhHeaders[k] = v;
    return origSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__dbhUrl) report(this.__dbhUrl, this.__dbhHeaders);
    return origSend.apply(this, arguments);
  };
})();
