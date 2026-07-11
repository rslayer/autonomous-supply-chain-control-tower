export type BusinessUnit = "beverage" | "frito_lay";

export type FacilityType =
  | "plant"
  | "dc"
  | "mixing_center"
  | "warehouse"
  | "cross_dock"
  | "customer_dc"
  | "store_cluster";

export type ShipmentStatus =
  | "planned"
  | "tendered"
  | "accepted"
  | "in_transit"
  | "delayed"
  | "delivered"
  | "missed";

export type ShipmentMode = "truckload" | "ltl" | "intermodal" | "dsd";

export type Severity = "low" | "medium" | "high" | "critical";

export type ExceptionType =
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

export type DisruptionType =
  | "heat_wave_demand_spike"
  | "severe_storm_delay"
  | "carrier_pickup_failure"
  | "missed_delivery_appointment"
  | "warehouse_congestion"
  | "production_shortfall"
  | "trailer_shortage"
  | "highway_delay"
  | "customer_order_surge";

export type RecommendationType =
  | "expedite_shipment"
  | "retender_to_backup_carrier"
  | "transfer_inventory"
  | "split_shipment"
  | "prioritize_customer"
  | "move_appointment"
  | "manual_review"
  | "increase_production";

export type AutomationStatus =
  | "auto_executed"
  | "auto_recommended"
  | "needs_approval"
  | "manual_only";

export type AgentName =
  | "Exception Classifier Agent"
  | "Transportation Recovery Agent"
  | "Inventory Balancing Agent"
  | "Customer Promise Agent"
  | "Policy Agent"
  | "Finance Agent"
  | "Coordinator Agent";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  market: string;
  state: "TX" | "OK";
  businessUnits: BusinessUnit[];
  location: GeoPoint;
  capacityUnits: number;
  congestionLevel: number;
  address?: string;
  role?: string;
  sourceNote?: string;
  squareFeet?: number;
}

export interface Sku {
  id: string;
  name: string;
  businessUnit: BusinessUnit;
  category: string;
  unitWeight: number;
  unitCube: number;
  shelfLifeDays: number;
  casePack: number;
  velocity: "low" | "medium" | "high";
}

export interface Customer {
  id: string;
  name: string;
  type: "retail_dc" | "club_dc" | "grocery_dc" | "convenience" | "foodservice" | "store_cluster";
  market: string;
  state: "TX" | "OK";
  priority: "standard" | "key_account" | "promotional";
  location: GeoPoint;
}

export interface Carrier {
  id: string;
  name: string;
  reliability: number;
  costPerMile: number;
  modes: ShipmentMode[];
  capacityPerDay: number;
}

export interface Lane {
  id: string;
  originFacilityId: string;
  destinationFacilityId: string;
  miles: number;
  mode: ShipmentMode;
  baseTransitHours: number;
  businessUnits: BusinessUnit[];
  primaryCarrierId: string;
  backupCarrierId: string;
}

export interface InventoryPosition {
  id: string;
  facilityId: string;
  skuId: string;
  onHandUnits: number;
  safetyStockUnits: number;
  reservedUnits: number;
  asOf: string;
}

export interface OrderLine {
  skuId: string;
  quantityUnits: number;
}

export interface Order {
  id: string;
  customerId: string;
  destinationFacilityId: string;
  businessUnit: BusinessUnit;
  lines: OrderLine[];
  createdAt: string;
  requestedDeliveryAt: string;
  priority: "standard" | "key_account" | "promotional";
  status: "open" | "allocated" | "shipped" | "delivered" | "at_risk" | "missed";
}

export interface ShipmentLine {
  skuId: string;
  quantityUnits: number;
}

