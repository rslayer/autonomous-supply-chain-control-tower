import {
  addHours,
  hoursBetween,
  severityRank,
  type ActionRecommendation,
  type ControlTowerException,
  type Disruption,
  type InventoryPosition,
  type Order,
  type ScenarioState,
  type Shipment,
  type SimulationEvent,
  type SimulationMetrics
} from "@control-tower/domain";

export interface SimulationStepResult {
  state: ScenarioState;
  newEvents: SimulationEvent[];
  newExceptions: ControlTowerException[];
}

export function stepSimulation(state: ScenarioState): SimulationStepResult {
  const nextTime = addHours(state.currentTime, state.tickHours);
  const activeDisruptions = state.disruptions.filter((disruption) => isActive(disruption, state.currentTime, nextTime));
  const events: SimulationEvent[] = [];

  const facilities = state.facilities.map((facility) => {
    const congestionDisruptions = activeDisruptions.filter((disruption) =>
      disruption.facilityId === facility.id || disruption.market === facility.market
    );
    const congestionIncrease = congestionDisruptions.reduce((sum, disruption) => sum + (disruption.effect.congestionIncrease ?? 0), 0);
    return {
      ...facility,
      congestionLevel: clamp(facility.congestionLevel * 0.96 + congestionIncrease, 0, 1)
    };
  });

  for (const disruption of activeDisruptions) {
    events.push({
      id: `evt-${nextTime}-${disruption.id}`,
      occurredAt: nextTime,
      type: "disruption",
      severity: disruption.severity,
      title: disruption.title,
      description: `${disruption.type.replaceAll("_", " ")} active in ${disruption.market ?? disruption.facilityId ?? "regional network"}.`
    });
  }

  const inventory = applyProduction(
    applyDemand(state.inventory, state.orders, state.skus, state.customers, activeDisruptions, state.currentTime, nextTime, events),
    state.productionPlans,
    activeDisruptions,
    state.currentTime,
    nextTime,
    events
  );

  const shipments = moveShipments(state.shipments, activeDisruptions, state.currentTime, nextTime, events);
  const orders = updateOrders(state.orders, shipments, nextTime);
  const draftState: ScenarioState = {
    ...state,
    currentTime: nextTime,
    facilities,
    inventory,
    shipments,
    orders,
    events: [...events, ...state.events].slice(0, 250)
  };

  const newExceptions = detectExceptions(draftState);
  const exceptions = mergeExceptions(state.exceptions, newExceptions);
  const metrics = calculateMetrics({ ...draftState, exceptions });

  return {
    state: {
      ...draftState,
      exceptions,
      metrics,
      events: [...newExceptions.map(exceptionToEvent), ...draftState.events].slice(0, 250)
    },
    newEvents: events,
    newExceptions
  };
}

export function runSimulation(initialState: ScenarioState, steps: number): ScenarioState {
  let state = initialState;
  for (let step = 0; step < steps; step += 1) {
    state = stepSimulation(state).state;
  }
  return state;
}

function applyDemand(
  inventory: InventoryPosition[],
  orders: Order[],
  skus: ScenarioState["skus"],
  customers: ScenarioState["customers"],
  disruptions: Disruption[],
  fromTime: string,
  toTime: string,
  events: SimulationEvent[]
): InventoryPosition[] {
  const next = inventory.map((position) => ({ ...position }));
  const dueOrders = orders.filter((order) => order.status === "open" && isWithin(order.createdAt, fromTime, toTime));

  for (const order of dueOrders) {
    const customer = customers.find((candidate) => candidate.id === order.customerId);
    const demandMultiplier = disruptions
      .filter((disruption) => disruption.businessUnit === order.businessUnit || !disruption.businessUnit)
      .filter((disruption) => !disruption.market || disruption.market === customer?.market)
      .reduce((multiplier, disruption) => multiplier * (disruption.effect.demandMultiplier ?? 1), 1);

    for (const line of order.lines) {
      const sku = skus.find((candidate) => candidate.id === line.skuId);
      const source = next.find((position) => position.skuId === line.skuId && likelySource(position.facilityId, order.destinationFacilityId, order.businessUnit));
      if (!source || !sku) continue;
      source.onHandUnits = Math.max(0, source.onHandUnits - Math.round(line.quantityUnits * 0.35 * demandMultiplier));
      source.reservedUnits += Math.round(line.quantityUnits * 0.15);
      source.asOf = toTime;
    }

    events.push({
      id: `evt-demand-${order.id}-${toTime}`,
      occurredAt: toTime,
      type: "demand",
      severity: demandMultiplier > 1.2 ? "medium" : "low",
      title: `Demand allocated for ${order.id}`,
      description: `${order.businessUnit.replace("_", " ")} order demand reserved for ${customer?.name ?? order.customerId}.`
    });
  }

  return next;
}

