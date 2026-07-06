# First Build Spec

This document captures the first implementation target for Control Tower Sim.

## Product Definition

Control Tower Sim is a local-first simulator for a Texas-Oklahoma CPG supply chain network inspired by beverage and Frito-Lay style food operations.

The first release should create a credible operating environment, not a full decision automation system. It should generate operational pressure through shipments, demand, inventory consumption, production, and disruptions.

## Milestone Goal

Run a 14-day simulation and surface the top operational exceptions a regional control tower would need to handle.

## Required Modules

- Canonical domain model
- Synthetic network generator
- Simulation engine
- Disruption engine
- Exception detection engine
- Rule-based recommendation placeholder
- Metrics calculator
- Control tower dashboard
- Import schema placeholders

## Simulation Loop

At each 6-hour tick:

1. Advance simulation time.
2. Generate or apply customer demand.
3. Consume inventory.
4. Apply production output.
5. Move shipments along lanes.
6. Update shipment ETAs and statuses.
7. Apply active disruptions.
8. Recalculate inventory risk.
9. Detect exceptions.
10. Update KPIs and event logs.

## First Scenario

The default scenario should include:

- Beverage operations centered on DFW, Houston, Austin, San Antonio, Oklahoma City, and Tulsa.
- Frito-Lay style food operations centered on North Texas with distribution into Texas and Oklahoma markets.
- Heat-driven beverage demand.
- Weekend snack demand.
- Customer delivery windows.
- Carrier variability.
- Facility congestion.
- Production shortfall events.
- Severe weather disruption events.

## Output

The simulator should produce:

- Current simulation time
- Facility status
- Shipment status
- Inventory positions
- Open exceptions
- Event log
- KPI summary
- Rule-based recommended actions

## Future Agent Layer

The future agent layer should consume the same canonical state and produce structured action proposals. Agents should not depend directly on raw uploaded files or UI state.

Potential agents:

- Transportation recovery agent
- Inventory balancing agent
- Customer promise agent
- Production constraint agent
- Finance impact agent
- Policy and approval agent
- Coordinator agent
