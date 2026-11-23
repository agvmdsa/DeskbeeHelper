// theme.js — classic script loaded in <head> so the theme applies before first paint.
// Shared by popup and options (same extension origin, so localStorage is shared).
(() => {
  const KEY = "deskbee-theme";
  const root = document.documentElement;
  const normalize = (t) => (t === "dark" ? "dark" : "light"); // light (cream) is the default
  const apply = (t) => {
    root.dataset.theme = normalize(t);
  };

  apply(localStorage.getItem(KEY));

  window.deskbeeTheme = {
    get: () => root.dataset.theme,
    toggle() {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      apply(next);
      return next;
    },
  };

  // Keep an open options page / detached window in sync with a toggle elsewhere.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) apply(e.newValue);
  });
})();
