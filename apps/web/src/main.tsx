import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock,
  Gauge,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  StepForward,
  Truck,
  Zap
} from "lucide-react";
import { createTexasOklahomaScenario } from "@control-tower/data-gen";
import { stepSimulation } from "@control-tower/simulation";
import type { AutomationDecision, BusinessUnit, ScenarioState, Shipment } from "@control-tower/domain";
import { apiMode, fetchScenario, resetScenario, runScenario, stepScenario } from "./api";
import "./styles.css";

const agentRoles = [
  {
    name: "Exception Classifier",
    role: "Detects repeated exception patterns and picks the recovery playbook."
  },
  {
    name: "Transportation Recovery",
    role: "Retenders, expedites, monitors, and sequences appointment recovery."
  },
  {
    name: "Inventory Balancing",
    role: "Protects safety stock, pull-forward replenishment, and allocation risk."
  },
  {
    name: "Customer Promise",
    role: "Prioritizes key accounts, promotions, delivery windows, and OTIF exposure."
  },
  {
    name: "Policy + Finance",
    role: "Checks cost caps, approval thresholds, service recovery, and execution guardrails."
  }
] as const;

type CorridorTone = "south" | "northeast" | "west" | "midwest";

interface CorridorNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface Corridor {
  name: string;
  tone: CorridorTone;
  nodes: CorridorNode[];
}

const texasOklahomaCorridor: Corridor = {
  name: "Texas / Oklahoma",
  tone: "south",
  nodes: [
    { id: "sat", label: "San Antonio", x: 47, y: 77 },
    { id: "hou", label: "Houston", x: 53, y: 75 },
    { id: "dfw", label: "Dallas", x: 52, y: 68 },
    { id: "okc", label: "OKC", x: 53, y: 62 },
    { id: "tul", label: "Tulsa", x: 56, y: 60 }
  ]
};

const northeastCorridor: Corridor = {
  name: "Northeast",
  tone: "northeast",
  nodes: [
    { id: "mtl", label: "Montreal", x: 78, y: 24 },
    { id: "bos", label: "Boston", x: 82, y: 34 },
    { id: "nyc", label: "NYC", x: 79, y: 41 },
    { id: "phl", label: "Philadelphia", x: 77, y: 45 },
    { id: "dc", label: "DC", x: 75, y: 50 }
  ]
};

const westCoastCorridor: Corridor = {
  name: "West Coast",
  tone: "west",
  nodes: [
    { id: "sac", label: "Sacramento", x: 16, y: 55 },
    { id: "pdx", label: "Portland", x: 16, y: 40 },
    { id: "sea", label: "Seattle", x: 17, y: 34 },
    { id: "van", label: "Vancouver", x: 18, y: 29 }
  ]
};

const midwestCorridor: Corridor = {
  name: "Midwest",
  tone: "midwest",
  nodes: [
    { id: "tor", label: "Toronto", x: 70, y: 39 },
    { id: "det", label: "Detroit", x: 65, y: 44 },
    { id: "chi", label: "Chicago", x: 58, y: 48 },
    { id: "msp", label: "Minneapolis", x: 49, y: 43 }
  ]
};

const corridors: Corridor[] = [texasOklahomaCorridor, northeastCorridor, westCoastCorridor, midwestCorridor];

