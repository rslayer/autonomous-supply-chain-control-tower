import {
  addHours,
  type Carrier,
  type Customer,
  type DemandForecast,
  type Disruption,
  type Facility,
  type InventoryPosition,
  type Lane,
  type Order,
  type ProductionPlan,
  type ScenarioState,
  type Shipment,
  type SimulationMetrics,
  type Sku
} from "@control-tower/domain";

const startTime = "2026-07-06T06:00:00.000Z";

function metrics(): SimulationMetrics {
  return {
    onTimeDeliveryPct: 100,
    openExceptions: 0,
    criticalExceptions: 0,
    projectedStockouts: 0,
    ordersAtRisk: 0,
    averageDelayHours: 0,
    carrierFailureCount: 0,
    inventoryBelowSafetyStock: 0,
    serviceImpactEstimate: 0,
    recoveryCostEstimate: 0
  };
}

export function createTexasOklahomaScenario(): ScenarioState {
  const facilities: Facility[] = [
    facility("bev-plant-dfw", "North Texas Beverage Plant", "plant", "Dallas-Fort Worth", "TX", ["beverage"], 32.89, -97.04, 180000),
    facility("bev-dc-dfw", "DFW Beverage DC", "dc", "Dallas-Fort Worth", "TX", ["beverage"], 32.78, -96.8, 130000),
    facility("bev-dc-hou", "Houston Beverage DC", "dc", "Houston", "TX", ["beverage"], 29.76, -95.37, 120000),
    facility("bev-dc-sa", "San Antonio Beverage DC", "dc", "San Antonio", "TX", ["beverage"], 29.42, -98.49, 90000),
    facility("bev-xdock-okc", "Oklahoma City Beverage Cross-Dock", "cross_dock", "Oklahoma City", "OK", ["beverage"], 35.47, -97.52, 50000),
    facility("fl-plant-ntx", "North Texas Frito-Lay Style Plant", "plant", "Dallas-Fort Worth", "TX", ["frito_lay"], 33.02, -96.7, 160000),
    facility("fl-mix-dfw", "DFW Foods Mixing Center", "mixing_center", "Dallas-Fort Worth", "TX", ["frito_lay"], 32.86, -96.9, 125000),
    facility("fl-wh-hou", "Houston Foods Warehouse", "warehouse", "Houston", "TX", ["frito_lay"], 29.8, -95.45, 85000),
    facility("fl-wh-aus", "Austin-San Antonio Foods Warehouse", "warehouse", "Austin", "TX", ["frito_lay"], 30.27, -97.74, 70000),
    facility("fl-wh-okc", "Oklahoma Foods Warehouse", "warehouse", "Oklahoma City", "OK", ["frito_lay"], 35.5, -97.57, 65000),
    facility("cust-dfw", "DFW Retail DC", "customer_dc", "Dallas-Fort Worth", "TX", ["beverage", "frito_lay"], 32.91, -96.75, 70000),
    facility("cust-hou", "Houston Grocery DC", "customer_dc", "Houston", "TX", ["beverage", "frito_lay"], 29.7, -95.35, 76000),
    facility("cust-okc", "OKC Retail DC", "customer_dc", "Oklahoma City", "OK", ["beverage", "frito_lay"], 35.44, -97.48, 56000),
    facility("stores-aus", "Austin Store Cluster", "store_cluster", "Austin", "TX", ["frito_lay"], 30.31, -97.72, 32000)
  ];

  const skus = createSkus();
  const customers = createCustomers();
  const carriers = createCarriers();
  const lanes = createLanes(carriers);
  const inventory = createInventory(facilities, skus);
  const demandForecasts = createDemandForecasts(customers, skus);
  const orders = createOrders(customers, skus);
  const shipments = createShipments(orders, lanes, carriers);
  const productionPlans = createProductionPlans(skus);
  const disruptions = createDisruptions();

  return {
    id: "tx-ok-default",
    name: "Texas-Oklahoma Regional CPG Scenario",
    currentTime: startTime,
    tickHours: 6,
    horizonDays: 14,
    facilities,
    skus,
    customers,
    carriers,
    lanes,
    inventory,
    orders,
    shipments,
    productionPlans,
    demandForecasts,
    disruptions,
    exceptions: [],
    events: [
      {
        id: "evt-start",
        occurredAt: startTime,
        type: "production",
        severity: "low",
        title: "Scenario initialized",
        description: "Texas-Oklahoma beverage and Frito-Lay style network loaded."
      }
    ],
    metrics: metrics()
  };
}

function facility(
  id: string,
  name: string,
  type: Facility["type"],
  market: string,
  state: "TX" | "OK",
  businessUnits: Facility["businessUnits"],
  latitude: number,
  longitude: number,
  capacityUnits: number
): Facility {
  return {
    id,
    name,
    type,
    market,
    state,
    businessUnits,
    location: { latitude, longitude },
    capacityUnits,
    congestionLevel: type === "cross_dock" ? 0.28 : 0.18
  };
}

