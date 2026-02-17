# MS Promotion - Modern Replatform (Astro + Tailwind + Decap CMS)

Новый вариант сайта выполнен на стеке **B**:

- **Astro** (мультистраничная архитектура, высокая скорость)
- **Tailwind CSS** (дизайн-система и компонентный UI)
- **Decap CMS** (контент в Git, редактирование в браузере)

Визуальная логика: современный agency-стиль с темной темой по умолчанию, glow-фонами, крупным hero и приоритетом секций **События** и **Магазинные акции**.

## Что сделано

- Новый единый layout и UI-компоненты.
- Главная страница с четкой иерархией:
  1. Hero
  2. Metrics
  3. Client logos
  4. Ближайшие события
  5. Акции
  6. Проекты
  7. Услуги
  8. Преемственность
- Маршруты:
  - `/events` и `/events/[slug]`
  - `/promos` и `/promos/[slug]`
  - `/projects` и `/projects/[slug]`
  - `/history`, `/services`, `/contact`
- Фильтр по тегам на `/projects`.
- Темная тема по умолчанию + переключатель на светлую (localStorage).
- Decap CMS:
  - `/admin` (редирект на `/admin/index.html`)
  - коллекции `events`, `promos`, `projects`, `pages`
- URL-совместимость через редиректы (`astro.config.mjs` + `public/_redirects`).
- Seed-данные для событий, акций и проектов.
- Легаси-материалы сохранены в `public/legacy`.

## Структура

- `src/layouts/BaseLayout.astro`
- `src/components/*`
- `src/pages/index.astro`
- `src/pages/events/*`
- `src/pages/promos/*`
- `src/pages/projects/*`
- `src/pages/history.astro`
- `src/pages/services.astro`
- `src/pages/contact.astro`
- `src/content/events/*.md`
- `src/content/promos/*.md`
- `src/content/projects/*.md`
- `src/content/pages/*.md`
- `public/admin/index.html`
- `public/admin/config.yml`
- `scripts/import-legacy-json.mjs`

## Запуск локально

```bash
npm install
npm run dev
```

Сайт: `http://localhost:4321`

Проверка типов/контента:

```bash
npm run check
```

Сборка:

```bash
npm run build
npm run preview
```

## Decap CMS

### Прод

- CMS находится по `/admin`.
- В `public/admin/config.yml` используется `github`.
- Для Netlify/Vercel/GitHub setup нужно включить GitHub OAuth или совместимую авторизацию.

### Локальная работа с CMS (опционально)

Запустить локальный proxy-сервер Decap:

```bash
npx decap-server
```

И параллельно dev-сервер Astro:

```bash
npm run dev
```

## Миграция контента из легаси

### Вариант 1 (рекомендуется): ручная редактура через CMS

- Добавляйте материалы через `/admin` в коллекции.
- Для публикации обязательно ставьте `status: published`.

### Вариант 2: полуавтоматический импорт из старых JSON

Скрипт читает:

- `data/events.json`
- `data/promos.json`
- `data/projects.json`

И генерирует markdown-файлы.

Dry-run в `migrations/generated`:

```bash
npm run migrate:legacy
```

Запись напрямую в `src/content/*`:

```bash
node scripts/import-legacy-json.mjs --write
```

## Доступность и производительность

- Контрастная палитра для dark/light.
- Видимые focus-стили (`focus-outline`).
- Клавиатурная навигация по меню и контролам.
- `prefers-reduced-motion` учитывается в глобальных стилях.
- Изображения в карточках с `loading="lazy"`.

## Совместимость URL

Добавлены редиректы для старых ссылок, включая:

- `/index.html` -> `/`
- `/cases.html` -> `/projects`
- `/events.html` -> `/events`
- `/promos.html` -> `/promos`
- `/app/bussinessevent.html` -> `/events`
- `/app/eventmarketing.html` -> `/promos`

## Скриншотный чек-лист перед выкладкой

1. **Desktop (1440px)**: hero, сетки карточек, hover/focus состояния.
2. **Tablet (768px)**: мобильное меню, отступы, читаемость карточек.
3. **Mobile (375px)**: кнопки CTA, фильтры `/projects`, отсутствие горизонтального скролла.
4. **Forms/CMS**: вход в `/admin`, создание тестовой записи, проверка отображения на сайте.
5. **SEO**: title/description на главной и внутренних страницах, корректные URL.
6. **404**: переход на несуществующий путь, корректная страница ошибки.
7. **Redirects**: проверка старых URL на переходы в новые разделы.
8. **Performance**: Lighthouse quick pass (LCP/CLS/INP), размер изображений и lazy-loading.

## Деплой

Подойдет любой статический хостинг (Netlify, Vercel, Cloudflare Pages и т.д.).

Build command:

```bash
npm run build
```

Publish directory:

```bash
dist
```

Для корректной работы редиректов используйте `public/_redirects` (Netlify-совместимый формат).


## GitHub OAuth setup

1. Create a GitHub OAuth App.
2. Set callback URL to your Decap auth endpoint (for Netlify: `https://<your-site>.netlify.app/admin/`).
3. In Decap config set:
   - `backend.name: github`
   - `backend.repo: dvbel/mspromotion`
   - `backend.branch: main`
4. If you are not using Netlify Auth Provider, set up an OAuth proxy and configure `base_url` + `auth_endpoint` in `public/admin/config.yml`.