function App() {
  const [scenario, setScenario] = useState<ScenarioState>(() => createTexasOklahomaScenario());
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit | "all">("all");
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState(apiMode === "api" ? "API mode" : "Local simulation mode");

  useEffect(() => {
    if (apiMode !== "api") return;
    fetchScenario()
      .then((nextScenario) => {
        setScenario(nextScenario);
        setStatusMessage("Connected to API");
      })
      .catch((error: unknown) => {
        setStatusMessage(error instanceof Error ? error.message : "API connection failed");
      });
  }, []);

  const filteredShipments = useMemo(
    () => scenario.shipments.filter((shipment) => businessUnit === "all" || shipment.businessUnit === businessUnit),
    [scenario.shipments, businessUnit]
  );

  const searchableShipments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return filteredShipments;
    return filteredShipments.filter((shipment) => {
      const customer = scenario.customers.find((item) => item.id === shipment.customerId);
      const origin = scenario.facilities.find((item) => item.id === shipment.originFacilityId);
      const destination = scenario.facilities.find((item) => item.id === shipment.destinationFacilityId);
      return [shipment.id, shipment.status, shipment.businessUnit, customer?.name, origin?.name, destination?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [filteredShipments, query, scenario.customers, scenario.facilities]);

  const priorityShipment = useMemo(() => {
    return (
      searchableShipments.find((shipment) => shipment.status === "delayed") ??
      searchableShipments.find((shipment) => shipment.status === "missed") ??
      searchableShipments.find((shipment) => shipment.status === "in_transit") ??
      searchableShipments[0]
    );
  }, [searchableShipments]);

  const selectedShipment = useMemo(() => {
    return (
      searchableShipments.find((shipment) => shipment.id === selectedShipmentId) ??
      scenario.shipments.find((shipment) => shipment.id === selectedShipmentId) ??
      priorityShipment
    );
  }, [priorityShipment, scenario.shipments, searchableShipments, selectedShipmentId]);

  const selectedException = useMemo(() => {
    if (!selectedShipment) return undefined;
    return scenario.exceptions.find((exception) => exception.impactedEntityId === selectedShipment.id);
  }, [scenario.exceptions, selectedShipment]);

  const selectedDecision = useMemo(() => {
    if (!selectedException) return undefined;
    return scenario.automationDecisions.find((decision) => decision.exceptionId === selectedException.id);
  }, [scenario.automationDecisions, selectedException]);

  const activeTrucks = useMemo(() => {
    return searchableShipments
      .filter((shipment) => ["accepted", "in_transit", "delayed", "missed", "planned"].includes(shipment.status))
      .slice(0, 12);
  }, [searchableShipments]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      void advance(1, "auto");
    }, Math.max(350, 1800 / speed));
    return () => window.clearInterval(interval);
  }, [isPlaying, scenario, speed]);

  async function advance(count = 1, source: "manual" | "auto" = "manual") {
    if (isBusy && source === "manual") return;
    if (source === "manual") setIsBusy(true);
    try {
      if (apiMode === "api") {
        const next = count === 1 ? await stepScenario() : await runScenario(count);
        setScenario(next);
        setStatusMessage(`API advanced ${count * scenario.tickHours}h`);
      } else {
        let next = scenario;
        for (let index = 0; index < count; index += 1) {
          next = stepSimulation(next).state;
        }
        setScenario(next);
        setStatusMessage(`${source === "auto" ? "Live" : "Local"} simulation advanced ${count * scenario.tickHours}h`);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Simulation request failed");
      setIsPlaying(false);
    } finally {
      if (source === "manual") setIsBusy(false);
    }
  }

  async function reset() {
    setIsBusy(true);
    try {
      const next = apiMode === "api" ? await resetScenario() : createTexasOklahomaScenario();
      setScenario(next);
      setSelectedShipmentId(undefined);
      setStatusMessage(apiMode === "api" ? "API scenario reset" : "Local scenario reset");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="command-shell">
      <aside className="side-rail">
        <div className="brand-mark">
          <Sparkles size={22} />
          <div>
            <strong>Autonomous Control Tower</strong>
            <span>TX-OK live operations</span>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Workspace sections">
          <a href="#journey"><Truck size={18} /> Journey</a>
          <a href="#field"><MapPin size={18} /> Trucks</a>
          <a href="#agents"><Bot size={18} /> Agents</a>
        </nav>
        <div className="agent-primer">
          <span className="section-kicker">Agent Layer</span>
          {agentRoles.map((agent) => (
            <article key={agent.name}>
              <strong>{agent.name}</strong>
              <p>{agent.role}</p>
            </article>
          ))}
        </div>
      </aside>

      <section className="ops-surface">
        <header className="command-bar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shipment, customer, facility, status"
            />
          </div>
          <label className="unit-select">
            <span>Business unit</span>
            <select value={businessUnit} onChange={(event) => setBusinessUnit(event.target.value as BusinessUnit | "all")}>
              <option value="all">All</option>
              <option value="beverage">Beverage</option>
              <option value="frito_lay">Frito-Lay</option>
            </select>
          </label>
          <div className="sim-controls">
            <button onClick={() => setIsPlaying((value) => !value)} disabled={isBusy}>
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={() => void advance(1)} disabled={isBusy}>
              <StepForward size={17} />
              Step
            </button>
            <button onClick={() => void reset()} disabled={isBusy}>
              <RotateCcw size={17} />
              Reset
            </button>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              <option value={1}>1x</option>
              <option value={5}>5x</option>
              <option value={20}>20x</option>
            </select>
          </div>
        </header>

        <section className="hero-strip">
          <div>
            <span className="section-kicker">Live Simulation</span>
            <h1>Agents are resolving control-tower exceptions in real time.</h1>
          </div>
          <div className="clock-chip">
            <Clock size={18} />
            <span>{new Date(scenario.currentTime).toLocaleString()}</span>
          </div>
        </section>

        <section className="metrics-strip" aria-label="Automation metrics">
          <Metric icon={<Gauge size={19} />} label="Automation coverage" value={`${scenario.metrics.automationCoveragePct}%`} />
          <Metric icon={<CheckCircle2 size={19} />} label="Auto-executed" value={scenario.metrics.autoExecuted.toString()} />
          <Metric icon={<ShieldCheck size={19} />} label="Needs approval" value={scenario.metrics.needsApproval.toString()} />
          <Metric icon={<Clock size={19} />} label="Planner hours saved" value={`${scenario.metrics.plannerHoursSaved}h`} />
          <Metric icon={<AlertTriangle size={19} />} label="Open exceptions" value={scenario.metrics.openExceptions.toString()} />
        </section>

        <section className="command-grid">
          <section className="mission-panel map-panel" id="field">
            <PanelTitle icon={<MapPin size={18} />} title="North America Field Map" />
            <NorthAmericaField
              scenario={scenario}
              shipments={activeTrucks}
              selectedShipment={selectedShipment}
              onSelect={setSelectedShipmentId}
            />
          </section>

          <section className="mission-panel journey-panel" id="journey">
            <PanelTitle icon={<Truck size={18} />} title="Shipment Journey" />
            {selectedShipment ? (
              <ShipmentJourney
                decision={selectedDecision}
                scenario={scenario}
                shipment={selectedShipment}
                exceptionTitle={selectedException?.title}
              />
            ) : (
              <p className="empty">No shipment selected.</p>
            )}
          </section>

          <section className="mission-panel truck-panel">
            <PanelTitle icon={<Truck size={18} />} title="Active Loads" />
            <div className="truck-list">
              {activeTrucks.map((shipment) => (
                <button
                  className={`truck-card ${shipmentStatus(shipment)} ${shipment.id === selectedShipment?.id ? "selected" : ""}`}
                  key={shipment.id}
                  onClick={() => setSelectedShipmentId(shipment.id)}
                >
                  <div>
                    <strong>{shipment.id}</strong>
                    <span>{laneLabel(scenario, shipment)}</span>
                  </div>
                  <StatusBadge status={shipmentStatus(shipment)} />
                  <small>{marketPosition(scenario, shipment)}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="mission-panel agent-panel" id="agents">
            <PanelTitle icon={<Bot size={18} />} title="Agent Console" />
            <AgentConsole decision={selectedDecision} decisions={scenario.automationDecisions} />
          </section>
        </section>

        <footer className="activity-rail">
          <span>{statusMessage}</span>
          {scenario.events.slice(0, 6).map((event) => (
            <span key={event.id}>{event.title}</span>
          ))}
        </footer>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric-tile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="panel-title">
      {icon}
      {title}
    </h2>
  );
}

function NorthAmericaField({
  scenario,
  shipments,
  selectedShipment,
  onSelect
}: {
  scenario: ScenarioState;
  shipments: Shipment[];
  selectedShipment: Shipment | undefined;
  onSelect: (shipmentId: string) => void;
}) {
  return (
    <div className="field-map north-america-map" aria-label="North America truck field map">
      <svg className="continent-map" viewBox="0 0 100 100" role="img" aria-label="North America lanes">
        <path
          className="continent-shape"
          d="M12 13 C20 7 33 10 40 17 C49 9 62 9 70 18 C80 17 89 24 91 36 C84 43 82 53 78 61 C71 66 64 66 60 73 C54 80 43 82 35 77 C30 72 26 69 21 67 C14 63 9 55 11 47 C15 39 9 30 12 13 Z"
        />
        <path
          className="continent-shape lower"
          d="M38 73 C45 77 50 84 48 90 C42 90 36 87 33 81 C30 76 33 72 38 73 Z"
        />
        <path
          className="lake-shape"
          d="M58 39 C61 36 68 36 70 40 C68 43 61 44 58 39 Z M69 36 C72 34 76 35 77 38 C74 40 70 40 69 36 Z"
        />
        {corridors.map((corridor) => (
          <polyline className={`corridor-line ${corridor.tone}`} key={corridor.name} points={corridorPath(corridor)} />
        ))}
        {corridors.flatMap((corridor) =>
          corridor.nodes.map((node) => (
            <g className={`corridor-node ${corridor.tone}`} key={`${corridor.name}-${node.id}`}>
              <circle cx={node.x} cy={node.y} r="1.6" />
              <text x={node.x + 2.2} y={node.y - 1.6}>
                {node.label}
              </text>
            </g>
          ))
        )}
      </svg>

      {shipments.map((shipment, index) => {
        const corridor = corridorForShipment(shipment, index);
        const point = pointOnCorridor(corridor, progressRatio(scenario.currentTime, shipment));
        const status = shipmentStatus(shipment);
        return (
          <button
            className={`truck-pin ${status} ${shipment.id === selectedShipment?.id ? "selected" : ""} ${corridor.tone}`}
            key={shipment.id}
            onClick={() => onSelect(shipment.id)}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${shipment.id} on ${corridor.name}`}
          >
            <Truck size={15} />
          </button>
        );
      })}
      <div className="map-legend" aria-label="Corridor legend">
        {corridors.map((corridor) => (
          <span key={corridor.name}>
            <i className={corridor.tone} />
            {corridor.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShipmentJourney({
  decision,
  exceptionTitle,
  scenario,
  shipment
}: {
  decision: AutomationDecision | undefined;
  exceptionTitle: string | undefined;
  scenario: ScenarioState;
  shipment: Shipment;
}) {
  const stages = shipmentStages(shipment, decision);
  return (
    <div className="journey-stack">
      <div className="shipment-identity">
        <div>
          <span className="section-kicker">{formatBusinessUnit(shipment.businessUnit)}</span>
          <h3>{shipment.id}</h3>
          <p>{laneLabel(scenario, shipment)}</p>
        </div>
        <StatusBadge status={shipmentStatus(shipment)} />
      </div>
      <div className="journey-line">
        {stages.map((stage) => (
          <div className={`journey-step ${stage.state}`} key={stage.label}>
            <CircleDot size={18} />
            <strong>{stage.label}</strong>
            <span>{stage.detail}</span>
          </div>
        ))}
      </div>
      <div className="selected-context">
        <div>
          <span>ETA</span>
          <strong>{new Date(shipment.currentEta).toLocaleString()}</strong>
        </div>
        <div>
          <span>Delay</span>
          <strong>{shipment.delayHours}h</strong>
        </div>
        <div>
          <span>Agent action</span>
          <strong>{decision?.selectedAction.title ?? "Monitoring"}</strong>
        </div>
      </div>
      {exceptionTitle && <p className="exception-callout">{exceptionTitle}</p>}
    </div>
  );
}

function AgentConsole({ decision, decisions }: { decision: AutomationDecision | undefined; decisions: AutomationDecision[] }) {
  const activeDecision = decision ?? decisions[0];
  if (!activeDecision) {
    return (
      <div className="agent-empty">
        <Bot size={28} />
        <p>Agents are monitoring. Let the simulation run until exceptions appear.</p>
      </div>
    );
  }

  return (
    <div className="agent-console">
      <div className={`decision-banner ${activeDecision.status}`}>
        <span>{activeDecision.status.replaceAll("_", " ")}</span>
        <strong>{activeDecision.selectedAction.title}</strong>
        <p>{activeDecision.policyResult.reason}</p>
      </div>
      <div className="tradeoff">
        <span>${activeDecision.estimatedCost.toLocaleString()} recovery cost</span>
        <span>{activeDecision.estimatedServiceRecovery} service recovery</span>
      </div>
      <div className="agent-trace">
        {activeDecision.agentTrace.map((step) => (
          <article key={`${activeDecision.id}-${step.agent}`}>
            <strong>{step.agent}</strong>
            <p>{step.finding}</p>
            <span>{Math.round(step.confidence * 100)}% confidence</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function shipmentStages(shipment: Shipment, decision?: AutomationDecision): Array<{ label: string; detail: string; state: string }> {
  const labels: Array<{ label: string; detail: string }> = [
    { label: "Tendered", detail: "Load created" },
    { label: "Accepted", detail: "Carrier confirmed" },
    { label: "Pickup", detail: "Origin departure" },
    { label: "In transit", detail: "Truck in field" },
    { label: "At risk", detail: "Exception detected" },
    { label: "Agent action", detail: decision?.selectedAction.title ?? "Monitoring" },
    { label: "Delivered", detail: "Closed loop" }
  ];
  const activeIndex = stageIndex(shipment, decision);
  return labels.map((item, index) => ({
    label: item.label,
    detail: item.detail,
    state: index < activeIndex ? "complete" : index === activeIndex ? "active" : "future"
  }));
}

function stageIndex(shipment: Shipment, decision?: AutomationDecision): number {
  if (shipment.status === "delivered") return 6;
  if (decision) return 5;
  if (shipment.status === "delayed" || shipment.status === "missed") return 4;
  if (shipment.status === "in_transit") return 3;
  if (shipment.actualDepartureAt) return 2;
  if (shipment.status === "accepted") return 1;
  return 0;
}

function shipmentStatus(shipment: Shipment): "on_time" | "delayed" | "missed" | "recovering" {
  if (shipment.status === "missed") return "missed";
  if (shipment.status === "delayed") return shipment.delayHours >= 12 ? "recovering" : "delayed";
  return "on_time";
}

function StatusBadge({ status }: { status: ReturnType<typeof shipmentStatus> }) {
  return <span className={`field-status ${status}`}>{status.replace("_", " ")}</span>;
}

function laneLabel(scenario: ScenarioState, shipment: Shipment): string {
  const origin = scenario.facilities.find((facility) => facility.id === shipment.originFacilityId);
  const destination = scenario.facilities.find((facility) => facility.id === shipment.destinationFacilityId);
  return `${origin?.market ?? shipment.originFacilityId} → ${destination?.market ?? shipment.destinationFacilityId}`;
}

function marketPosition(scenario: ScenarioState, shipment: Shipment): string {
  const origin = scenario.facilities.find((facility) => facility.id === shipment.originFacilityId);
  const destination = scenario.facilities.find((facility) => facility.id === shipment.destinationFacilityId);
  if (shipment.status === "planned" || shipment.status === "accepted") return `Staged near ${origin?.market ?? "origin"}`;
  if (shipment.status === "delivered") return `Arrived at ${destination?.market ?? "destination"}`;
  if (shipment.status === "missed") return `Missed near ${destination?.market ?? "destination"}`;
  return `En route to ${destination?.market ?? "destination"}`;
}

function progressRatio(currentTime: string, shipment: Shipment): number {
  if (shipment.status === "delivered" || shipment.status === "missed") return 1;
  if (shipment.status === "planned" || shipment.status === "accepted") return 0.08;
  const planned = new Date(shipment.plannedDepartureAt).getTime();
  const eta = new Date(shipment.currentEta).getTime();
  const now = new Date(currentTime).getTime();
  if (eta <= planned) return 0.5;
  return Math.min(0.92, Math.max(0.12, (now - planned) / (eta - planned)));
}

function corridorForShipment(shipment: Shipment, index: number): Corridor {
  const laneText = `${shipment.originFacilityId} ${shipment.destinationFacilityId}`.toLowerCase();
  if (laneText.includes("montreal") || laneText.includes("boston")) return northeastCorridor;
  if (laneText.includes("sacramento") || laneText.includes("vancouver")) return westCoastCorridor;
  if (laneText.includes("toronto") || laneText.includes("detroit")) return midwestCorridor;
  return corridors[index % corridors.length] ?? texasOklahomaCorridor;
}

function corridorPath(corridor: Corridor): string {
  return corridor.nodes.map((node) => `${node.x},${node.y}`).join(" ");
}

function pointOnCorridor(corridor: Corridor, progress: number): { x: number; y: number } {
  const segmentCount = corridor.nodes.length - 1;
  const rawSegment = Math.min(segmentCount - 0.001, Math.max(0, progress * segmentCount));
  const segmentIndex = Math.floor(rawSegment);
  const localProgress = rawSegment - segmentIndex;
  const from = corridor.nodes[segmentIndex] ?? corridor.nodes[0];
  if (!from) return { x: 50, y: 50 };
  const to = corridor.nodes[segmentIndex + 1] ?? from;
  return {
    x: from.x + (to.x - from.x) * localProgress,
    y: from.y + (to.y - from.y) * localProgress
  };
}

function formatBusinessUnit(value: BusinessUnit): string {
  return value === "beverage" ? "Beverage" : "Frito-Lay";
}

createRoot(document.getElementById("root")!).render(<App />);
