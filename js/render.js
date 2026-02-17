(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(isoDate) {
    var date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }

    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function fetchJson(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) {
        throw new Error("Ошибка загрузки " + path);
      }
      return response.json();
    });
  }

  function renderEvents(selector) {
    var container = document.querySelector(selector);
    if (!container) {
      return;
    }

    var limit = Number(container.getAttribute("data-limit") || "6");

    fetchJson("data/events.json")
      .then(function (events) {
        var items = events.slice(0, limit);
        if (!items.length) {
          container.innerHTML = "<p class=\"empty\">Пока нет запланированных событий.</p>";
          return;
        }

        container.innerHTML = items
          .map(function (eventItem) {
            return "\n              <article class=\"card event-card\">\n                <div class=\"card-meta\">\n                  <span class=\"pill\">" + escapeHtml(eventItem.format || "Формат уточняется") + "</span>\n                  <time datetime=\"" + escapeHtml(eventItem.date) + "\">" + escapeHtml(formatDate(eventItem.date)) + "</time>\n                </div>\n                <h3>" + escapeHtml(eventItem.title) + "</h3>\n                <p>" + escapeHtml(eventItem.description || "") + "</p>\n                <p class=\"card-detail\">" + escapeHtml(eventItem.location || "") + "</p>\n                <a class=\"text-link\" href=\"" + escapeHtml(eventItem.link || "events.html") + "\">" + escapeHtml(eventItem.cta || "Подробнее") + "</a>\n              </article>\n            ";
          })
          .join("");
      })
      .catch(function () {
        container.innerHTML = "<p class=\"empty\">Не удалось загрузить события.</p>";
      });
  }

  function renderPromos(selector) {
    var container = document.querySelector(selector);
    if (!container) {
      return;
    }

    var limit = Number(container.getAttribute("data-limit") || "4");

    fetchJson("data/promos.json")
      .then(function (promos) {
        var items = promos.slice(0, limit);
        if (!items.length) {
          container.innerHTML = "<p class=\"empty\">Список акций пока пуст.</p>";
          return;
        }

        container.innerHTML = items
          .map(function (promo) {
            return "\n              <article class=\"card promo-card\">\n                <img src=\"" + escapeHtml(promo.image || "assets/img/promo-domik.jpg") + "\" alt=\"" + escapeHtml(promo.title) + "\" loading=\"lazy\" width=\"640\" height=\"360\">\n                <div class=\"promo-card-body\">\n                  <div class=\"card-meta\">\n                    <span class=\"pill\">" + escapeHtml(promo.badge || "Акция") + "</span>\n                    <span>" + escapeHtml(promo.period || "") + "</span>\n                  </div>\n                  <h3>" + escapeHtml(promo.title) + "</h3>\n                  <p>" + escapeHtml(promo.description || "") + "</p>\n                  <a class=\"text-link\" href=\"" + escapeHtml(promo.link || "promos.html") + "\">Открыть акцию</a>\n                </div>\n              </article>\n            ";
          })
          .join("");
      })
      .catch(function () {
        container.innerHTML = "<p class=\"empty\">Не удалось загрузить акции.</p>";
      });
  }

  function renderProjects(selector) {
    var container = document.querySelector(selector);
    if (!container) {
      return;
    }

    var limit = Number(container.getAttribute("data-limit") || "6");

    fetchJson("data/projects.json")
      .then(function (projects) {
        var ordered = projects.slice().sort(function (a, b) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        var items = limit > 0 ? ordered.slice(0, limit) : ordered;

        if (!items.length) {
          container.innerHTML = "<p class=\"empty\">Проекты пока не добавлены.</p>";
          return;
        }

        container.innerHTML = items
          .map(function (project) {
            var tags = Array.isArray(project.tags) ? project.tags : [];
            return "\n              <article class=\"card project-card\">\n                <img src=\"" + escapeHtml(project.image || "assets/img/event-pyaterochka.png") + "\" alt=\"" + escapeHtml(project.title) + "\" loading=\"lazy\" width=\"640\" height=\"420\">\n                <div class=\"project-card-body\">\n                  <div class=\"card-meta\">\n                    <time datetime=\"" + escapeHtml(project.date) + "\">" + escapeHtml(formatDate(project.date)) + "</time>\n                    <div class=\"tag-list\">" + tags.map(function (tag) {
                      return "<span class=\"tag\">" + escapeHtml(tag) + "</span>";
                    }).join("") + "</div>\n                  </div>\n                  <h3>" + escapeHtml(project.title) + "</h3>\n                  <p>" + escapeHtml(project.summary || "") + "</p>\n                  <a class=\"text-link\" href=\"" + escapeHtml(project.link || "projects.html") + "\">Смотреть кейс</a>\n                </div>\n              </article>\n            ";
          })
          .join("");
      })
      .catch(function () {
        container.innerHTML = "<p class=\"empty\">Не удалось загрузить проекты.</p>";
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderEvents("#events-list");
    renderPromos("#promos-list");
    renderProjects("#projects-list");
  });
})();
