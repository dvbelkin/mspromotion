# TODO / Недоработки

## 1) CMS авторизация в проде
- Не поднят OAuth auth-сервис для Decap CMS (`auth.ms-promotion.ru`).
- Вход через GitHub на проде сейчас не работает (`api.netlify.com/auth ... Not Found`).
- Временное решение: управление контентом через локальную версию админки.

## 2) Режим работы админки
- Сейчас фактический рабочий сценарий: запуск локально и редактирование через `local_backend`.
- Для полноценного прод-сценария нужно:
  - поднять OAuth endpoint;
  - обновить `public/admin/config.yml` (`base_url`, `auth_endpoint`);
  - проверить callback в GitHub OAuth App.

## 3) Деплой
- `deploy.ps1` работает по базовому сценарию выгрузки релиза, но сейчас без post-команд (без reload nginx).
- Очистка старых релизов временно отключена в скрипте, чтобы убрать падение bash-скрипта на сервере.

## 4) Nginx
- Нужно финально применить и проверить рабочий конфиг для:
  - корректной выдачи `/admin/index.html` и `/admin/config.yml`;
  - правильного `root` (или `current`, или единый каталог без симлинка);
  - отсутствия конфликтующих fallback/redirect правил для `/admin`.

## 5) Технический долг
- На сборке есть warning про duplicate id в `projects` (нужно отдельно разобрать источник и убрать).
- После фикса инфраструктуры CMS провести финальный smoke-check:
  - админка логинится;
  - создание/редактирование проекта;
  - коммит/публикация изменений;
  - отображение на проде.

## 6) Analytics (Yandex + Google)
- Add Yandex Metrika and Google Analytics 4 counters via a single layout component.
- Move counter IDs to environment/config variables (no hardcoded IDs in templates).
- Configure basic goals/events: form submit, phone click, contact page click.
- Add release checklist: counters are loaded on production and not duplicated.

## 7) Admin Access Protection
- Besides Decap OAuth, add server-level protection for `/admin`:
  - HTTP Basic Auth and/or IP allowlist;
  - `X-Robots-Tag: noindex, nofollow`;
  - rate-limit for `/admin` endpoints.
- Document final access workflow in README (who edits and who publishes).
