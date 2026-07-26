# Changelog

## 2026-07-26

### Orders / Documents
- Добавлен frontend draft UI для ORD-DOC-01: drag & drop и выбор нескольких файлов, список документов, удаление, переименование, комментарии, индивидуальная и массовая классификация типов.
- Документы сохраняются в draft формы при навигации между шагами; повторная загрузка того же файла помечается предупреждением без удаления остальных файлов.
- Для документов в create/edit payload теперь используется пользовательское `display_name`, если оно задано.
- Добавлена backend-спецификация для полноценной поддержки ORD-DOC-01: `docs/backend-order-documents-bulk-upload-spec.md`.

### Проверки
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

## 2026-07-08

### Users / Forwarder Contract
- Фронт переведен на обновленный user flow из `FROWARDER.md`: `role_name` остается единственным role-полем, legacy `is_logist` больше не читается и не отправляется в user create/update/profile payload.
- Для `role_name = "forwarder"` в admin create/edit и self-service profile edit теперь обязательны строковые поля `country`, `city`, `address`.
- В user create/edit payload добавлен `address`; `country_id`, `city_id` и frontend-only `selectedCountryId` в backend user endpoints не отправляются.
- Поле `personal_manager_id` в user form теперь выбирается через lookup активных менеджеров:
  - frontend BFF: `GET /api/users/lookups/managers`
  - backend target: `GET /api/v1/users/lookups/managers`
- Для выбора адреса экспедитора добавлены BFF proxy:
  - `GET /api/users/lookups/cities` -> `GET /api/v1/users/lookups/cities`
  - страны продолжают идти через `GET /api/countries` -> `GET /api/v1/countries`
- City lookup вызывается только после выбора страны; в финальный save payload попадают только строковые значения `country`, `city`, `address`.

### Проверки
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/eslint` по измененным source/test файлам
- `./node_modules/.bin/vitest run src/shared/lib/__tests__/user-flow.test.ts src/app/api/__tests__/contract-routes.test.ts src/shared/lib/__tests__/trip-point-forms.test.ts`

## 2026-05-22

### Edit Order (`/orders/[id]`)
- Разделена загрузка стран для create/edit (`createCountriesQuery`, `editCountriesQuery`), чтобы edit-форма не зависела от create-состояния.
- Для поля `Страна` в edit добавлен стабильный reset-пайплайн зависимых полей: фабрика, адрес погрузки, индекс/город, контакт фабрики, адресные и контактные derived-поля.
- Исправлен порядок полей экспедитора в блоке `Фабрика`:
  - `Назначить экспедитора` (основной)
  - `Экспедитор для самодоставки` (условно при `self_delivery=true`)
- Для `goods_lines` в edit добавлена явная регистрация поля формы (`Form.List name="goods_lines"`), чтобы строки товара корректно сохранялись/наблюдались и не пропадали.
- Добавлен quality-pass выпадающих списков в edit: `loading`, `notFoundContent`, `disabled` и человекочитаемые label для company/contact, forwarder, country/factory/address/postcode/city, certificate intent, trip, document type.
- Добавлен confirm при нажатии `Отмена` в footer при несохраненных изменениях:
  - текст: `Уверены, что хотите отменить изменения?`
  - `Да` — сброс draft + reset формы
  - `Нет` — продолжение редактирования

### Не изменялось (подтверждено)
- `order_date` остается read-only и берется из данных заказа.
- `actual_volume_m3` и `actual_weight_kg` показываются только при `completed` соответствующих статусов.
- История статусов/чат в левой части edit не рендерятся.
- Поле `display_name` в UI документов не показывается; в payload подставляется имя файла.

### Проверки
- `pnpm -s typecheck`
- `pnpm -s lint` (без ошибок, есть старые warnings по `exhaustive-deps`)
- `pnpm -s test` (все тесты passed)
