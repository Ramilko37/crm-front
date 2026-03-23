# CRM Front — Backend Sync Update (2026-03-23)

## Выполнено

### 1) Контракты и типы
- Добавлены enum'ы: `OrderType`, `QuoteStatus`, `RequestStatus`.
- Расширены `Order` и `OrderFilterParams`:
  - `order_type`, `quote_status`, `order_types[]`, `quote_statuses[]`.
  - quote-поля (`quote_price_*`, `special_tariff_*`, `quote_*_at`, `factory_loading_address_id`).
- Добавлены сущности:
  - `Request`, `RequestFilterParams`.
  - `FactoryLoadingAddress`, `FactoryLoadingAddressWritePayload`.
  - `ClientFactoryListItem`, `ClientFactoryDetail`.
- Обновлен `queryKeys`:
  - `requests.list/detail/documents`.
  - `factories.loadingAddresses`.
  - `clientFactories.list/detail`.

### 2) BFF / Route Handlers
- Добавлены новые BFF-ручки:
  - `POST /api/client/orders`
  - `GET /api/client/factories`
  - `GET /api/client/factories/:factoryId`
  - `POST /api/orders/:orderId/quote-price`
  - `POST /api/orders/:orderId/quote-decision`
  - `GET/POST /api/requests`
  - `GET /api/requests/:requestId`
  - `GET /api/requests/:requestId/documents`
  - `GET/POST /api/factories/:factoryId/loading-addresses`
  - `PATCH/DELETE /api/factories/:factoryId/loading-addresses/:addressId`
  - `POST /api/factories/:factoryId/loading-addresses/:addressId/make-primary`
- `POST /api/orders` переведен на JSON -> multipart adapter.
- Добавлен adapter JSON -> multipart (`payload` field) для:
  - `orders create`
  - `client orders create`
  - `requests create`
- `proxyToBackend` переведен на binary-safe body forward (`arrayBuffer`) для корректной прокси multipart/binary payload.

### 3) Orders UI sync
- Добавлены фильтры `order_types` и `quote_statuses` (с URL-state и repeat-key поддержкой).
- В таблицу добавлены колонки: `Тип заказа`, `Статус квоты`.
- Добавлены actions:
  - `Выставить цену` (`/quote-price`) для `administrator/manager/superuser`.
  - `Решение по квоте` (`/quote-decision`) для `client`.
- Обновлен create flow:
  - internal create: `company_id`, `ready_date`, `order_type`, `factory_id`, `loading_address_id`.
  - client create: отдельный role-aware create через `/api/client/orders`.
- Добавлена загрузка loading-addresses при выборе фабрики и валидация отсутствия адресов.

### 4) Requests модуль
- Добавлена новая страница `/requests`.
- Реализовано:
  - list + pagination + сортировка
  - фильтр по `status`
  - create request (через multipart adapter)
  - detail drawer + `documents` list
- Модуль добавлен в top-nav и RBAC visibility.

### 5) Factories sync
- В resources-модалке добавлен таб `Адреса загрузки`:
  - list/create/edit/delete
  - `make-primary`
- После операций делается invalidate списка адресов и общего списка фабрик.

### 6) RBAC/Nav
- Расширен `AppModule` модулем `requests`.
- Обновлена логика доступа и видимости меню для `requests` (administrator/manager/superuser).

## Тесты и валидация
- `pnpm lint` — OK
- `pnpm typecheck` — OK
- `pnpm test` — OK (добавлены unit-тесты для orchestration payload builders)
- `pnpm build` — OK

## Ограничения релиза
- Upload файлов в create flows пока не включен (в multipart передается только `payload` JSON).
