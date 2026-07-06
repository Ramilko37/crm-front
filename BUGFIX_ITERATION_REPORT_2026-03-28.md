# Bugfix Iteration Report — 2026-03-28

## Контекст итерации

Цель итерации: закрыть клиентские баги интеграции `crm-front` с `crm-backend` по `orders/requests` после prod smoke.

Период работ: 2026-03-28.

## Что было сделано

1. Исправлен BFF proxy для `POST /api/requests`:
   - добавлен корректный passthrough `multipart/form-data` без принудительного JSON-парсинга;
   - сохранен legacy-путь для JSON.
   - Файл: `src/app/api/requests/route.ts`.

2. Добавлен единый helper для file flow:
   - download с credentials и корректной обработкой `Content-Disposition`/`Content-Type`;
   - унифицированное сообщение для `503` от object storage.
   - Файл: `src/shared/lib/file-operations.ts`.

3. Обновлен модуль заявок (`/requests`):
   - create переведен на canonical multipart (`payload` + optional files);
   - добавлены поля `document_type` и `files`;
   - download документов заявки переведен на контролируемый handler;
   - улучшена обработка `503` в UI.
   - Файл: `src/app/(app)/requests/page.tsx`.

4. Обновлен file flow карточки заказа (`/orders/[id]`):
   - download документа и сертификата через новый helper;
   - корректное UI-сообщение при `503` вместо generic ошибки формы.
   - Файл: `src/app/(app)/orders/[id]/page.tsx`.

5. Обновлена документация QA smoke:
   - добавлен чеклист с обязательным разделением smoke actor-ов (`root` и persisted `administrator`);
   - добавлена ссылка в README.
   - Файлы: `QA_SMOKE_CHECKLIST.md`, `README.md`.

## Проверки и деплой

1. Локальные проверки:
   - `pnpm lint` — OK;
   - `pnpm typecheck` — OK;
   - `pnpm test` — OK (на момент выполнения кодовых фиксов).

2. Git:
   - `0cbb0db` — `fix: improve requests multipart proxy and file-flow 503 handling`;
   - `eaa7654` — `docs(qa): add prod smoke checklist for role coverage`.

3. Прод:
   - кодовые фиксы раскатаны и контейнер перезапущен;
   - health-check `/login` — `200`.

4. Повторный prod smoke:
   - под built-in `root` и persisted `administrator`;
   - ключевые ручки `orders/requests/chat` проходят;
   - `request-to-factory` при корректном body проходит (`200`) для обеих ролей.

## Статус багфикса на клиенте

Критичные клиентские баги этой итерации закрыты.

На клиенте осталось только необязательное улучшение качества:

1. Добавить автотест (integration/e2e) на `request-to-factory` с обязательным body, чтобы не регрессировать в `422`.
2. Добавить автотест на отображение `503` в file flows (`orders`/`requests`).
3. При необходимости удалить временного smoke-пользователя `smoke_admin_20260328` (операционный шаг, не баг фронта).

## Что не является клиентским багом

1. `503` object storage в upload/download — backend/infra зона ответственности.
2. Любые backend `500` на operational actions — backend зона ответственности.
