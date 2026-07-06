# Railway Deployment Notes

The first hosted deployment should use separate Railway services for:

- `web`: Vite React dashboard
- `api`: Fastify API
- `worker`: background simulation runner
- `postgres`: canonical state and run results
- `redis`: queue and run-progress state

## Suggested Service Commands

### web

Build:

```bash
npm install
npm run build -w apps/web
```

Start:

```bash
npm run preview -w apps/web -- --host 0.0.0.0 --port $PORT
```

### api

Build:

```bash
npm install
npm run build -w apps/api
```

Start:

```bash
npm start -w apps/api
```

### worker

Build:

```bash
npm install
npm run build -w apps/worker
```

Start:

```bash
npm start -w apps/worker
```

## Environment Variables

- `PORT`: provided by Railway for web and API services
- `DATABASE_URL`: Railway Postgres connection string
- `REDIS_URL`: Railway Redis connection string
- `CORS_ORIGIN`: deployed web URL
- `VITE_API_URL`: deployed API URL for the web service
- `SIMULATION_TICK_MS`: optional worker tick interval

## Deployment Path

Start with the web and API services. Add Postgres, Redis, and worker-backed runs after the in-memory simulation endpoint is stable.
