# CRM Front Roadmap (REPORT.md alignment)

## 1. Готово в MVP (backend API уже есть)

- Auth: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Orders: list/get/create/update/status/assign-trip
- Factories: list/get/create/update
- Trips: list/get/create/update

## 2. Что осознанно не входит в MVP

- Users
- PathPoints UI management
- Settings (emails/news/normative/countries)
- News/Normative public sections
- Documents, chat, uploads, Excel export

## 3. Фаза 2 (после расширения backend API)

- Users module and role-driven screens
- Path points CRUD and trip point editor
- Settings screens and templates
- News/Normative modules
- File uploads, chat, export workflows
- Full i18n RU/EN/IT

## 4. Принципы расширения

- Сначала API readiness, затем UI module
- URL-state и query-контракт всегда соответствуют backend
- Каждая новая фича поставляется с unit + integration + e2e smoke
