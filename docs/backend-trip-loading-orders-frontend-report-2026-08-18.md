# Отчёт для backend: добавление заказов в рейс

Дата: 2026-08-18  
Задачи: `WPT-CHK-01`, `WPT-CHK-02`, `WPT-OVR-01`, `WPT-HIS-01`

## Статус frontend

Frontend адаптирован под контракт из `TRIP_LOADING_ORDERS.md`.

Реализовано:

- обязательный `preview → confirm` для одиночного и массового назначения;
- снятие с рейса без preview и confirmation token;
- принудительное назначение после eligibility-отказа preview;
- обязательная причина принудительного назначения длиной до 2000 символов;
- force-действие только для `administrator`, `manager`, `superuser`;
- отображение `trip_assigned_via_override` в списке заказов, карточке заказа и списке заказов рейса;
- отображение `event_type` и `waypoint_name` в истории заказа;
- fallback события: `event_type → field_name → comment`;
- редактирование `comment` / `status_date` истории только для `administrator`, `manager`, `superuser`;
- актуальные тексты ошибок backend без старого `order-trip-source-mismatch`;
- инвалидация списка заказов, карточки, истории и затронутых рейсов после назначения или снятия.

## Используемые endpoints

### Одиночное назначение

```http
POST /api/v1/orders/{order_id}/assign-trip/preview
Content-Type: application/json

{ "trip_id": 15 }
```

После подтверждения:

```http
POST /api/v1/orders/{order_id}/assign-trip
Content-Type: application/json

{
  "trip_id": 15,
  "confirmation_token": "<token из preview>"
}
```

### Массовое назначение

```http
POST /api/v1/orders/bulk/assign-trip/preview
Content-Type: application/json

{
  "order_ids": [101, 102],
  "trip_id": 15
}
```

После подтверждения frontend отправляет тот же набор `order_ids`, тот же `trip_id` и token из preview:

```http
POST /api/v1/orders/bulk/assign-trip
Content-Type: application/json

{
  "order_ids": [101, 102],
  "trip_id": 15,
  "confirmation_token": "<token из preview>"
}
```

### Принудительное назначение

Force предлагается только после одного из eligibility-отказов:

- `Order location is not on the trip route`;
- `Trip has already left ...`;
- `Trip ... is already finished`;
- `Order status does not allow loading`;
- `Order is already assigned to active trip ...`.

Single payload:

```json
{
  "trip_id": 15,
  "force": true,
  "force_reason": "Согласованное исключение"
}
```

Bulk payload дополнительно содержит `order_ids`. `confirmation_token` при force не отправляется.

### Снятие с рейса

```json
{ "trip_id": null }
```

Для bulk дополнительно отправляется `order_ids`. Preview и token не используются.

### Редактирование истории

```http
PATCH /api/v1/orders/{order_id}/status-history/{history_id}
Content-Type: application/json
```

Frontend отправляет хотя бы одно поле:

```json
{ "comment": "Исправленный комментарий" }
```

или:

```json
{ "status_date": "2026-08-10" }
```

## Поля, ожидаемые frontend

Во всех представлениях заказа, включая список заказов рейса:

```ts
trip_id: number | null;
trip_name?: string | null;
trip_assigned_via_override: boolean;
```

В элементах `status_history`:

```ts
event_type: string | null;
waypoint_name: string | null;
field_name: string | null;
comment: string | null;
changed_by_user_id: number | null;
created_at: string | null;
```

## Обработка ошибок

Frontend ожидает строковый `detail` и показывает пользователю конкретную причину. Поддержаны:

- `Order location is not on the trip route`;
- `Trip has already left ...`;
- `Trip ... is already finished`;
- `Order status does not allow loading`;
- `Order is already assigned to active trip ...`;
- ошибки required/expired/invalid/mismatched `confirmation_token`;
- ошибки `force_reason`, force при `trip_id: null`;
- `Trip with id=... does not exist`;
- `403 Insufficient permissions`.

## Что просим проверить на backend

1. Preview не изменяет данные и возвращает полный payload вместе с `confirmation_token` и `expires_in_sec`.
2. Confirm проверяет соответствие token заказу, рейсу и полному bulk-набору.
3. Bulk preview/confirm атомарны.
4. Force доступен только `administrator`, `manager`, `superuser`.
5. После force во всех ответах и списках возвращается `trip_assigned_via_override: true`.
6. После обычного назначения и снятия с рейса флаг становится `false`.
7. В истории создаются `trip_assigned`, `trip_assigned_override`, `trip_unassigned` с корректными `field_name`, `waypoint_name` и `comment`.
8. PATCH истории проверяет принадлежность `history_id` заказу и роли пользователя.
9. Все перечисленные ошибки возвращаются в формате `{ "detail": "..." }` с согласованными строками.

## Не реализовывалось на frontend

В соответствии с текущим backend-контрактом frontend не ожидает и не отображает:

- подтверждённое физическое местоположение заказа;
- остаток вместимости рейса по весу или объёму;
- автоматические события прибытия, подтверждения, погрузки и выбытия.

## Проверка frontend

- TypeScript: успешно;
- ESLint: успешно;
- Vitest: 27 файлов, 134 теста — успешно;
- Next.js production build: успешно.

Интеграционная проверка с реальным backend API в рамках этой работы не выполнялась.
