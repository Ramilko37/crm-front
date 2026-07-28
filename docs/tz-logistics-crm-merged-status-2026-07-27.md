# Logistics CRM merged task status

Generated: 2026-07-27

Sources:
- Fresh backend document: `/Users/rr/Downloads/Техническое_задание_Логистическая_CRM_v1_0 (1).docx`
- Current frontend checklist: `docs/tz-logistics-crm-checklist.md`

Merge rules:
- Explicit backend document statuses `ready-to-test`, `canceled`, `ready` override default open state.
- Tasks without explicit backend document status are `open`, unless already closed in the frontend checklist.
- Closed checklist items are kept as `done`.

| ID | Title | Owner | Type | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CHAT-AUD-01 | Журнал изменений | backend | Improvement | High | done |  |
| CHAT-EDT-01 | Функциональное и регрессионное тестирование | frontend | Testing | High | open | частично есть |
| CMP-CRE-01 | Кнопка «Создать компанию» | backend | Functional requirement | High | open |  |
| CMP-FLT-01 | Фильтры по стране, городу и роли | frontend | Functional requirement | High | open | frontend UI готов: country/city/role filters отправляют названия без технических ID; backend gap: `GET /api/companies?country=...&city=...&role=...` пока возвращает полный список и не отдаёт поля `country`/`city`/`role` |
| CMP-SRC-01 | Глобальный поиск компаний | backend | Improvement | Medium | open | частично есть |
| FAC-ADR-01 | Несколько адресов погрузки | backend | Functional requirement | High | open | частично есть |
| FAC-CRE-01 | Порядок и обязательность основных полей | frontend | Improvement / Validation | High | open |  |
| FAC-CRE-02 | Скрытие Country ID и выбор страны | frontend | Improvement | High | done |  |
| FAC-CRE-03 | Индекс и город | backend | Functional requirement / Validation | High | open |  |
| FAC-FLT-01 | Проверка фильтров фабрик | frontend | Testing | Medium | done |  |
| FAC-ORD-01 | Выбор адреса погрузки в заказе | frontend | Functional requirement | High | done |  |
| FAC-RES-01 | Раздел «Ресурсы» | frontend | Improvement | Medium | open |  |
| ORD-CRE-01 | Создание новой компании из заказа | backend | Bug | High | open |  |
| ORD-CRE-02 | Справочник стран и автодополнение | frontend | Improvement | Medium | done |  |
| ORD-CRE-03 | Создание новой фабрики из заказа | backend | Bug | High | done |  |
| ORD-CRE-04 | Почтовый индекс и определение города | frontend | Functional requirement / Validation | High | done |  |
| ORD-CRE-05 | Обязательные поля и валидация | frontend | Validation | High | done |  |
| ORD-CRE-06 | Товары и описание груза | frontend | Functional requirement | Medium | done |  |
| ORD-DOC-01 | Массовая загрузка и классификация документов | backend | Functional requirement | High | open | frontend draft UI готов: drag & drop, multi-file, удаление, переименование, комментарии, индивидуальная и массовая классификация, duplicate warning, сохранение в draft; backend pending, спецификация: `docs/backend-order-documents-bulk-upload-spec.md` |
| ORD-DRF-01 | Сохранение данных между шагами | frontend | Bug | Critical | done |  |
| ORD-DRF-02 | Автосохранение черновика | backend | Functional requirement | High | open | частично есть |
| ORD-FLT-01 | Компактная группировка фильтров | frontend | Improvement | High | open |  |
| ORD-FLT-02 | Понятные названия и автодополнение | frontend | Improvement | High | done |  |
| ORD-FLT-03 | Сворачивание и запоминание состояния | frontend | Improvement | Medium | done |  |
| ORD-FLT-04 | Применение и сброс фильтров | frontend | Functional requirement | High | done |  |
| ORD-FLT-05 | Сохранённые фильтры | frontend | Functional requirement | Medium | open |  |
| ORD-FLT-06 | Период и быстрые пресеты | frontend | Improvement | Medium | done |  |
| ORD-SRC-01 | Глобальный поиск по заказам | backend | Improvement | High | done |  |
| REQ-CONV-01 | Конвертация заявки в заказ | backend | Functional requirement | High | open |  |
| REQ-MOD-01 | Раздельные сущности и списки | frontend | Functional requirement | High | done |  |
| USR-FLT-01 | Компактный двухуровневый интерфейс | frontend | Improvement | High | open |  |
| USR-FLT-02 | Понятные поля вместо технических ID | backend | Improvement | High | open | frontend UI готов: company filter показывает searchable названия без Company ID; backend gap: `GET /api/v1/users?query=<company>` пока не вернул пользователя по компании в browser check |
| USR-FLT-03 | Быстрые фильтры | frontend | Improvement | Medium | ready-to-test | frontend UI готов; backend gap вынесен в CRM-68 (`is_active=true`, `has_company=false`) |
| USR-FLT-04 | Применение, сброс и единый стиль | frontend | Improvement | Medium | open |  |
| WPT-CFM-01 | Ручное подтверждение логистом | backend | Functional requirement | High | open |  |
| WPT-CHK-01 | Автоматическая проверка допустимости | backend | Functional requirement | Critical | open |  |
| WPT-CHK-02 | Запрещающие условия и объяснение отказа | backend | Functional requirement | Critical | open |  |
| WPT-CRE-01 | Создание путевой точки | frontend | Functional requirement | High | done |  |
| WPT-FLT-01 | Исправление и состав фильтров | frontend | Bug / Improvement | High | open | частично есть |
| WPT-HIS-01 | История движения заказа | backend | Functional requirement | High | open |  |
| WPT-ORD-01 | Текущее местоположение и статус товара | backend | Functional requirement | High | open |  |
| WPT-OVR-01 | Принудительное добавление с особыми правами | backend | Functional requirement | High | open |  |
| WPT-TRIP-01 | Последовательность точек рейса | backend | Functional requirement | High | open | частично есть |