function createSkus(): Sku[] {
  const beverage = [
    ["bev-water-24pk", "Bottled Water 24pk", "water", 28, 2.4, 365, 24, "high"],
    ["bev-sports-12pk", "Sports Drink 12pk", "sports_drink", 18, 1.8, 270, 12, "high"],
    ["bev-cola-12pk", "Cola 12pk", "carbonated", 16, 1.5, 300, 12, "high"],
    ["bev-tea-12pk", "Ready Tea 12pk", "tea", 15, 1.4, 240, 12, "medium"],
    ["bev-energy-24ct", "Energy Drink 24ct", "energy", 22, 1.2, 365, 24, "medium"]
  ] as const;

  const foods = [
    ["fl-classic-48ct", "Classic Chips 48ct", "chips", 9, 2.8, 70, 48, "high"],
    ["fl-variety-30ct", "Variety Pack 30ct", "multipack", 8, 2.5, 65, 30, "high"],
    ["fl-tortilla-24ct", "Tortilla Chips 24ct", "tortilla", 7, 2.2, 80, 24, "medium"],
    ["fl-popcorn-36ct", "Popcorn 36ct", "popcorn", 6, 2.7, 90, 36, "medium"],
    ["fl-dip-12ct", "Shelf Stable Dip 12ct", "dip", 12, 1.6, 120, 12, "low"]
  ] as const;

  return [
    ...beverage.map(([id, name, category, unitWeight, unitCube, shelfLifeDays, casePack, velocity]) => ({
      id,
      name,
      businessUnit: "beverage" as const,
      category,
      unitWeight,
      unitCube,
      shelfLifeDays,
      casePack,
      velocity
    })),
    ...foods.map(([id, name, category, unitWeight, unitCube, shelfLifeDays, casePack, velocity]) => ({
      id,
      name,
      businessUnit: "frito_lay" as const,
      category,
      unitWeight,
      unitCube,
      shelfLifeDays,
      casePack,
      velocity
    }))
  ];
}

function createCustomers(): Customer[] {
  return [
    customer("walmart-dfw", "Walmart DFW Regional DC", "retail_dc", "Dallas-Fort Worth", "TX", "key_account", 32.65, -97.05),
    customer("heb-hou", "H-E-B Style Houston Grocery DC", "grocery_dc", "Houston", "TX", "promotional", 29.63, -95.2),
    customer("club-sa", "San Antonio Club DC", "club_dc", "San Antonio", "TX", "key_account", 29.37, -98.55),
    customer("cstore-okc", "Oklahoma Convenience Distributor", "convenience", "Oklahoma City", "OK", "standard", 35.55, -97.35),
    customer("grocery-tulsa", "Tulsa Grocery DC", "grocery_dc", "Tulsa", "OK", "standard", 36.15, -95.99),
    customer("stores-aus", "Austin Metro Stores", "store_cluster", "Austin", "TX", "promotional", 30.31, -97.72)
  ];
}

function customer(
  id: string,
  name: string,
  type: Customer["type"],
  market: string,
  state: "TX" | "OK",
  priority: Customer["priority"],
  latitude: number,
  longitude: number
): Customer {
  return { id, name, type, market, state, priority, location: { latitude, longitude } };
}

function createCarriers(): Carrier[] {
  return [
    { id: "carrier-lone-star", name: "Lone Star Dedicated", reliability: 0.93, costPerMile: 2.55, modes: ["truckload"], capacityPerDay: 32 },
    { id: "carrier-red-river", name: "Red River Logistics", reliability: 0.88, costPerMile: 2.35, modes: ["truckload", "ltl"], capacityPerDay: 26 },
    { id: "carrier-gulf", name: "Gulf Coast Freight", reliability: 0.84, costPerMile: 2.2, modes: ["truckload", "intermodal"], capacityPerDay: 22 },
    { id: "carrier-dsd", name: "Metro DSD Fleet", reliability: 0.91, costPerMile: 3.1, modes: ["dsd"], capacityPerDay: 40 }
  ];
}

