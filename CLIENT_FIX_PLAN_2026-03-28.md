# Client Fix Plan (Aligned With Backend Feedback)

Дата: **2026-03-28**  
Источник согласования: `/Users/rr/Downloads/FRONTEND_FIXES_2026-03-28.md`

## Цель

Закрыть только те задачи, которые действительно принадлежат фронту/BFF, и не смешивать их с backend-owned инцидентами (`500`, storage outage policy, runtime server logic).

## Согласованный scope frontend/BFF

1. `POST /api/requests` — починить canonical multipart proxy в BFF.
2. UI-обработка `503` для docs/certificate — показать корректную operational ошибку.
3. QA-процесс — не тестировать runtime actions только под built-in `root`, добавить persisted `administrator` как обязательного smoke actor.

---

## План работ

### P0. Requests multipart proxy (BFF)

**Проблема:** `POST /api/requests` может падать `400 Invalid JSON body` на BFF-слое при canonical multipart.

**Что делаем:**
1. В [`src/app/api/requests/route.ts`](/Users/rr/Desktop/Frontend/crm-front/src/app/api/requests/route.ts) включаем dual-mode обработку:
   - `application/json` -> текущий `proxyJsonPayloadAsMultipart` (legacy path);
   - `multipart/form-data` -> прямой `proxyToBackend` без `request.json()`.
2. Проверяем, что BFF:
   - не форсит `Content-Type` вручную;
   - не ломает `boundary`;
   - сохраняет `payload` как text part и `file` как file part.
3. Проверяем, что фронт-форма заявок отправляет canonical multipart (`payload + file`).

**Definition of Done:**
1. `POST /api/requests` с multipart проходит через BFF без `400 Invalid JSON body`.
2. Backend получает неизмененный multipart контракт.

---

### P0. UI handling для backend/infra `503` в file flows

**Проблема:** при storage outage пользователь должен видеть именно operational ошибку, а не generic/form validation.

**Что делаем:**
1. В error-handling мутаций файловых операций (`orders documents/certificate`):
   - для `503` показываем явное сообщение уровня инфраструктуры;
   - не помечаем это как validation error формы.
2. Для metadata-only certificate patch (`PATCH .../certificate` JSON) оставляем отдельный success-path и не считаем его эквивалентом file upload success.

**Основные точки:**
1. [`src/app/(app)/orders/[id]/page.tsx`](/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/[id]/page.tsx)
2. [`src/app/(app)/orders/page.tsx`](/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx)
3. [`src/shared/lib/errors.ts`](/Users/rr/Desktop/Frontend/crm-front/src/shared/lib/errors.ts)

**Definition of Done:**
1. Upload/download docs/certificate при `503` дают понятный operational toast/message.
2. Нет деградации в generic `500`/"невалидная форма".

---

### P1. QA checklist update (role coverage)

**Проблема:** `request-to-factory` под built-in `root` может вести себя иначе, чем под persisted admin.

**Что делаем:**
1. Обновляем smoke-чеклист:
   - actor A: built-in `root`;
   - actor B: persisted `administrator`.
2. Для runtime order actions фиксируем результаты отдельно по обоим акторам.

**Definition of Done:**
1. В acceptance и regression notes явно есть двухакторная проверка.

---

## Что не берем в frontend fix scope

1. `GET /orders/{id}` -> `500` (backend-owned).
2. Single/bulk order actions -> `500` (backend-owned).
3. Object storage outage как первопричина `503` (backend/infra-owned).
4. Политика `request-to-factory` для built-in superuser (backend-owned).

---

## Последовательность выполнения

1. Сделать P0 multipart proxy для `requests`.
2. Сделать P0 UI error handling для `503`.
3. Обновить QA checklist (P1).
4. После backend hotfix — прогнать повторный smoke и закрыть parity.
