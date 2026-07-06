# USER Wizard Delivery — отчёт о проделанной работе

Дата: 18.04.2026  
Ветка: `codex/order-create-backend-ui-20260408`  
Коммит: `2c34df2`  
Деплой: `84.47.150.248` (`/opt/crm-front`)

## 1) Что сделано

Реализован отдельный create-order wizard для роли `client` (USER) по PNG-макету при сохранении strict current API контракта для `POST /api/v1/client/orders`.

Основные изменения:
- В wizard оставлено 5 шагов:
  1. `Новый заказ`
  2. `Фабрика`
  3. `Данные заказа`
  4. `Товары`
  5. `Документы`
- Для `client` добавлена отдельная UI-ветка, не ломающая `manager/admin` flow.
- Обновлена логика step-валидации: для `client` валидируются только поля, которые реально отправляются в текущий client payload.
- UI-only поля отображаются и хранятся в форме, но не блокируют submit.

Файлы:
- `src/app/(app)/orders/page.tsx`
- `src/app/globals.css`

## 2) Что изменилось в интерфейсе (USER/client)

### Шаг 1 — Новый заказ
- `Компания` показывается read-only (из профиля/токена), UI-only.
- `Имя клиента` отображается как select, опционально, UI-only.
- `Инвойс на другую компанию`, `Название компании`, `Ваша внутренняя нумерация`, `Тип заказа` сохранены по макету.

### Шаг 2 — Фабрика
- Показаны `Самодоставка` + `Назначить экспедитора` в UI (UI-only для client).
- Рабочие поля для payload: `Страна`, `Фабрика`, `Адрес погрузки`, `Дата готовности`, `Вывоз От/До`.
- `Индекс`, `Город`, `Контакт`, `Телефон` — read-only UI.
- Блок `Контакты / Email / создать / Имя / Телефон` добавлен как UI-only до backend parity.

### Шаг 3 — Данные заказа
- Рабочие поля: `Номер инвойса`, `Валюта`, `Другая валюта`, `Сумма`, `Заявленный объем`, `Вес`, `Кол-во мест`.
- Добавлен видимый блок `Перемер / Взвешивание` как UI-only для client.
- `Ценовой коэффициент` и `Весовой коэффициент` рассчитываются и показываются read-only.

### Шаг 4 — Товары
- Рабочие поля: `goods_lines`, `Описание`, `Комментарий`, `Характеристики`.
- `Отметки офиса`, `1С`, `Оплата через компанию`, `Проверен`, `Оплачено компанией` показаны как UI-only для client.

### Шаг 5 — Документы
- Сохранён текущий flow документов (multipart, до 10 файлов).

## 3) Что отправляется в payload (strict current API)

Для `client` отправляется только текущий поддерживаемый набор:
- `order`: базовые поля create-flow (invoice/currency/amount/declared/additional_description/comment/raw_payload и т.д.)
- `factory_selection`: только `existing` (`factory_mode`, `country_id`, `factory_id`, `loading_address_id`)
- `goods_lines`
- `documents`

Не отправляется для `client` (даже если заполнено в UI):
- self-delivery/forwarder поля
- office marks/check/payment flags
- measurement/weighing UI
- email/contact create UI-блоки и прочие UI-only поля

## 4) Валидации и поведение

- Для `client` step-валидация ограничена отправляемыми полями.
- `invoice_on_other_company=true` => `invoice_company_name` обязателен.
- `client_goods_value_currency=OTHER` => обязателен `client_goods_value_currency_other_label`.
- Проверяется диапазон дат вывоза (`pickup_date_from <= pickup_date_to`).
- Если `goods_lines` пусты — обязателен `additional_description`.
- UI-only поля не блокируют переходы и submit.

## 5) Проверки качества

Локально перед релизом:
- `pnpm typecheck` — OK
- `pnpm lint` — OK
- `pnpm test` — OK (`9` test files, `25` tests)

## 6) Деплой

Выполнено:
- push ветки `codex/order-create-backend-ui-20260408`
- на сервере: `git fetch`, `git checkout`, `git pull --ff-only`
- `docker-compose -f docker-compose.server.yml --env-file .env.production up -d --build`

Особенность:
- `docker-compose` упал на известной ошибке `KeyError: 'ContainerConfig'`.
- Применён fallback:
  - удалён конфликтующий старый контейнер
  - выполнен `up -d --no-deps --force-recreate crm-front`

Итог:
- контейнер `crm-front` успешно пересоздан и запущен
- smoke-check после раскатки:
  - `GET /login` -> `200`
  - `GET /api/auth/me` без auth -> `401`

## 7) Результат

USER (client) wizard приведён к макету по структуре/порядку экранов и полей, при этом backend-контракт client create не расширен и остался совместимым с текущим API.
