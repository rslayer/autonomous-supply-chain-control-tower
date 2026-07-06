# Autonomous Supply Chain Control Tower

An open-source simulator for agentic supply chain control tower operations.

The first build models a PepsiCo-inspired Texas-Oklahoma regional network across beverage and Frito-Lay style food operations. It creates a synthetic operating environment, generates demand and shipments, injects disruptions, detects exceptions, and surfaces the operational decisions a control tower would need to make.

This project is not affiliated with PepsiCo. The initial network is fictionalized and designed for operational realism, not exact replication of company facilities, systems, or data.

## Why This Exists

Most control tower platforms are strong at visibility, alerts, and exception queues. The hard work still falls to operators: interpreting risk, weighing tradeoffs, coordinating across transportation, inventory, customer service, production, and finance, then deciding what action to take.

This project starts with the missing foundation for agentic operations: a realistic simulation environment where autonomous decision-making can be tested safely.

The long-term goal is to support:

- Synthetic supply chain simulations
- Upload-driven simulations using real operational data
- Exception detection and prioritization
- Rule-based and agentic response planning
- Replay and what-if analysis
- Benchmarks for human-led versus agent-led control tower operations

## First Build

The first milestone is a local-first simulator for Texas-Oklahoma CPG operations.

It should answer:

> Given a regional beverage and snack supply chain network, what shipments, inventory positions, customer orders, and facilities are at risk over the next 14 days?

### Scope

- Region: Texas-Oklahoma
- Business units: Beverage and Frito-Lay style foods
- Horizon: 14 simulated days
- Time step: 6-hour ticks
- Operating flows:
  - Plant to distribution center
  - Distribution center to customer distribution center
  - Warehouse to store cluster
  - Simplified direct-store-delivery route pressure for snacks
  - Full truckload and regional distribution for beverages

The default synthetic network uses PepsiCo-specific Texas anchors supplied during project definition:

- Rosenberg Frito-Lay manufacturing
- San Antonio Frito-Lay manufacturing at 4855 Greatland Dr.
- Dallas / Brookhollow Frito-Lay manufacturing at 1141 Regal Row
- Dallas Gatorade bottling plant
- Brookshire 1NA Mixing Center
- Houston Pepsi Beverages bottling and distribution center
- Plano PFNA / PepsiCo Foods headquarters at 7701 Legacy Dr.
- Representative Frito-Lay DSD depots for dense regional distribution

The model remains a simulation. It does not use confidential facility capacity, inventory, production, or shipment data.

### Initial Markets

- Dallas-Fort Worth
- Houston
- Austin
- San Antonio
- Oklahoma City
- Tulsa
- Lubbock
- Rio Grande Valley
- East Texas

## Core Capabilities

### 1. Synthetic Network Generator

The simulator starts with fictionalized but realistic operating data:

- Facilities
- SKUs
- Customers
- Carriers
- Lanes
- Inventory
- Orders
- Shipments
- Production plans
- Demand forecasts

The synthetic mode lets contributors develop and test the system without sensitive company data.

### 2. Canonical Data Model

All synthetic and uploaded data should map into a common internal model. This keeps the simulation engine independent from file formats, column names, or source systems.

Core objects:

- Business unit
- Facility
- SKU
- Customer
- Carrier
- Lane
- Inventory position
- Order
- Shipment
- Shipment event
- Production plan
- Demand forecast
- Disruption
- Exception
- Action recommendation

### 3. Simulation Engine

The simulation engine advances the operating state over time.

It should:

- Generate customer demand
- Consume inventory
- Generate production output
- Create replenishment shipments
- Move shipments across lanes
- Update ETAs
- Apply disruptions
- Recalculate inventory projections
- Detect exceptions
- Emit event logs

### 4. Disruption Engine

The first disruption library should include:

- Heat wave demand spike
- Severe storm or ice delay
- Carrier pickup failure
- Missed delivery appointment
- Warehouse congestion
- Production shortfall
- Trailer shortage
- Highway delay
- Customer order surge

