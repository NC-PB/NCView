// Applies the theme before first paint so the window never flashes the wrong one.
// Uses the saved choice, otherwise follows the system setting.
(function () {
  var theme;
  try {
    theme = localStorage.getItem("theme");
  } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
