(function () {
  "use strict";

  function applyDarkTheme() {
    document.documentElement.setAttribute("data-theme", "dark");

    try {
      localStorage.removeItem("mspromotion-theme");
    } catch (error) {
      // localStorage can be blocked by browser policy.
    }
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
    applyDarkTheme();
    initNavigation();
    setYear();
  });
})();
