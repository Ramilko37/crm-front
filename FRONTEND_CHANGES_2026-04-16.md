# Frontend Changes — 2026-04-16

## Контекст

- Репозиторий: `crm-front`
- Ветка: `codex/order-create-backend-ui-20260408`
- Релизный коммит: `64f7354`
- Цель: Full TODO Order Refactor (`FRONTEND_TODO_ORDER_REFACTOR.md`) + раскатка на прод

## Что изменено в интерфейсе

### Модалка создания заказа (`/orders`)

1. Поле `Имя клиента` (`company_contact_id`) теперь обязательное для internal create.
2. Добавлены поля диапазона вывоза:
   - `Вывоз: От` -> `pickup_date_from`
   - `Вывоз: До` -> `pickup_date_to`
3. Добавлен режим контакта фабрики (XOR):
   - `Выбрать существующий контакт` -> `factory_contact_id`
   - `Создать контакт` -> `create_factory_contact` (`full_name`, `phone`, `email`)
4. Для режима `existing` поле `Email фабрики` (`email_id`) сделано обязательным.
5. Блок `Declared / Value` переименован в `Данные заказа` с RU-лейблами:
   - `Заявленный объем, м3`
   - `Вес, кг`
   - `Кол-во мест`
   - `Сумма`
   - `Валюта`
   - `Другая валюта`
6. Добавлен чекбокс `1С` (`is_1c`).
7. В блоке оплаты/проверки:
   - удалено legacy поле `Оплата фабрики через` (`factory_payment_via_label`)
   - добавлен чекбокс `Оплата через компанию` (`is_factory_payment_via_company`)
   - сохранен чекбокс `Оплачено компанией` (`is_factory_payment_completed`)
   - сохранен чекбокс `Проверен` (`is_checked`)

## Валидации и UX-обработка ошибок

Добавлены/усилены pre-submit проверки:

1. `company_contact_id` обязателен (internal).
2. `factory_mode` обязателен.
3. `invoice_on_other_company=true` требует `invoice_company_name`.
4. `self_delivery=true` требует `self_delivery_forwarder_user_id`.
5. Если `goods_lines` пустой, обязателен `additional_description`.
6. Для `client_goods_value_currency=OTHER` обязателен `client_goods_value_currency_other_label`.
7. Проверяется диапазон дат: `pickup_date_from <= pickup_date_to`.
8. Добавлен 422-мэппинг для новых полей:
   - `company_contact_id`
   - `email_id`
   - `pickup_date_from/pickup_date_to`
   - `factory_contact_id/create_factory_contact`
   - лимит документов

## Контракт и payload

### Обновления create-payload

В payload добавлены/используются:

- `pickup_date_from`
- `pickup_date_to`
- `is_1c`
- `is_factory_payment_via_company`
- `factory_contact_id`
- `create_factory_contact`

Удалено из create-flow:

- `factory_payment_via_label` (legacy)

### Обновления типов

В `src/shared/types/entities.ts` добавлены/обновлены типы для нового create-контракта:

- `FactoryContactCreatePayload`
- `FactorySelectionCreatePayload`
- `OrderCreatePayload`
- расширения в `OrderWritePayload` под новые поля

## BFF fallback (JSON -> multipart)

В `src/server/bff/orchestration.ts` синхронизированы билдеры:

- `buildInternalOrderMultipartPayload`
- `buildClientOrderMultipartPayload`

Теперь fallback учитывает новый shape и поля (включая даты вывоза, contact XOR, payment flag, `is_1c`).

## Тесты

Обновлены/добавлены тесты в:

- `src/server/bff/__tests__/orchestration.test.ts`

Новые кейсы покрывают:

1. Маппинг новых internal полей для JSON fallback.
2. XOR-кейс `create_factory_contact` для create-contact режима.

## Технический итог

Локальные проверки перед релизом:

- `pnpm typecheck` — OK
- `pnpm lint` — OK
- `pnpm test` — OK (`25 passed`)

Раскатка на сервер `84.47.150.248`:

- код обновлен в `/opt/crm-front` до `64f7354`
- контейнер `crm-front` пересобран и перезапущен
- smoke:
  - `http://84.47.150.248:3001/login` -> `200`
  - `http://84.47.150.248:3001/api/auth/me` -> `401` (ожидаемо без авторизации)
