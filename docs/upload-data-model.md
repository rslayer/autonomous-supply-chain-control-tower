# Upload Data Model

The first build should be synthetic-first, but the data model should prepare for operational data uploads.

## Import Principle

Uploaded data should never drive the simulator directly. It should be mapped and validated into the canonical supply chain model first.

```text
Uploaded file
    ↓
Column mapping
    ↓
Validation
    ↓
Canonical model
    ↓
Simulation engine
```

## Initial Upload Tables

### facilities

Required fields:

- `facility_id`
- `name`
- `facility_type`
- `market`
- `state`
- `latitude`
- `longitude`
- `business_unit`

### skus

Required fields:

- `sku_id`
- `name`
- `business_unit`
- `category`
- `unit_weight`
- `unit_cube`
- `shelf_life_days`
- `case_pack`

### inventory

Required fields:

- `facility_id`
- `sku_id`
- `on_hand_units`
- `safety_stock_units`
- `reserved_units`
- `as_of`

### shipments

Required fields:

- `shipment_id`
- `business_unit`
- `origin_facility_id`
- `destination_facility_id`
- `carrier_id`
- `mode`
- `status`
- `planned_departure_at`
- `planned_arrival_at`
- `current_eta`

### orders

Required fields:

- `order_id`
- `customer_id`
- `destination_facility_id`
- `sku_id`
- `quantity_units`
- `requested_delivery_at`
- `priority`
- `business_unit`

## Validation Examples

The importer should flag:

- Unknown facilities
- Unknown SKUs
- Shipments without valid lanes
- Negative inventory
- Missing delivery dates
- Invalid shipment statuses
- Requested delivery dates before order creation
- Inventory records with stale `as_of` timestamps

## Upload Modes

### Replay Mode

Use historical operational data to replay what happened and compare decisions.

### Current-State Mode

Use open orders, inventory, shipments, and events to project risk forward.

### What-If Mode

Use uploaded state as the baseline, then inject synthetic disruptions.

### Agent Benchmark Mode

Compare agent recommendations against actual historical outcomes.