export interface Shipment {
  id: string;
  businessUnit: BusinessUnit;
  originFacilityId: string;
  destinationFacilityId: string;
  customerId?: string;
  carrierId: string;
  laneId: string;
  mode: ShipmentMode;
  status: ShipmentStatus;
  lines: ShipmentLine[];
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  currentEta: string;
  actualDepartureAt?: string;
  actualArrivalAt?: string;
  delayHours: number;
  dwellHours: number;
}

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  occurredAt: string;
  type: "created" | "tendered" | "picked_up" | "delayed" | "arrived" | "delivered" | "missed";
  message: string;
}

export interface ProductionPlan {
  id: string;
  facilityId: string;
  skuId: string;
  plannedUnits: number;
  producedUnits: number;
  startsAt: string;
  endsAt: string;
}

export interface DemandForecast {
  id: string;
  customerId: string;
  skuId: string;
  forecastDate: string;
  forecastUnits: number;
  promotionLift: number;
}

export interface Disruption {
  id: string;
  type: DisruptionType;
  title: string;
  startsAt: string;
  endsAt: string;
  severity: Severity;
  market?: string;
  facilityId?: string;
  laneId?: string;
  businessUnit?: BusinessUnit;
  effect: {
    delayHours?: number;
    demandMultiplier?: number;
    productionMultiplier?: number;
    capacityMultiplier?: number;
    congestionIncrease?: number;
  };
}

export interface ControlTowerException {
  id: string;
  type: ExceptionType;
  severity: Severity;
  businessUnit: BusinessUnit;
  title: string;
  description: string;
  impactedEntityId: string;
  impactedEntityType: "shipment" | "order" | "inventory" | "facility" | "sku";
  rootCause?: string;
  detectedAt: string;
  timeToImpactHours: number;
  estimatedServiceImpact: number;
  estimatedCostImpact: number;
  recommendation?: ActionRecommendation;
}

export interface ActionRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  rationale: string;
  estimatedCost: number;
  estimatedServiceRecovery: number;
  requiresApproval: boolean;
}

export interface AgentTraceStep {
  agent: AgentName;
  finding: string;
  confidence: number;
  evidence: string[];
}

export interface AutomationDecision {
  id: string;
  exceptionId: string;
  status: AutomationStatus;
  selectedAction: ActionRecommendation;
  candidateActions: ActionRecommendation[];
  agentTrace: AgentTraceStep[];
  policyResult: {
    allowed: boolean;
    reason: string;
    approvalThreshold?: number;
  };
  estimatedCost: number;
  estimatedServiceRecovery: number;
  createdAt: string;
}

export interface SimulationMetrics {
  onTimeDeliveryPct: number;
  openExceptions: number;
  criticalExceptions: number;
  projectedStockouts: number;
  ordersAtRisk: number;
  averageDelayHours: number;
  carrierFailureCount: number;
  inventoryBelowSafetyStock: number;
  serviceImpactEstimate: number;
  recoveryCostEstimate: number;
  autoExecuted: number;
  autoRecommended: number;
  needsApproval: number;
  manualOnly: number;
  automationCoveragePct: number;
  touchlessResolutionPct: number;
  plannerHoursSaved: number;
}

export interface SimulationEvent {
  id: string;
  occurredAt: string;
  type: "demand" | "production" | "shipment" | "disruption" | "exception" | "recommendation";
  severity: Severity;
  title: string;
  description: string;
}

export interface ScenarioState {
  id: string;
  name: string;
  currentTime: string;
  tickHours: number;
  horizonDays: number;
  facilities: Facility[];
  skus: Sku[];
  customers: Customer[];
  carriers: Carrier[];
  lanes: Lane[];
  inventory: InventoryPosition[];
  orders: Order[];
  shipments: Shipment[];
  productionPlans: ProductionPlan[];
  demandForecasts: DemandForecast[];
  disruptions: Disruption[];
  exceptions: ControlTowerException[];
  automationDecisions: AutomationDecision[];
  events: SimulationEvent[];
  metrics: SimulationMetrics;
}

export const severityRank: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function addHours(iso: string, hours: number): string {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function hoursBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000;
}