function applyProduction(
  inventory: InventoryPosition[],
  productionPlans: ScenarioState["productionPlans"],
  disruptions: Disruption[],
  fromTime: string,
  toTime: string,
  events: SimulationEvent[]
): InventoryPosition[] {
  const next = inventory.map((position) => ({ ...position }));
  const completedPlans = productionPlans.filter((plan) => isWithin(plan.endsAt, fromTime, toTime));

  for (const plan of completedPlans) {
    const multiplier = disruptions
      .filter((disruption) => disruption.facilityId === plan.facilityId || disruption.type === "production_shortfall")
      .reduce((value, disruption) => value * (disruption.effect.productionMultiplier ?? 1), 1);
    const producedUnits = Math.round(plan.plannedUnits * multiplier);
    const inventoryPosition = next.find((position) => position.facilityId === plan.facilityId && position.skuId === plan.skuId);
    if (!inventoryPosition) continue;
    inventoryPosition.onHandUnits += producedUnits;
    inventoryPosition.asOf = toTime;
    events.push({
      id: `evt-production-${plan.id}-${toTime}`,
      occurredAt: toTime,
      type: "production",
      severity: multiplier < 0.85 ? "high" : "low",
      title: multiplier < 0.85 ? "Production shortfall posted" : "Production completed",
      description: `${producedUnits.toLocaleString()} units produced for ${plan.skuId}.`
    });
  }
  return next;
}

function moveShipments(
  shipments: Shipment[],
  disruptions: Disruption[],
  fromTime: string,
  toTime: string,
  events: SimulationEvent[]
): Shipment[] {
  return shipments.map((shipment) => {
    let next = { ...shipment };
    const delayHours = disruptions
      .filter((disruption) => disruption.laneId === shipment.laneId || disruption.businessUnit === shipment.businessUnit || !disruption.businessUnit)
      .filter((disruption) => disruption.type !== "heat_wave_demand_spike" && disruption.type !== "production_shortfall")
      .reduce((sum, disruption) => sum + (disruption.effect.delayHours ?? 0), 0);

    if (isWithin(shipment.plannedDepartureAt, fromTime, toTime) && ["planned", "accepted", "tendered"].includes(shipment.status)) {
      next = {
        ...next,
        status: delayHours > 0 ? "delayed" : "in_transit",
        actualDepartureAt: toTime,
        delayHours: next.delayHours + delayHours,
        currentEta: addHours(next.currentEta, delayHours)
      };
      events.push({
        id: `evt-ship-depart-${shipment.id}-${toTime}`,
        occurredAt: toTime,
        type: "shipment",
        severity: delayHours > 0 ? "high" : "low",
        title: delayHours > 0 ? "Shipment delayed at departure" : "Shipment departed",
        description: `${shipment.id} moved from ${shipment.originFacilityId} toward ${shipment.destinationFacilityId}.`
      });
    }

    if (isWithin(next.currentEta, fromTime, toTime) && ["in_transit", "delayed"].includes(next.status)) {
      next = {
        ...next,
        status: next.delayHours > 16 ? "missed" : "delivered",
        actualArrivalAt: toTime
      };
      events.push({
        id: `evt-ship-arrive-${shipment.id}-${toTime}`,
        occurredAt: toTime,
        type: "shipment",
        severity: next.status === "missed" ? "high" : "low",
        title: next.status === "missed" ? "Shipment missed service window" : "Shipment delivered",
        description: `${shipment.id} arrived with ${next.delayHours} delay hours.`
      });
    }

    if (new Date(toTime) > new Date(next.plannedArrivalAt) && !["delivered", "missed"].includes(next.status)) {
      next = {
        ...next,
        status: "delayed",
        dwellHours: next.dwellHours + hoursBetween(fromTime, toTime)
      };
    }

    return next;
  });
}

function updateOrders(orders: Order[], shipments: Shipment[], now: string): Order[] {
  return orders.map((order) => {
    const related = shipments.filter((shipment) => shipment.customerId === order.customerId && shipment.businessUnit === order.businessUnit);
    const delivered = related.some((shipment) => shipment.status === "delivered" && new Date(shipment.actualArrivalAt ?? shipment.currentEta) <= new Date(order.requestedDeliveryAt));
    const missed = new Date(now) > new Date(order.requestedDeliveryAt) && !delivered;
    if (delivered) return { ...order, status: "delivered" };
    if (missed) return { ...order, status: "missed" };
    if (hoursBetween(now, order.requestedDeliveryAt) <= 18) return { ...order, status: "at_risk" };
    return order;
  });
}