function createLanes(carriers: Carrier[]): Lane[] {
  const primary = carriers[0]?.id ?? "carrier-lone-star";
  const backup = carriers[1]?.id ?? "carrier-red-river";
  const dsd = carriers[3]?.id ?? "carrier-dsd";
  const pairs = [
    ["bev-plant-dfw", "bev-dc-dfw", 22, 8, "truckload", ["beverage"], primary, backup],
    ["bev-plant-dfw", "bev-dc-hou", 250, 14, "truckload", ["beverage"], primary, "carrier-gulf"],
    ["bev-plant-dfw", "bev-dc-sa", 285, 16, "truckload", ["beverage"], backup, primary],
    ["bev-dc-dfw", "bev-xdock-okc", 205, 12, "truckload", ["beverage"], backup, primary],
    ["bev-dc-dfw", "cust-dfw", 35, 6, "truckload", ["beverage"], primary, backup],
    ["bev-dc-hou", "cust-hou", 28, 6, "truckload", ["beverage"], "carrier-gulf", primary],
    ["bev-xdock-okc", "cust-okc", 16, 4, "ltl", ["beverage"], backup, primary],
    ["fl-plant-ntx", "fl-mix-dfw", 30, 6, "truckload", ["frito_lay"], primary, backup],
    ["fl-mix-dfw", "fl-wh-hou", 245, 14, "truckload", ["frito_lay"], "carrier-gulf", backup],
    ["fl-mix-dfw", "fl-wh-aus", 195, 12, "truckload", ["frito_lay"], backup, primary],
    ["fl-mix-dfw", "fl-wh-okc", 210, 12, "truckload", ["frito_lay"], backup, primary],
    ["fl-wh-aus", "stores-aus", 24, 5, "dsd", ["frito_lay"], dsd, backup],
    ["fl-wh-hou", "cust-hou", 30, 5, "dsd", ["frito_lay"], dsd, backup],
    ["fl-wh-okc", "cust-okc", 18, 5, "dsd", ["frito_lay"], dsd, backup]
  ] as const;

  return pairs.map(([originFacilityId, destinationFacilityId, miles, baseTransitHours, mode, businessUnits, primaryCarrierId, backupCarrierId], index) => ({
    id: `lane-${index + 1}`,
    originFacilityId,
    destinationFacilityId,
    miles,
    mode,
    baseTransitHours,
    businessUnits: [...businessUnits],
    primaryCarrierId,
    backupCarrierId
  }));
}

function createInventory(facilities: Facility[], skus: Sku[]): InventoryPosition[] {
  return facilities.flatMap((site) =>
    skus
      .filter((sku) => site.businessUnits.includes(sku.businessUnit) && site.type !== "customer_dc" && site.type !== "store_cluster")
      .map((sku, index) => {
        const base = sku.velocity === "high" ? 18_000 : sku.velocity === "medium" ? 10_000 : 5_000;
        const plantBoost = site.type === "plant" ? 1.8 : 1;
        return {
          id: `inv-${site.id}-${sku.id}`,
          facilityId: site.id,
          skuId: sku.id,
          onHandUnits: Math.round((base + index * 700) * plantBoost),
          safetyStockUnits: Math.round(base * 0.45),
          reservedUnits: Math.round(base * 0.12),
          asOf: startTime
        };
      })
  );
}

function createDemandForecasts(customers: Customer[], skus: Sku[]): DemandForecast[] {
  const forecasts: DemandForecast[] = [];
  for (let day = 0; day < 14; day += 1) {
    for (const customer of customers) {
      for (const sku of skus) {
        const customerMatches =
          customer.type === "store_cluster" ? sku.businessUnit === "frito_lay" : true;
        if (!customerMatches) continue;
        const heatLift = sku.businessUnit === "beverage" && day >= 3 && day <= 6 ? 1.35 : 1;
        const weekendLift = sku.businessUnit === "frito_lay" && [5, 6, 12, 13].includes(day) ? 1.3 : 1;
        const priorityLift = customer.priority === "promotional" ? 1.2 : 1;
        const base = sku.velocity === "high" ? 1400 : sku.velocity === "medium" ? 780 : 360;
        forecasts.push({
          id: `fcst-${day}-${customer.id}-${sku.id}`,
          customerId: customer.id,
          skuId: sku.id,
          forecastDate: addHours(startTime, day * 24),
          forecastUnits: Math.round(base * heatLift * weekendLift * priorityLift),
          promotionLift: heatLift * weekendLift * priorityLift
        });
      }
    }
  }
  return forecasts;
}

function createOrders(customers: Customer[], skus: Sku[]): Order[] {
  const orders: Order[] = [];
  let count = 1;
  for (let day = 1; day <= 10; day += 1) {
    for (const customer of customers) {
      const isStoreCluster = customer.type === "store_cluster";
      for (const businessUnit of ["beverage", "frito_lay"] as const) {
        if (isStoreCluster && businessUnit !== "frito_lay") continue;
        const unitSkus = skus.filter((sku) => sku.businessUnit === businessUnit).slice(0, 3);
        orders.push({
          id: `ord-${count.toString().padStart(4, "0")}`,
          customerId: customer.id,
          destinationFacilityId: customer.id === "stores-aus" ? "stores-aus" : customer.state === "OK" ? "cust-okc" : customer.market === "Houston" ? "cust-hou" : "cust-dfw",
          businessUnit,
          lines: unitSkus.map((sku, skuIndex) => ({
            skuId: sku.id,
            quantityUnits: (sku.velocity === "high" ? 1800 : 900) + day * 90 + skuIndex * 120
          })),
          createdAt: addHours(startTime, (day - 1) * 24),
          requestedDeliveryAt: addHours(startTime, day * 24 + 18),
          priority: customer.priority,
          status: "open"
        });
        count += 1;
      }
    }
  }
  return orders;
}

