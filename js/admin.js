(function () {
  "use strict";

  var state = {
    projects: []
  };

  var form = document.querySelector("#project-form");
  var preview = document.querySelector("#project-preview");
  var list = document.querySelector("#projects-admin-list");
  var downloadButton = document.querySelector("#download-projects");
  var statusNode = document.querySelector("#admin-status");

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message, isError) {
    if (!statusNode) {
      return;
    }

    statusNode.textContent = message;
    statusNode.classList.toggle("is-error", Boolean(isError));
  }

  function renderList() {
    if (!list) {
      return;
    }

    if (!state.projects.length) {
      list.innerHTML = "<p class=\"empty\">Список пока пуст.</p>";
      return;
    }

    list.innerHTML = state.projects
      .slice()
      .sort(function (a, b) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .map(function (project, index) {
        var tags = Array.isArray(project.tags) ? project.tags.join(", ") : "";
        return "\n          <article class=\"admin-item\">\n            <div>\n              <p class=\"admin-item-index\">#" + (index + 1) + "</p>\n              <h3>" + escapeHtml(project.title) + "</h3>\n              <p>" + escapeHtml(project.summary || "") + "</p>\n              <p class=\"admin-item-meta\">" + escapeHtml(project.date || "") + (tags ? " · " + escapeHtml(tags) : "") + "</p>\n            </div>\n            <a class=\"text-link\" href=\"" + escapeHtml(project.link || "projects.html") + "\">Ссылка</a>\n          </article>\n        ";
      })
      .join("");
  }

  function getFormData() {
    var data = new FormData(form);
    var title = String(data.get("title") || "").trim();
    var summary = String(data.get("summary") || "").trim();
    var date = String(data.get("date") || "").trim();
    var tags = String(data.get("tags") || "")
      .split(",")
      .map(function (tag) {
        return tag.trim();
      })
      .filter(Boolean);
    var image = String(data.get("image") || "").trim();
    var link = String(data.get("link") || "projects.html").trim();

    return {
      title: title,
      summary: summary,
      date: date,
      tags: tags,
      image: image,
      link: link
    };
  }

  function renderPreview(project) {
    if (!preview) {
      return;
    }

    if (!project.title) {
      preview.innerHTML = "<p class=\"empty\">Начните вводить данные, чтобы увидеть карточку проекта.</p>";
      return;
    }

    var tags = project.tags || [];

    preview.innerHTML = "\n      <article class=\"card project-card\">\n        <img src=\"" + escapeHtml(project.image || "assets/img/event-pyaterochka.png") + "\" alt=\"" + escapeHtml(project.title) + "\" loading=\"lazy\" width=\"640\" height=\"420\">\n        <div class=\"project-card-body\">\n          <div class=\"card-meta\">\n            <time datetime=\"" + escapeHtml(project.date || "") + "\">" + escapeHtml(project.date || "дата не указана") + "</time>\n            <div class=\"tag-list\">" + tags.map(function (tag) {
              return "<span class=\"tag\">" + escapeHtml(tag) + "</span>";
            }).join("") + "</div>\n          </div>\n          <h3>" + escapeHtml(project.title) + "</h3>\n          <p>" + escapeHtml(project.summary || "") + "</p>\n        </div>\n      </article>\n    ";
  }

  function downloadJson() {
    var payload = JSON.stringify(state.projects, null, 2);
    var blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");

    a.href = url;
    a.download = "projects.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus("Файл projects.json сформирован. Загрузите его и замените data/projects.json на сервере.");
  }

  function handleSubmit(event) {
    event.preventDefault();

    var data = getFormData();

    if (!data.title || !data.summary || !data.date) {
      setStatus("Заполните обязательные поля: название, описание и дата.", true);
      return;
    }

    var id = "project-" + slugify(data.title) + "-" + data.date;

    state.projects.push({
      id: id,
      title: data.title,
      summary: data.summary,
      date: data.date,
      tags: data.tags,
      image: data.image || "assets/img/event-pyaterochka.png",
      link: data.link || "projects.html"
    });

    renderList();
    renderPreview(data);
    form.reset();
    setStatus("Проект добавлен в локальный список. Нажмите «Скачать обновленный projects.json»." );
  }

  function bindPreviewListeners() {
    if (!form) {
      return;
    }

    form.addEventListener("input", function () {
      renderPreview(getFormData());
    });
  }

  function loadProjects() {
    return fetch("data/projects.json")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Не удалось загрузить projects.json");
        }
        return response.json();
      })
      .then(function (projects) {
        state.projects = Array.isArray(projects) ? projects : [];
        renderList();
        renderPreview({ title: "" });
      })
      .catch(function () {
        state.projects = [];
        renderList();
        setStatus("Не удалось загрузить текущие проекты. Можно начать с пустого списка.", true);
      });
  }

  if (!form) {
    return;
  }

  form.addEventListener("submit", handleSubmit);
  if (downloadButton) {
    downloadButton.addEventListener("click", downloadJson);
  }

  bindPreviewListeners();
  loadProjects();
})();