Each disruption should define:

- Impacted region, lane, facility, SKU, or business unit
- Start time
- Duration
- Severity
- Operational effect
- Affected entities

### 5. Exception Detection

The control tower should detect and rank exceptions such as:

- Late shipment
- Missed delivery window
- Inventory below safety stock
- Projected stockout
- Order at risk
- Carrier failure
- Facility congestion
- Production shortfall
- Demand spike
- Excess dwell time

Each exception should include:

- Severity
- Impacted business unit
- Impacted customer, facility, SKU, or shipment
- Root cause when known
- Time to impact
- Estimated service impact
- Estimated cost impact
- Suggested next action

### 6. Recommendation Placeholder

The first build does not need full autonomous planning. It should include simple rule-based recommendations that create a bridge to later agents.

Examples:

- Expedite shipment
- Retender to backup carrier
- Transfer inventory from alternate distribution center
- Split shipment
- Prioritize high-service customer
- Move delivery appointment
- Trigger manual review
- Increase production in the next cycle

### 7. Control Tower Dashboard

The first UI should feel like an operations tool, not a marketing demo.

Views:

- Network overview
- Exception queue
- Shipments table
- Inventory risk table
- Facility status
- Event log
- Simulation controls

Controls:

- Start simulation
- Pause simulation
- Step forward
- Reset
- Inject disruption
- Filter by business unit
- Filter by market

KPIs:

- On-time delivery percentage
- Open exceptions
- Critical exceptions
- Projected stockouts
- Orders at risk
- Average delay hours
- Carrier failure count
- Inventory below safety stock
- Service impact estimate
- Recovery cost estimate

## Live Data Upload Vision

The simulator should be built synthetic-first, but live-data-ready.

Future upload mode should allow users to import operational data and run the simulator on a digital twin of current or historical operations.

Supported formats should start with:

- CSV
- Excel
- JSON

Initial upload tables:

- `facilities`
- `skus`
- `inventory`
- `shipments`
- `orders`

Later upload tables:

- `shipment_events`
- `carriers`
- `lanes`
- `production_plans`
- `demand_forecast`
- `customer_delivery_windows`

Data flow:

```text
Uploaded operational data
        ↓
Schema mapping and validation
        ↓
Canonical supply chain model
        ↓
Simulation engine
        ↓
Exceptions, scenarios, recommendations, and agent actions
```

Live-data mode should support:

- Replay mode
- Current-state projection
- What-if disruption testing
- Agent benchmark mode
- Scenario planning

## Privacy And Data Principles

Operational data can be highly sensitive. The project should be designed around:

- Local-first processing
- No external data transfer by default
- Synthetic data included out of the box
- Configurable LLM usage
- Data anonymization utilities
- Clear import and export formats
- No hard dependency on proprietary systems

## Current Implementation

The repository now uses a TypeScript monorepo designed for local simulation and Railway hosting.

```text
apps/
  web/       React control tower dashboard
  api/       Fastify API with in-memory scenario endpoints
  worker/    Batch simulation runner
packages/
  domain/    Canonical supply chain model
  simulation/Deterministic simulation engine
  data-gen/  Texas-Oklahoma scenario generator
  importers/ Upload schema and validation placeholders
```

## Running Locally

Install dependencies:

```bash
npm install
```

Run the dashboard:

```bash
npm run dev
```

Run the API:

```bash
npm run dev:api
```

Run a 14-day batch simulation in the worker:

```bash
npm run simulate
```

Validate the workspace:

```bash
npm run check
npm run build
```

## API Endpoints

The API currently keeps scenario state in memory.

- `GET /health`
- `GET /scenario`
- `POST /scenario/reset`
- `POST /simulation/step`
- `POST /simulation/run`
- `GET /simulation/metrics`
- `GET /exceptions`

