# Create-flow bugfix iteration report (2026-03-30)

## 1) Что было сделано на клиенте (`crm-front`)

### Контракт и BFF
- Переведены create-ручки на dual-mode (canonical `multipart/form-data` + legacy JSON fallback):
  - `POST /api/orders`
  - `POST /api/client/orders`
- Добавлены BFF-роуты для lookup/metadata:
  - `GET /api/orders/client-companies`
  - `GET /api/orders/create-metadata`
  - `GET /api/client/orders/create-metadata`
  - `GET /api/postcodes`
  - `GET /api/postcodes/[postcodeId]`
  - `GET /api/postcodes/[postcodeId]/cities`
  - `GET /api/postcodes/[postcodeId]/cities/[cityId]`
  - `GET /api/messenger-types`
  - `GET /api/client/countries`
  - `GET /api/client/postcodes`
  - `GET /api/client/postcodes/[postcodeId]/cities`
  - `GET /api/client/messenger-types`

### Адаптер payload
- Расширен orchestration-слой для полного create-контракта:
  - `order`
  - `factory_selection`
  - `goods_lines`
  - `documents`
- Актуализированы билдеры multipart payload для internal/client create.

### Типы
- Расширены shared-типы под metadata/lookup/create:
  - dictionary/postcode структуры
  - create metadata
  - client-companies lookup

### UI create-flow (internal/client)
- `orders` create переведен на metadata-driven поля (без hardcode-справочников).
- Добавлен request-branch: `order_type=request` отправляет в `/api/requests`.
- Добавлен выбор клиента через `client-companies` autocomplete.
- Реализованы existing/new factory ветки.
- Реализованы factory email select + add-email action.
- Реализовано inline создание postcode/city.
- Добавлены `goods_lines` и `documents` (до 10 файлов).
- Добавлены валидации:
  - `invoice_on_other_company => invoice_company_name required`
  - `self_delivery => self_delivery_forwarder_user_id required`
  - `goods_lines` empty => `additional_description required`
- Добавлен role-aware рендер ограниченных полей.

## 2) Тесты и локальная валидация
- Обновлены/добавлены тесты:
  - orchestration tests
  - API route tests для `orders` и `client/orders`
- Прогоны:
  - `pnpm typecheck` — OK
  - `pnpm lint` — OK
  - `pnpm test` — OK (21 passed)

## 3) Коммит и push
- Commit: `8f38ec8`
- Branch: `main`
- Message: `feat(create): sync create flow with backend metadata and multipart contracts`
- Push в `origin/main` выполнен.

## 4) Деплой на prod
- Сервер: `84.47.150.248`
- Каталог: `/opt/crm-front`
- Выполнено:
  - `git pull` до `8f38ec8`
  - пересборка и рестарт контейнера
  - проверка доступности фронта: `GET /login` -> `200 OK`

## 5) Prod smoke по create-сценариям
- Проверка фронтовых и backend create-related endpoint'ов на prod выявила backend runtime ошибки `500`.
- Повторно подтверждено прямыми вызовами в backend (`/api/v1/*`), включая:
  - `/api/v1/factories`
  - `/api/v1/orders/create-metadata`

## 6) Текущий статус
- Клиентская часть create-flow по плану внедрена и задеплоена.
- Дальнейший полноценный prod smoke по create блокируется backend `500` на ключевых справочниках/metadata.
