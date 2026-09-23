// Runs in <head> before the page paints: applies the saved theme so there is no flash.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    // Storage blocked (private mode): fall back to prefers-color-scheme.
  }
})();
