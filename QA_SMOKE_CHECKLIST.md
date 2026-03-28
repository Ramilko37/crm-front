# QA Smoke Checklist (Prod)

Дата актуализации: 2026-03-28

## Цель

Минимальный smoke-набор для релизов `crm-front`, синхронизированных с backend-contract по `orders` и `requests`.

## Обязательные smoke actors

1. Built-in `superuser` (`root`)  
2. Persisted пользователь с ролью `administrator`

Важно: до backend hotfix по `request-to-factory` нельзя считать smoke завершенным, если проверки выполнены только под `root`.

## Сценарии (root + persisted administrator)

1. `GET /api/orders` и рендер списка заказов.
2. `GET /api/orders/{id}` и рендер aggregate карточки заказа.
3. `POST /api/orders/{id}/chat-messages` (создание сообщения) и последующий `GET`.
4. `POST /api/orders/{id}/request-to-factory`:
   - зафиксировать фактическое поведение по каждой роли;
   - для `root` возможен backend-owned `403` с сообщением про persistent context.
5. `POST /api/requests` в canonical multipart (`payload` + optional file).
6. Upload/download по документам заказа и сертификату:
   - при `503` от storage UI должен показать operational сообщение;
   - нельзя отображать как validation/form error.

## Критерии прохождения

1. Нет frontend/BFF ошибок уровня `400 Invalid JSON body` в multipart сценарии `requests`.
2. Ошибки `503` в file flow отображаются как инфраструктурные, без маскировки под валидацию.
3. Runtime actions проверены минимум под двумя smoke actors: `root` и persisted `administrator`.
