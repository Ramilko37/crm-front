# Backend Endpoint Audit (2026-03-22)

## Контекст проверки
- Front (BFF): `http://84.47.150.248:3001`
- Back: `http://84.47.150.248:8000/api/v1`
- Авторизация: `POST /api/auth/login` c `root/root` через фронт и напрямую в backend
- Роль пользователя: `superuser` (root)
- Формат smoke-check: в основном `GET` на list/detail/nested эндпоинты с базовыми query-параметрами

## Что работает (200)
- `POST /api/auth/login` (через front BFF)
- `POST /api/auth/logout` (через front BFF)
- `GET /api/auth/me` (через front BFF)
- `GET /health` (на backend напрямую)

## Ручки, которые отдают не 200 (по результатам проверки через фронт BFF)

| Endpoint | Status | Response body (snippet) |
|---|---:|---|
| `GET /api/orders?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/trips?page=1&page_size=200` | 500 | `Internal Server Error` |
| `GET /api/factories?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/users?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/path-points?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/countries?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/normative-documents?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/email-templates?page=1&page_size=50&sort_desc=false` | 500 | `Internal Server Error` |
| `GET /api/orders/1` | 500 | `Internal Server Error` |
| `GET /api/trips/1` | 500 | `Internal Server Error` |
| `GET /api/factories/1` | 500 | `Internal Server Error` |
| `GET /api/users/1` | 500 | `Internal Server Error` |
| `GET /api/path-points/1` | 500 | `Internal Server Error` |
| `GET /api/countries/1` | 500 | `Internal Server Error` |
| `GET /api/normative-documents/1` | 500 | `Internal Server Error` |
| `GET /api/email-templates/1` | 500 | `Internal Server Error` |
| `GET /api/orders/1/documents?page=1&page_size=20` | 500 | `Internal Server Error` |
| `GET /api/orders/1/status-history?page=1&page_size=20` | 500 | `Internal Server Error` |
| `GET /api/orders/1/chat-messages?page=1&page_size=20` | 500 | `Internal Server Error` |
| `GET /api/orders/1/certificate` | 500 | `Internal Server Error` |
| `GET /api/trips/1/loading-points?page=1&page_size=20` | 500 | `Internal Server Error` |
| `GET /api/trips/1/path-points?page=1&page_size=20` | 500 | `Internal Server Error` |

## Подтверждение, что проблема на стороне backend (не BFF)
- Те же запросы при прямом вызове backend (`/api/v1/...`) с валидным Bearer-токеном также возвращают `500`.
- Пример: `GET /api/v1/orders?page=1&page_size=1` -> `500 Internal Server Error`.

## Ключевая диагностическая информация из логов backend (`crm-app`)
Обнаружено повторяющееся исключение:

```txt
asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "postgres"
```

Фрагменты stack trace проходят через репозитории list/read модулей (`orders/trips/factories/users/path-points/countries/normative-documents/email-templates`), что объясняет массовые `500` на всех защищённых read-ручках.

## Как воспроизвести (для бэкендера)
```bash
# 1) Получить токен
TOKEN=$(curl -sS -H 'Content-Type: application/json' -X POST 'http://84.47.150.248:8000/api/v1/auth/login' --data '{"login":"root","password":"root"}' | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

# 2) Любой защищённый list/read endpoint -> 500
curl -i -H "Authorization: Bearer $TOKEN" 'http://84.47.150.248:8000/api/v1/orders?page=1&page_size=1'
curl -i -H "Authorization: Bearer $TOKEN" 'http://84.47.150.248:8000/api/v1/trips?page=1&page_size=1'
curl -i -H "Authorization: Bearer $TOKEN" 'http://84.47.150.248:8000/api/v1/factories?page=1&page_size=1'
```

## Предварительный вывод
- Первопричина выглядит как некорректные DB credentials в runtime backend-контейнера (или рассинхрон секретов DB/APP).
- Фронт/BFF корректно проксирует и лишь отражает `500` из backend.

## Рекомендованные действия для backend
1. Проверить фактические env backend-контейнера (`DATABASE_URL`/`DB_*`) и соответствие паролю в Postgres.
2. Проверить, что backend подключается к той же БД/инстансу, где прогонялись миграции/сиды.
3. После фикса прогнать smoke-check на read endpoint-ах из таблицы выше.
4. По возможности вернуть структурированный JSON для 5xx (вместо plain `Internal Server Error`) для ускорения диагностики.