function detectExceptions(state: ScenarioState): ControlTowerException[] {
  const exceptions: ControlTowerException[] = [];

  for (const shipment of state.shipments) {
    if (["delivered", "missed"].includes(shipment.status)) continue;
    const hoursLate = hoursBetween(shipment.plannedArrivalAt, shipment.currentEta);
    if (hoursLate >= 6 || shipment.status === "delayed") {
      const severity = hoursLate >= 18 ? "critical" : hoursLate >= 12 ? "high" : "medium";
      exceptions.push({
        id: `ex-late-${shipment.id}`,
        type: "late_shipment",
        severity,
        businessUnit: shipment.businessUnit,
        title: `Late shipment risk: ${shipment.id}`,
        description: `${shipment.id} is projected ${Math.max(6, Math.round(hoursLate))} hours late.`,
        impactedEntityId: shipment.id,
        impactedEntityType: "shipment",
        rootCause: "Active disruption, congestion, or carrier delay",
        detectedAt: state.currentTime,
        timeToImpactHours: Math.max(0, hoursBetween(state.currentTime, shipment.plannedArrivalAt)),
        estimatedServiceImpact: severityRank[severity] * 12,
        estimatedCostImpact: severityRank[severity] * 850,
        recommendation: recommendForLateShipment(shipment, severity)
      });
    }

    if (shipment.dwellHours >= 8) {
      exceptions.push({
        id: `ex-dwell-${shipment.id}`,
        type: "excess_dwell",
        severity: shipment.dwellHours >= 18 ? "high" : "medium",
        businessUnit: shipment.businessUnit,
        title: `Excess dwell: ${shipment.id}`,
        description: `${shipment.id} has ${Math.round(shipment.dwellHours)} dwell hours.`,
        impactedEntityId: shipment.id,
        impactedEntityType: "shipment",
        detectedAt: state.currentTime,
        timeToImpactHours: 0,
        estimatedServiceImpact: 10,
        estimatedCostImpact: 500,
        recommendation: manualReview("Investigate dwell and delivery appointment status")
      });
    }
  }

  for (const position of state.inventory) {
    const sku = state.skus.find((candidate) => candidate.id === position.skuId);
    if (!sku) continue;
    const available = position.onHandUnits - position.reservedUnits;
    if (available < position.safetyStockUnits) {
      const ratio = available / Math.max(1, position.safetyStockUnits);
      const severity = ratio < 0.35 ? "critical" : ratio < 0.65 ? "high" : "medium";
      exceptions.push({
        id: `ex-inv-${position.facilityId}-${position.skuId}`,
        type: ratio < 0.5 ? "projected_stockout" : "inventory_below_safety_stock",
        severity,
        businessUnit: sku.businessUnit,
        title: `Inventory risk: ${sku.name}`,
        description: `${position.facilityId} has ${available.toLocaleString()} available units against ${position.safetyStockUnits.toLocaleString()} safety stock.`,
        impactedEntityId: position.id,
        impactedEntityType: "inventory",
        rootCause: "Demand, production, or replenishment imbalance",
        detectedAt: state.currentTime,
        timeToImpactHours: ratio < 0.5 ? 12 : 24,
        estimatedServiceImpact: severityRank[severity] * 15,
        estimatedCostImpact: severityRank[severity] * 700,
        recommendation: {
          id: `rec-transfer-${position.id}`,
          type: "transfer_inventory",
          title: "Transfer inventory from alternate node",
          rationale: "Inventory is below safety stock and needs regional balancing before service impact.",
          estimatedCost: severityRank[severity] * 900,
          estimatedServiceRecovery: severityRank[severity] * 18,
          requiresApproval: severity === "critical"
        }
      });
    }
  }

  for (const order of state.orders.filter((candidate) => candidate.status === "at_risk" || candidate.status === "missed")) {
    exceptions.push({
      id: `ex-order-${order.id}`,
      type: order.status === "missed" ? "missed_delivery_window" : "order_at_risk",
      severity: order.status === "missed" ? "critical" : order.priority === "standard" ? "medium" : "high",
      businessUnit: order.businessUnit,
      title: order.status === "missed" ? `Missed delivery: ${order.id}` : `Order at risk: ${order.id}`,
      description: `${order.id} for ${order.customerId} is ${order.status.replace("_", " ")}.`,
      impactedEntityId: order.id,
      impactedEntityType: "order",
      rootCause: "Delivery window pressure",
      detectedAt: state.currentTime,
      timeToImpactHours: Math.max(0, hoursBetween(state.currentTime, order.requestedDeliveryAt)),
      estimatedServiceImpact: order.status === "missed" ? 60 : 28,
      estimatedCostImpact: order.status === "missed" ? 4500 : 1400,
      recommendation: order.status === "missed" ? manualReview("Escalate customer communication and recovery plan") : {
        id: `rec-priority-${order.id}`,
        type: "prioritize_customer",
        title: "Prioritize customer order",
        rationale: "Service commitment is within the risk window.",
        estimatedCost: 750,
        estimatedServiceRecovery: 24,
        requiresApproval: false
      }
    });
  }

  return exceptions.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, 80);
}

