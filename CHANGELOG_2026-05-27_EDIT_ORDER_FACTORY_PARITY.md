# Changelog — Edit Order Factory Parity

Дата: 2026-05-27

## 1) Редактирование заказа: фабрики, адреса и контакты
- Блок `Фабрика` в редактировании готового заказа приведен к поведению формы создания заказа.
- Добавлен режим выбора фабрики:
  - `existing` — выбор существующей фабрики;
  - `create` — ручное добавление новой фабрики из формы редактирования заказа.
- В edit-flow добавлен сценарий ручного создания фабрики:
  - название фабрики;
  - название адреса;
  - адрес погрузки;
  - индекс;
  - город;
  - подтверждение создания фабрики перед фактическим POST.
- После создания фабрики автоматически создается адрес погрузки, форма переключается обратно в `existing`, а созданные `factory_id` и `loading_address_id` сразу выбираются в заказе.
- Добавлен быстрый modal `Новый адрес погрузки` для существующей фабрики в edit-flow.
- Контакты фабрики в edit-flow синхронизированы с create-flow:
  - `factory_contact_id` обязателен;
  - новый контакт создается через `/api/factories/{id}/contacts`;
  - после создания контакт автоматически выбирается;
  - email, имя и телефон контакта подставляются в форму и draft.

Файлы:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`
- `/Users/rr/Desktop/Frontend/crm-front/src/shared/lib/order-factory-selection.ts`
- `/Users/rr/Desktop/Frontend/crm-front/src/shared/lib/__tests__/order-factory-selection.test.ts`

## 2) Payload `factory_selection`
- Добавлен общий helper `buildOrderFactorySelectionPayload`.
- PATCH `/api/orders/{id}` теперь формирует `factory_selection` так же, как create-flow:
  - existing:
    - `factory_mode`
    - `country_id`
    - `factory_id`
    - `loading_address_id`
    - `factory_contact_id`
  - create:
    - `factory_mode`
    - `country_id`
    - `create_factory`
    - `factory_contact_id`
- Добавлены unit-тесты на оба сценария.

## 3) Read-only режим формы заказа
- Исправлены поля, которые оставались активными до нажатия `Редактировать`.
- Явные `disabled={...}` внутри edit-формы теперь учитывают `!isEditMode`.
- До режима редактирования заблокированы action-кнопки внутри формы:
  - добавить/изменить/удалить строку товара;
  - добавить/удалить документ;
  - добавить адрес фабрики;
  - добавить контакт фабрики;
  - переключить фабрику в ручное создание.
- Добавлен отдельный стиль `crm-order-edit-form-readonly`, чтобы read-only поля оставались читаемыми:
  - светлый фон;
  - темный текст;
  - нормальная opacity;
  - читаемые checkbox/select/date/input состояния.

Файлы:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`
- `/Users/rr/Desktop/Frontend/crm-front/src/app/globals.css`

## 4) Ant Design 6 deprecations
- `Drawer width` заменен на `Drawer size`:
  - mobile navigation drawer;
  - request details drawer;
  - company details drawer.
- `Space direction="vertical"` заменен на `Space orientation="vertical"` во всех app-экранах.

Файлы:
- `/Users/rr/Desktop/Frontend/crm-front/src/features/app-shell/app-shell.tsx`
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/requests/page.tsx`
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/companies/page.tsx`
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/*/page.tsx`

## 5) Fix loading-addresses 422
- В edit-flow запрос адресов фабрики больше не использует `page_size=500`.
- Значение приведено к create-flow: `page_size=200`.
- Это устраняет 422 на запросе вида:
  - `/api/factories/{factoryId}/loading-addresses?page=1&page_size=500`

Файл:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 6) Проверки
- `pnpm vitest run src/shared/lib/__tests__/order-factory-selection.test.ts` — passed.
- `pnpm test` — passed: 10 files, 27 tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- Browser smoke:
  - `/orders` рендерится на локальном dev server;
  - полный ручной edit-flow не пройден из-за отсутствия authenticated session.

## 7) Примечания
- В логах команд остается warning по Node engine:
  - проект ожидает `node >=20 <23`;
  - текущая среда: `node v25.8.1`.
- Warning не блокировал проверки: все перечисленные команды завершились успешно.