## Suggested Tech Stack

- Frontend: React and TypeScript
- Build tool: Vite
- Simulation engine: TypeScript
- State management: Zustand or reducer-based state
- Validation: Zod
- Charts: Recharts
- Persistence: local JSON first
- Backend: none for the first build

## Proposed Project Structure

```text
autonomous-supply-chain-control-tower/
  src/
    app/
      App.tsx
      App.css
    domain/
      types.ts
      constants.ts
    data/
      generateNetwork.ts
      seedScenario.ts
    simulation/
      engine.ts
      disruptions.ts
      exceptionDetection.ts
      recommendations.ts
      metrics.ts
    import/
      schemas.ts
      csvTemplates.ts
      validators.ts
    ui/
      Dashboard.tsx
      NetworkMap.tsx
      ExceptionQueue.tsx
      ShipmentTable.tsx
      InventoryRiskTable.tsx
      FacilityStatus.tsx
      EventLog.tsx
      SimulationControls.tsx
    utils/
      date.ts
      random.ts
  docs/
  public/
  README.md
  package.json
```

## MVP Data Volume

The first synthetic scenario should generate approximately:

- 2 business units
- 10 to 14 facilities
- 40 to 60 SKUs
- 12 to 20 customers
- 8 to 12 carriers
- 40 to 80 lanes
- 300 to 600 shipments
- 200 to 400 orders
- 5 to 10 disruptions per run
- 30 to 100 detected exceptions, depending on severity

## Example Domain Types

```ts
type BusinessUnit = "beverage" | "frito_lay";

type FacilityType =
  | "plant"
  | "dc"
  | "mixing_center"
  | "warehouse"
  | "cross_dock"
  | "customer_dc"
  | "store_cluster";

type ShipmentStatus =
  | "planned"
  | "tendered"
  | "accepted"
  | "in_transit"
  | "delayed"
  | "delivered"
  | "missed";

type ExceptionType =
  | "late_shipment"
  | "missed_delivery_window"
  | "inventory_below_safety_stock"
  | "projected_stockout"
  | "order_at_risk"
  | "carrier_failure"
  | "facility_congestion"
  | "production_shortfall"
  | "demand_spike"
  | "excess_dwell";
```

## First User Story

As a supply chain operator, I can:

1. Open the simulator.
2. See a Texas-Oklahoma CPG network.
3. Start a 14-day simulation.
4. Watch shipments, inventory, facilities, and customer demand evolve.
5. See disruptions occur.
6. View exceptions ranked by severity.
7. Understand why an exception happened.
8. See an initial suggested action.
9. Filter by beverage or Frito-Lay style foods.
10. Reset and run the simulation again.

## Acceptance Criteria

The first build is successful when:

- The app runs locally.
- A synthetic Texas-Oklahoma network loads.
- Simulation can start, pause, step, and reset.
- Disruptions affect shipments, inventory, facilities, or orders.
- Exceptions are generated from simulation state.
- Dashboard KPIs update as simulation progresses.
- Users can filter by business unit.
- Exception queue shows severity, impacted entity, cause, and recommended action.
- Code separates canonical schema, synthetic data, simulation engine, and UI.
- README explains the concept, data model, and how to run it.

## Non-Goals For The First Build

- Real PepsiCo data integration
- Real-time APIs
- Full LLM agent orchestration
- Optimization solver
- User authentication
- Multi-tenant backend
- Exact facility matching
- Exact route modeling
- Production-grade ETA prediction

## Build Order

1. Scaffold the React and TypeScript app.
2. Define domain types.
3. Generate the synthetic Texas-Oklahoma network.
4. Build the simulation engine.
5. Add disruptions.
6. Add exception detection.
7. Add metrics.
8. Build the dashboard UI.
9. Add import schema placeholders.
10. Write sample CSV templates.

## License

License to be selected before public release. MIT or Apache-2.0 are both reasonable starting points for an open-source simulator.