function calculateMetrics(state: ScenarioState): SimulationMetrics {
  const completed = state.shipments.filter((shipment) => ["delivered", "missed"].includes(shipment.status));
  const onTime = completed.filter((shipment) => shipment.status === "delivered" && shipment.delayHours <= 4);
  const openExceptions = state.exceptions.length;
  const criticalExceptions = state.exceptions.filter((exception) => exception.severity === "critical").length;
  const projectedStockouts = state.exceptions.filter((exception) => exception.type === "projected_stockout").length;
  const ordersAtRisk = state.orders.filter((order) => order.status === "at_risk" || order.status === "missed").length;
  const delayed = state.shipments.filter((shipment) => shipment.delayHours > 0);
  const recoveryCostEstimate = state.exceptions.reduce((sum, exception) => sum + (exception.recommendation?.estimatedCost ?? exception.estimatedCostImpact), 0);

  return {
    onTimeDeliveryPct: completed.length === 0 ? 100 : Math.round((onTime.length / completed.length) * 100),
    openExceptions,
    criticalExceptions,
    projectedStockouts,
    ordersAtRisk,
    averageDelayHours: delayed.length === 0 ? 0 : Math.round(delayed.reduce((sum, shipment) => sum + shipment.delayHours, 0) / delayed.length),
    carrierFailureCount: state.exceptions.filter((exception) => exception.type === "carrier_failure").length,
    inventoryBelowSafetyStock: state.exceptions.filter((exception) => exception.type === "inventory_below_safety_stock").length,
    serviceImpactEstimate: state.exceptions.reduce((sum, exception) => sum + exception.estimatedServiceImpact, 0),
    recoveryCostEstimate
  };
}

function recommendForLateShipment(shipment: Shipment, severity: ControlTowerException["severity"]): ActionRecommendation {
  if (severity === "critical" || severity === "high") {
    return {
      id: `rec-expedite-${shipment.id}`,
      type: "expedite_shipment",
      title: "Expedite or retender shipment",
      rationale: "Shipment delay threatens the delivery window and needs transportation recovery.",
      estimatedCost: severityRank[severity] * 1200,
      estimatedServiceRecovery: severityRank[severity] * 20,
      requiresApproval: severity === "critical"
    };
  }
  return {
    id: `rec-monitor-${shipment.id}`,
    type: "move_appointment",
    title: "Confirm delivery appointment",
    rationale: "Shipment is delayed but may still be recoverable through appointment adjustment.",
    estimatedCost: 250,
    estimatedServiceRecovery: 10,
    requiresApproval: false
  };
}

function manualReview(rationale: string): ActionRecommendation {
  return {
    id: `rec-review-${rationale.toLowerCase().replaceAll(" ", "-").slice(0, 24)}`,
    type: "manual_review",
    title: "Trigger manual review",
    rationale,
    estimatedCost: 0,
    estimatedServiceRecovery: 5,
    requiresApproval: false
  };
}

function exceptionToEvent(exception: ControlTowerException): SimulationEvent {
  return {
    id: `evt-${exception.id}-${exception.detectedAt}`,
    occurredAt: exception.detectedAt,
    type: "exception",
    severity: exception.severity,
    title: exception.title,
    description: exception.description
  };
}

function mergeExceptions(existing: ControlTowerException[], incoming: ControlTowerException[]): ControlTowerException[] {
  const byId = new Map<string, ControlTowerException>();
  for (const exception of existing) byId.set(exception.id, exception);
  for (const exception of incoming) byId.set(exception.id, exception);
  return [...byId.values()].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, 100);
}

function isActive(disruption: Disruption, fromTime: string, toTime: string): boolean {
  return new Date(disruption.startsAt) <= new Date(toTime) && new Date(disruption.endsAt) >= new Date(fromTime);
}

function isWithin(iso: string, fromTime: string, toTime: string): boolean {
  return new Date(iso) > new Date(fromTime) && new Date(iso) <= new Date(toTime);
}

function likelySource(facilityId: string, destinationFacilityId: string, businessUnit: Order["businessUnit"]): boolean {
  if (businessUnit === "beverage") {
    if (destinationFacilityId.includes("hou")) return facilityId === "bev-dc-hou";
    if (destinationFacilityId.includes("okc")) return facilityId === "bev-xdock-okc";
    return facilityId === "bev-dc-dfw";
  }
  if (destinationFacilityId.includes("hou")) return facilityId === "fl-wh-hou";
  if (destinationFacilityId.includes("okc")) return facilityId === "fl-wh-okc";
  if (destinationFacilityId.includes("aus") || destinationFacilityId.includes("stores")) return facilityId === "fl-wh-aus";
  return facilityId === "fl-mix-dfw";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
