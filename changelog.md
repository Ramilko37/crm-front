# Changelog

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
