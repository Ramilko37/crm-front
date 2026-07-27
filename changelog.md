# Changelog

## 2026-07-27

### Backend TZ / Task Status
- Свежий backend docx `Техническое_задание_Логистическая_CRM_v1_0 (1).docx` перегнан в markdown: `docs/backend-logistics-crm-v1.0-2026-07-27.md`.
- Добавлен merged-срез актуального состояния задач: `docs/tz-logistics-crm-merged-status-2026-07-27.md`.
- В свежем docx не найдено явных пометок `ready-to-test`, `canceled`, `ready`; задачи без явной пометки оставлены `open`, закрытые позиции взяты из текущего checklist.
- В Linear Customer заведены все 43 задачи из merged-среза: SAR-24...SAR-66. Frontend-задачи назначены на `rgalyamdin@saraffan.radio`; backend-задачи оставлены без assignee с пометкой `Target assignee: Павел Козлов`, потому что Павел не найден среди пользователей workspace.

### Factories / Loading Addresses
- Взят в работу frontend scope FAC-ADR-01: блок `Адреса погрузки` добавлен прямо в create/edit форму фабрики.
- Create factory поддерживает optional nested `loading_address`; edit загружает адреса через `include_inactive=true`, показывает inactive/primary badges и даёт add/update/deactivate/delete/make-primary.
- Directory payload адресов переведён на `postcode_id`/`city_id`; read-only snapshots `postcode`/`city` больше не отправляются из формы.

### Users / Filters
- Реализован frontend scope USR-FLT-02: фильтр `Компания ID` в `/users` заменён на searchable select по названию компании через `/api/companies`.
- В таблице пользователей удалён fallback на технический `company_id`; при отсутствии `company_name` отображается пустое значение.
- Глобальный поиск пользователей теперь явно подписан как поиск по ФИО, логину, email и компании; пустой trim удаляет `query`, новый поиск сбрасывает страницу на 1.
- Browser check показал backend gap: `/users?query=Test+Company+2&page=1` отправляется корректно, но backend вернул `Нет данных`, поэтому полное закрытие USR-FLT-02 зависит от поддержки поиска users по company name.

### Companies / Filters
- Подготовлен frontend scope CMP-FLT-01: в `/companies` добавлена панель фильтров по странам, городам и ролям компании.
- Страны выбираются через searchable multi-select с английскими названиями, города через multi-value tags, роли через фиксированный справочник CRM: Client, Factory, Supplier, Forwarder, Carrier, Warehouse, Customs Broker, Dealer, Partner, Other.
- Фильтры отправляются в `/api/companies` названиями (`country`, `city`, `role`) и комбинируются с глобальным поиском; reset очищает search/filter state.
- Browser check показал backend gap: `/api/companies?country=__no_country__&city=__definitely_no_city__&role=__no_role__` возвращает тот же полный список, а объекты компании пока не содержат `country`/`city`/`role`.

### Проверки
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Browser check `/users`: `Компания ID` не отображается; company filter ищет и показывает `Test Company 1...5`; выбор `Test Company 1` даёт `company_id=1` в URL и label `Test Company 1` в UI.
- Browser check `/companies`: фильтры `Страны`/`Города`/`Роли компании` отображаются, `Компания ID` в фильтрах нет, таблица показывает `Страна`/`Город`/`Роль`, reset очищает выбранные фильтры.

## 2026-07-26

### Orders / Search and Audit
- Закрыт ORD-SRC-01: глобальный поиск вынесен в постоянное поле списка заказов, работает через `query`, не зависит от раскрытых фильтров, debounce ~300 ms, trim, пустой ввод удаляет параметр, новый поиск сбрасывает страницу на 1 и сохраняет сортировку/quick tab/остальные фильтры.
- Placeholder глобального поиска приведён к реальному backend scope: order ID, invoice, client, company, factory, trip, plate, MRN; UI больше не обещает CMR, container, comments, `order_number` и EX1-файлы.
- Закрыт CHAT-AUD-01: журнал `status_history` отображает автора, дату/время, источник `Card`/`Chat`, поле, переход `old_value -> new_value` и fallback-комментарий для legacy-записей.

### Проверки
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Browser check `/orders?filters_open=1`: глобальный поиск отображается, advanced query input удалён.

### Orders / Filters
- Закрыт frontend scope ORD-FLT-02: в фильтрах заказов `Клиент`, `Компания`, `Менеджер`, `Экспедитор`, `Фабрика`, `Рейс` и `Тип документа` выбираются через searchable Select по читаемым названиям вместо ручного ввода технических ID.
- Для связанных order-модалок включён поиск в Select по рейсу/экспедитору; в мобильных карточках заказов убран fallback на `company_id`/`factory_id`.
- В popup документов тип документа показывается через label справочника, если он доступен.

### Проверки
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

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
