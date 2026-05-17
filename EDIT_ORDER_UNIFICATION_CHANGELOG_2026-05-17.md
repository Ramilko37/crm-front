# Изменения за сессию (Edit Order унификация)

Дата: 2026-05-17

## 1) Унификация Edit Order для `/orders` и `/orders/[id]`
- Страница заказа `/orders/[id]` переведена на единый поток редактирования через редирект в standalone-режим:
  - `/orders?single_order_view=1&edit_order_id={id}`
- В standalone-режиме на `/orders`:
  - скрыты toolbar/фильтры/таблица/карточка просмотра;
  - отображается левый edit-pane;
  - справа оставлен пустой контейнер под будущие блоки (история/чат).

Файлы:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/[id]/page.tsx`
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 2) Очистка левой части от history/chat зависимостей
- Удалены остаточные ссылки на удаленные fallback-query (`viewStatusFallbackQuery`, `viewChatFallbackQuery`), которые ломали `typecheck`.
- Левый edit-флоу больше не зависит от блоков истории/чата.

Файл:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 3) Документы: убрать `display_name` из UI
- В create/edit формах документов поле `display_name` убрано из интерфейса.
- При формировании payload `display_name` автоматически заполняется значением `file.name`.

Файл:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 4) Улучшение выпадашек (name/label вместо id)
- В критичных select-ах убраны подписи формата `id - ...`.
- Лейблы в опциях приведены к человекочитаемым значениям (имя/логин, имя/адрес и т.п.).
- Убраны fallback-подписи с `ID` в labels там, где это мешало UX.

Файл:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 5) Guard несохраненных изменений
- При закрытии edit-дровера с изменениями показывается confirm:
  - «Уверены, что хотите отменить изменения?»
- Для standalone-режима добавлены предупреждения при уходе:
  - навигация по ссылкам;
  - browser back (`popstate`);
  - hard reload / закрытие вкладки (`beforeunload`).

Файл:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 6) Текстовые правки UI
- Колонка в таблице:
  - `Оплачено TARGET MOB` -> `Оплачено компанией`.

Файл:
- `/Users/rr/Desktop/Frontend/crm-front/src/app/(app)/orders/page.tsx`

## 7) Проверки
- `pnpm -s typecheck` — passed
- `pnpm -s lint` — passed (есть 3 warning по hook deps, без ошибок)
- `pnpm -s test` — passed (25/25)

