# Деплой на VPS (Debian + Docker)

Стек: `adapter-node` (standalone Node-сервер) → Docker → `compose.prod.yaml` (app + Postgres + Caddy). Caddy сам получает и обновляет TLS-сертификат (Let's Encrypt) — руками с certbot возиться не нужно.

Собрано и проверено локально (`docker build` + прогон образа против реальной БД) — на VPS должно завестись 1-в-1, если верно настроено ниже.

## 0. DNS (один раз, до всего остального)

В Cloudflare для `devcards.cloudmorph.org` — A-запись на IP VPS, **DNS only** (серое облако, не проксировать). Если оставить проксирование Cloudflare (оранжевое облако) — Let's Encrypt HTTP-01 challenge не достучится до Caddy, сертификат не выпустится.

## 1. Docker на VPS (если ещё не стоит)

```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # чтобы не писать sudo каждый раз, перелогинься после
```

## 2. Первый деплой

```sh
git clone https://github.com/m0rphed/devcards.git devcards && cd devcards/devcards_app

cp .env.production.example .env
# Впиши в .env:
#   POSTGRES_PASSWORD  — openssl rand -hex 24
#   BETTER_AUTH_SECRET — openssl rand -hex 32  (НЕ тот, что в dev — сгенерируй новый)
#   RESEND_API_KEY     — можно тот же, что в dev

docker compose -f compose.prod.yaml up -d --build
docker compose -f compose.prod.yaml run --rm app npm run db:migrate
```

Первый запуск Caddy может занять минуту-две — ему нужно выпустить сертификат. Проверить: `docker compose -f compose.prod.yaml logs caddy`.

## 3. Все следующие деплои

```sh
cd devcards/devcards_app
git pull
docker compose -f compose.prod.yaml up -d --build
docker compose -f compose.prod.yaml run --rm app npm run db:migrate
```

Миграции — руками, отдельной командой, как договаривались: если что-то пошло не так со схемой, узнаёшь сразу, а не после того как приложение уже стартовало на несовместимой БД.

## Полезное

- Логи: `docker compose -f compose.prod.yaml logs -f app`
- Консоль в БД: `docker compose -f compose.prod.yaml exec db psql -U devcards`
- БД и приложение никуда наружу не смотрят (нет `ports:` у `db`/`app` в compose) — единственная дверь наружу это Caddy на 80/443.
