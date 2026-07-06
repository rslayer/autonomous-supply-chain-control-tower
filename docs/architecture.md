# Architecture

Autonomous Supply Chain Control Tower is designed as a hosted, local-first-capable monorepo.

## System Shape

```text
React web dashboard
        ↓
Fastify API
        ↓
Simulation and domain packages
        ↓
Worker service
        ↓
Postgres, Redis, object storage
```

The first build keeps persistence optional and runs against synthetic data. The package boundaries are designed so the same simulation engine can later run from uploaded operational data, a background queue, or a replay workflow.

## Monorepo Layout

```text
apps/
  web/       React control tower dashboard
  api/       HTTP API for scenarios, simulation runs, exceptions, and health
  worker/    Background simulation and future agent jobs
packages/
  domain/    Canonical supply chain types and helpers
  simulation/Deterministic simulation engine
  data-gen/  Texas-Oklahoma synthetic scenario generator
  importers/ Upload schemas and validation placeholders
infra/       Railway and deployment notes
docs/        Product and architecture docs
```

## Runtime Responsibilities

### Web

The web app shows the operating state and lets users start, pause, step, reset, filter, and inspect the simulation.

### API

The API exposes scenario and simulation state. Early endpoints can run in memory. Hosted versions should move run state into Postgres and queue long jobs through Redis.

### Worker

The worker runs long simulations, replay jobs, future agent evaluations, and scheduled scenario tests.

### Domain Package

The domain package owns canonical objects such as facilities, SKUs, lanes, orders, shipments, inventory positions, disruptions, exceptions, recommendations, and metrics.

### Simulation Package

The simulation package is deterministic. It consumes canonical state and returns the next state plus events, exceptions, recommendations, and metrics.

### Data Generator

The data generator creates the Texas-Oklahoma beverage and Frito-Lay style synthetic network.

### Importers

The importers package defines upload schemas and validation paths. Uploaded data maps into the canonical model before it reaches the simulation engine.

## Deployment Strategy

Railway is the preferred first hosting target:

1. Deploy `apps/api` with in-memory scenario endpoints.
2. Deploy `apps/web` pointed at the API URL.
3. Add Postgres for datasets, simulation runs, events, and exceptions.
4. Add Redis for queued simulations.
5. Deploy `apps/worker` for long-running simulation and agent jobs.

## Future Agent Layer

Agents should operate over canonical state, never raw uploaded files or UI state.

Potential agents:

- Transportation recovery agent
- Inventory balancing agent
- Customer promise agent
- Production constraint agent
- Finance impact agent
- Policy and approval agent
- Coordinator agent
