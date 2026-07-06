# Backend Fixes Required (Prod Smoke)

Дата прогона: **2026-03-28**  
Среда: `production` (`http://84.47.150.248:3001`, BFF `Next.js /api/*`)  
Пользователь: built-in `superuser` (`root`)

## TL;DR

На проде фронт синхронизирован и новые маршруты доступны, но есть backend-блокеры, из-за которых parity по `orders`/`requests` не достигается:

1. `GET /orders/{id}` падает `500` и ломает карточку заказа.
2. Большинство operational action-ручек по заказу и bulk падают `500`.
3. Файловые операции (upload/download docs/certificate) падают `503` из-за недоступного object storage.
4. `POST /requests` (multipart) возвращает `400 Invalid JSON body` при валидном `payload` в canonical формате.
5. `request-to-factory` для built-in `superuser` возвращает `403 Persistent user context is required...` и блокирует сценарий.

---

## 1) Критический блокер: Order detail

### Endpoint
- `GET /api/orders/{id}` (через BFF)
- backend-контракт: `GET /api/v1/orders/{order_id}`

### Факт
- Ответ: `500 Internal Server Error`
- UI эффект: страница `/orders/1` показывает `HTTP 500`, карточка не работает.

### Ожидание
- `200` с aggregate detail по контракту (`client`, `factory`, `goods_lines`, `status_history`, `chat_messages`, `documents`, `certificate`, derived fields).

### Приоритет
- **P0** (блокирует основной orders detail flow).

---

## 2) Критический блокер: Order operational actions (single + bulk)

### Endpoints (через BFF)
- `POST /api/orders/{id}/assign-forwarder`
- `POST /api/orders/{id}/pickup-date`
- `POST /api/orders/{id}/cancel-pickup`
- `POST /api/orders/{id}/special-tariff`
- `POST /api/orders/bulk/pickup-date`
- `POST /api/orders/bulk/cancel-pickup`
- `POST /api/orders/bulk/special-tariff`

### Факт
- Для корректных payload (по `API_USAGE.md`) ответы: `500 Internal Server Error`.

### Ожидание
- `200`/успешный ответ и обновление данных заказа(ов).
- В случае бизнес-ограничений: контролируемый `422`, а не `500`.

### Приоритет
- **P0** (срывает ключевые действия из списка/массовых операций).

### Проверенные payload (корректные по контракту)
- assign-forwarder: `{ "assigned_forwarder_user_id": null }`
- pickup-date: `{ "pickup_date": "2026-03-30" }`
- special-tariff: `{ "amount": "123.00", "currency": "EUR" }`
- bulk pickup-date: `{ "order_ids": [1], "pickup_date": "2026-03-30" }`
- bulk cancel-pickup: `{ "order_ids": [1] }`
- bulk special-tariff: `{ "order_ids": [1], "amount": "77.00", "currency": "EUR" }`

---

## 3) Blocker: Object storage unavailable (docs/certificate)

### Endpoints (через BFF)
- `POST /api/orders/{id}/documents` (multipart `payload + file`) -> `503`
- `GET /api/orders/{id}/documents/{document_id}/download` -> `503`
- `PATCH /api/orders/{id}/certificate` (multipart) -> `503`
- `GET /api/orders/{id}/certificate/download` -> `503`

### Ошибки
- `Object storage bucket is unavailable`
- `Failed to download file from object storage`

### Ожидание
- Upload: успешное сохранение файла и metadata.
- Download: бинарная выдача файла (`attachment`).

### Приоритет
- **P0** для файловых сценариев (docs/certificate parity недостижим).

### Примечание
- `PATCH /api/orders/{id}/certificate` в metadata-only JSON режиме работает (`200`), проблема именно в file/object-storage контуре.

---

## 4) Blocker: Requests create (multipart canonical)

### Endpoint
- `POST /api/requests` (через BFF)
- backend-контракт: `POST /api/v1/requests` (`multipart/form-data`, обязательный `payload`)

### Факт
- Ответ: `400 Invalid JSON body` при передаче `payload` JSON строкой и `file`.

### Ожидание
- Успешное создание request (`201`/`200`) в canonical multipart-контракте.

### Приоритет
- **P1** (ломает requests parity с документами).

---

## 5) Access/context issue: request-to-factory

### Endpoint
- `POST /api/orders/{id}/request-to-factory`

### Факт
- Ответ: `403 Persistent user context is required for request-to-factory action`
- Ошибка воспроизводится для built-in `superuser` (`root`).

### Ожидание
- По роли и документации сценарий должен быть доступен (`administrator/manager/logist/superuser`) либо должна быть четко зафиксирована отдельная политика для built-in superuser.

### Приоритет
- **P1** (блокирует действие в runtime для части учёток).

---

## Что работает (для разделения зоны ответственности)

1. `GET /api/orders` -> `200`
2. `GET /api/orders/client-messages` -> `200`
3. `GET /api/orders/{id}/chat-messages` -> `200`
4. `POST /api/orders/{id}/chat-messages` -> `201`
5. `PATCH /api/orders/{id}/certificate` (JSON metadata-only) -> `200`
6. UI quick-tabs/filters и новые модули (`/client-messages`, `/requests`) рендерятся.

---

## Repro (коротко)

1. Логин в CRM prod под `root`.
2. Открыть `/orders/1` -> `HTTP 500`.
3. На `/orders` выполнить actions (single/bulk) -> `500`.
4. Выполнить upload/download docs/certificate -> `503` object storage.
5. Вызвать `POST /api/requests` multipart -> `400 Invalid JSON body`.

---

## Артефакты UI

1. Список заказов: `var/folders/79/mmyd13f10px_4f6vb__s9b_w0000gn/T/playwright-mcp-output/1774686574269/page-2026-03-28T08-35-34-925Z.png`
2. Карточка заказа с `HTTP 500`: `var/folders/79/mmyd13f10px_4f6vb__s9b_w0000gn/T/playwright-mcp-output/1774686574269/page-2026-03-28T08-35-50-552Z.png`
3. Модуль сообщений: `var/folders/79/mmyd13f10px_4f6vb__s9b_w0000gn/T/playwright-mcp-output/1774686574269/page-2026-03-28T08-35-58-206Z.png`
4. Модуль заявок: `var/folders/79/mmyd13f10px_4f6vb__s9b_w0000gn/T/playwright-mcp-output/1774686574269/page-2026-03-28T08-36-06-136Z.png`
