(function () {
  "use strict";

  var THEME_KEY = "mspromotion-theme";
  var DEFAULT_THEME = "light";

  function setTheme(themeName) {
    var html = document.documentElement;
    html.setAttribute("data-theme", themeName);

    var options = document.querySelectorAll("[data-theme-option]");
    options.forEach(function (button) {
      var isActive = button.getAttribute("data-theme-option") === themeName;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("is-active", isActive);
    });

    var label = document.querySelector("[data-theme-label]");
    if (label) {
      var map = {
        light: "Вариант A: Светлый",
        dark: "Вариант B: Темный",
        minimal: "Вариант C: Минимализм"
      };
      label.textContent = map[themeName] || map.light;
    }

    try {
      localStorage.setItem(THEME_KEY, themeName);
    } catch (error) {
      // localStorage can be blocked by browser policy.
    }
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (error) {
      return null;
    }
  }

  function initThemeSwitcher() {
    var stored = getStoredTheme();
    var initial = stored || document.body.getAttribute("data-default-theme") || DEFAULT_THEME;

    setTheme(initial);

    var options = document.querySelectorAll("[data-theme-option]");
    options.forEach(function (button) {
      button.addEventListener("click", function () {
        var theme = button.getAttribute("data-theme-option");
        if (theme) {
          setTheme(theme);
        }
      });
    });
  }

  function initNavigation() {
    var menuButton = document.querySelector("[data-menu-toggle]");
    var navigation = document.querySelector("[data-main-nav]");

    if (menuButton && navigation) {
      menuButton.addEventListener("click", function () {
        var expanded = menuButton.getAttribute("aria-expanded") === "true";
        menuButton.setAttribute("aria-expanded", String(!expanded));
        navigation.classList.toggle("is-open", !expanded);
      });
    }

    var currentPage = document.body.getAttribute("data-page");
    if (!currentPage) {
      return;
    }

    var links = document.querySelectorAll("[data-nav-link]");
    links.forEach(function (link) {
      if (link.getAttribute("data-nav-link") === currentPage) {
        link.classList.add("is-current");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function setYear() {
    var yearNodes = document.querySelectorAll("[data-year]");
    var year = String(new Date().getFullYear());

    yearNodes.forEach(function (node) {
      node.textContent = year;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeSwitcher();
    initNavigation();
    setYear();
  });
})();