function createShipments(orders: Order[], lanes: Lane[], carriers: Carrier[]): Shipment[] {
  return orders.map((order, index) => {
    const origin =
      order.businessUnit === "beverage"
        ? order.destinationFacilityId === "cust-hou"
          ? "bev-dc-hou"
          : order.destinationFacilityId === "cust-okc"
            ? "bev-xdock-okc"
            : "bev-dc-dfw"
        : order.destinationFacilityId === "stores-aus"
          ? "fl-wh-aus"
          : order.destinationFacilityId === "cust-hou"
            ? "fl-wh-hou"
            : order.destinationFacilityId === "cust-okc"
              ? "fl-wh-okc"
              : "fl-mix-dfw";
    const lane = lanes.find((candidate) => candidate.originFacilityId === origin && candidate.destinationFacilityId === order.destinationFacilityId) ?? lanes.find((candidate) => candidate.businessUnits.includes(order.businessUnit));
    const selectedLane = lane ?? lanes[0];
    const carrier = carriers.find((candidate) => candidate.id === selectedLane?.primaryCarrierId) ?? carriers[0];
    const departure = addHours(order.createdAt, 10 + (index % 3) * 4);
    const arrival = addHours(departure, selectedLane?.baseTransitHours ?? 12);
    return {
      id: `ship-${(index + 1).toString().padStart(4, "0")}`,
      businessUnit: order.businessUnit,
      originFacilityId: origin,
      destinationFacilityId: order.destinationFacilityId,
      customerId: order.customerId,
      carrierId: carrier?.id ?? "carrier-lone-star",
      laneId: selectedLane?.id ?? "lane-1",
      mode: selectedLane?.mode ?? "truckload",
      status: index % 5 === 0 ? "accepted" : "planned",
      lines: order.lines,
      plannedDepartureAt: departure,
      plannedArrivalAt: arrival,
      currentEta: arrival,
      delayHours: 0,
      dwellHours: 0
    };
  });
}

function createProductionPlans(skus: Sku[]): ProductionPlan[] {
  return skus.flatMap((sku, index) =>
    Array.from({ length: 7 }, (_, day) => ({
      id: `prod-${day}-${sku.id}`,
      facilityId: sku.businessUnit === "beverage" ? "bev-plant-dfw" : "fl-plant-ntx",
      skuId: sku.id,
      plannedUnits: sku.velocity === "high" ? 9500 : sku.velocity === "medium" ? 6200 : 3200,
      producedUnits: 0,
      startsAt: addHours(startTime, day * 24 + index),
      endsAt: addHours(startTime, day * 24 + 8 + index)
    }))
  );
}

function createDisruptions(): Disruption[] {
  return [
    {
      id: "disrupt-heat-wave",
      type: "heat_wave_demand_spike",
      title: "Texas heat wave increases beverage demand",
      startsAt: addHours(startTime, 72),
      endsAt: addHours(startTime, 144),
      severity: "high",
      market: "Houston",
      businessUnit: "beverage",
      effect: { demandMultiplier: 1.45 }
    },
    {
      id: "disrupt-dfw-congestion",
      type: "warehouse_congestion",
      title: "DFW warehouse congestion slows outbound handling",
      startsAt: addHours(startTime, 48),
      endsAt: addHours(startTime, 96),
      severity: "medium",
      market: "Dallas-Fort Worth",
      effect: { delayHours: 8, congestionIncrease: 0.22 }
    },
    {
      id: "disrupt-ice-ok",
      type: "severe_storm_delay",
      title: "Oklahoma storm delays northbound lanes",
      startsAt: addHours(startTime, 120),
      endsAt: addHours(startTime, 168),
      severity: "critical",
      market: "Oklahoma City",
      effect: { delayHours: 18, capacityMultiplier: 0.65 }
    },
    {
      id: "disrupt-food-shortfall",
      type: "production_shortfall",
      title: "Snack production shortfall on multipacks",
      startsAt: addHours(startTime, 36),
      endsAt: addHours(startTime, 84),
      severity: "high",
      facilityId: "fl-plant-ntx",
      businessUnit: "frito_lay",
      effect: { productionMultiplier: 0.72 }
    }
  ];
}
