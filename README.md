# The Strength Lab

Blazing-fast strength training forum (Go API + Next.js).

## Quick start

```bash
# infra
docker compose up -d postgres redis

# API (from host)
cd api
# use localhost DB when not inside compose network:
# DATABASE_URL=postgres://strengthlab:strengthlab@localhost:5432/strengthlab?sslmode=disable
cp .env.example .env
# edit DATABASE_URL host to localhost for local runs
go run ./cmd/server

# Web
cd ../web
npm install
npm run dev
```

Or full stack:

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8080/healthz

## Demo accounts

| User | Password |
|------|----------|
| coach | password123 |
| spotter | password123 |
| lifter | password123 |
