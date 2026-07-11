import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, Bot, Boxes, Building2, CheckCircle2, Clock, Filter, Play, RotateCcw, StepForward, Truck } from "lucide-react";
import { createTexasOklahomaScenario } from "@control-tower/data-gen";
import { stepSimulation } from "@control-tower/simulation";
import type { BusinessUnit, ScenarioState } from "@control-tower/domain";
import { apiMode, fetchScenario, resetScenario, runScenario, stepScenario } from "./api";
import { ImportPanel } from "./importPanel";
import type { CsvUploadValidationResult } from "@control-tower/importers";
import "./styles.css";

function App() {
  const [scenario, setScenario] = useState<ScenarioState>(() => createTexasOklahomaScenario());
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit | "all">("all");
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(apiMode === "api" ? "API mode" : "Local simulation mode");
  const [uploadResults, setUploadResults] = useState<CsvUploadValidationResult[]>([]);

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

  const filteredExceptions = useMemo(
    () => scenario.exceptions.filter((exception) => businessUnit === "all" || exception.businessUnit === businessUnit),
    [scenario.exceptions, businessUnit]
  );
  const filteredShipments = useMemo(
    () => scenario.shipments.filter((shipment) => businessUnit === "all" || shipment.businessUnit === businessUnit),
    [scenario.shipments, businessUnit]
  );
  const filteredSkus = useMemo(
    () => new Set(scenario.skus.filter((sku) => businessUnit === "all" || sku.businessUnit === businessUnit).map((sku) => sku.id)),
    [scenario.skus, businessUnit]
  );
  const riskInventory = scenario.inventory
    .filter((position) => filteredSkus.has(position.skuId))
    .map((position) => ({
      ...position,
      available: position.onHandUnits - position.reservedUnits,
      sku: scenario.skus.find((sku) => sku.id === position.skuId)
    }))
    .filter((position) => position.available < position.safetyStockUnits * 1.25)
    .sort((a, b) => a.available / a.safetyStockUnits - b.available / b.safetyStockUnits)
    .slice(0, 8);

  async function step(count = 1) {
    setIsBusy(true);
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
        setStatusMessage(`Local simulation advanced ${count * scenario.tickHours}h`);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Simulation request failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function reset() {
    setIsBusy(true);
    try {
      const next = apiMode === "api" ? await resetScenario() : createTexasOklahomaScenario();
      setScenario(next);
      setStatusMessage(apiMode === "api" ? "API scenario reset" : "Local scenario reset");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Texas-Oklahoma regional simulation</p>
          <h1>Autonomous Supply Chain Control Tower</h1>
        </div>
        <div className="timebox">
          <Clock size={18} />
          <span>{new Date(scenario.currentTime).toLocaleString()}</span>
        </div>
      </header>

      <section className="toolbar" aria-label="Simulation controls">
        <button onClick={() => void step(1)} disabled={isBusy}>
          <StepForward size={17} />
          Step 6h
        </button>
        <button onClick={() => void step(8)} disabled={isBusy}>
          <Play size={17} />
          Run 48h
        </button>
        <button onClick={() => void reset()} disabled={isBusy}>
          <RotateCcw size={17} />
          Reset
        </button>
        <label className="filter">
          <Filter size={17} />
          <select value={businessUnit} onChange={(event) => setBusinessUnit(event.target.value as BusinessUnit | "all")}>
            <option value="all">All units</option>
            <option value="beverage">Beverage</option>
            <option value="frito_lay">Frito-Lay style foods</option>
          </select>
        </label>
        <span className="mode-pill">{statusMessage}</span>
      </section>

      <section className="kpis" aria-label="Control tower KPIs">
        <Kpi icon={<Activity size={20} />} label="On-time" value={`${scenario.metrics.onTimeDeliveryPct}%`} />
        <Kpi icon={<AlertTriangle size={20} />} label="Open exceptions" value={filteredExceptions.length.toString()} />
        <Kpi icon={<Bot size={20} />} label="Automation coverage" value={`${scenario.metrics.automationCoveragePct}%`} />
        <Kpi icon={<CheckCircle2 size={20} />} label="Auto-executed" value={scenario.metrics.autoExecuted.toString()} />
        <Kpi icon={<Clock size={20} />} label="Hours saved" value={`${scenario.metrics.plannerHoursSaved}h`} />
      </section>

      <section className="grid">
        <Panel title="Network Overview" icon={<Building2 size={18} />}>
          <NetworkMap scenario={scenario} businessUnit={businessUnit} />
        </Panel>

        <Panel title="Exception Queue" icon={<AlertTriangle size={18} />}>
          <div className="exception-list">
            {filteredExceptions.slice(0, 9).map((exception) => (
              <article className={`exception ${exception.severity}`} key={exception.id}>
                <div>
                  <span className="severity">{exception.severity}</span>
                  <h3>{exception.title}</h3>
                  <p>{exception.description}</p>
                </div>
                <strong>{exception.recommendation?.title ?? "Review"}</strong>
              </article>
            ))}
            {filteredExceptions.length === 0 && <p className="empty">No exceptions yet. Step the simulation to create operational pressure.</p>}
          </div>
        </Panel>

        <Panel title="Automation Workbench" icon={<Bot size={18} />}>
          <div className="automation-summary">
            <AutomationStat label="Touchless" value={`${scenario.metrics.touchlessResolutionPct}%`} />
            <AutomationStat label="Recommended" value={scenario.metrics.autoRecommended.toString()} />
            <AutomationStat label="Needs approval" value={scenario.metrics.needsApproval.toString()} />
            <AutomationStat label="Manual" value={scenario.metrics.manualOnly.toString()} />
          </div>
          <div className="automation-list">
            {scenario.automationDecisions.slice(0, 6).map((decision) => (
              <article className={`automation-card ${decision.status}`} key={decision.id}>
                <div className="automation-card-header">
                  <span>{decision.status.replaceAll("_", " ")}</span>
                  <strong>{decision.selectedAction.title}</strong>
                </div>
                <p>{decision.policyResult.reason}</p>
                <div className="tradeoff">
                  <span>${decision.estimatedCost.toLocaleString()} cost</span>
                  <span>{decision.estimatedServiceRecovery} recovery</span>
                </div>
                <ol>
                  {decision.agentTrace.slice(0, 4).map((step) => (
                    <li key={`${decision.id}-${step.agent}`}>
                      <strong>{step.agent}</strong>
                      <span>{step.finding}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
            {scenario.automationDecisions.length === 0 && <p className="empty">Run the simulation to generate agent automation decisions.</p>}
          </div>
        </Panel>

        <Panel title="Shipments" icon={<Truck size={18} />}>
          <table>
            <thead>
              <tr>
                <th>Shipment</th>
                <th>BU</th>
                <th>Status</th>
                <th>ETA</th>
                <th>Delay</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.slice(0, 10).map((shipment) => (
                <tr key={shipment.id}>
                  <td>{shipment.id}</td>
                  <td>{formatBusinessUnit(shipment.businessUnit)}</td>
                  <td><span className={`status ${shipment.status}`}>{shipment.status.replaceAll("_", " ")}</span></td>
                  <td>{new Date(shipment.currentEta).toLocaleDateString()}</td>
                  <td>{shipment.delayHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Inventory Risk" icon={<Boxes size={18} />}>
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>SKU</th>
                <th>Available</th>
                <th>Safety</th>
              </tr>
            </thead>
            <tbody>
              {riskInventory.map((position) => (
                <tr key={position.id}>
                  <td>{position.facilityId}</td>
                  <td>{position.sku?.name ?? position.skuId}</td>
                  <td>{position.available.toLocaleString()}</td>
                  <td>{position.safetyStockUnits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Facility Status" icon={<Building2 size={18} />}>
          <div className="facility-list">
            {scenario.facilities
              .filter((facility) => businessUnit === "all" || facility.businessUnits.includes(businessUnit))
              .slice(0, 10)
              .map((facility) => (
                <div className="facility" key={facility.id}>
                  <div>
                    <strong>{facility.name}</strong>
                    <span>{facility.market} · {facility.type.replaceAll("_", " ")}</span>
                    {facility.address && <span>{facility.address}</span>}
                    {facility.role && <span>{facility.role}</span>}
                    {facility.squareFeet && <span>{facility.squareFeet.toLocaleString()} sq ft</span>}
                  </div>
                  <meter value={facility.congestionLevel} min={0} max={1} />
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="Data Upload Prep" icon={<FileUpIcon />}>
          <ImportPanel results={uploadResults} onResults={setUploadResults} />
        </Panel>

        <Panel title="Event Log" icon={<Clock size={18} />}>
          <div className="event-log">
            {scenario.facilities
              .filter((facility) => facility.sourceNote)
              .map((facility) => (
                <div className="event" key={facility.id}>
                  <span>{facility.market} · {facility.type.replaceAll("_", " ")}</span>
                  <strong>{facility.name}</strong>
                  <p>{facility.sourceNote}</p>
                </div>
              ))}
            {scenario.events.slice(0, 6).map((event) => (
              <div className="event" key={event.id}>
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                <strong>{event.title}</strong>
                <p>{event.description}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="kpi">
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function AutomationStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="automation-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{icon}{title}</h2>
      {children}
    </section>
  );
}

function NetworkMap({ scenario, businessUnit }: { scenario: ScenarioState; businessUnit: BusinessUnit | "all" }) {
  const facilities = scenario.facilities.filter((facility) => businessUnit === "all" || facility.businessUnits.includes(businessUnit));
  const minLat = 25.5;
  const maxLat = 37.5;
  const minLng = -103.5;
  const maxLng = -93.5;

  return (
    <div className="map" aria-label="Regional network map">
      {facilities.map((facility) => {
        const x = ((facility.location.longitude - minLng) / (maxLng - minLng)) * 100;
        const y = (1 - (facility.location.latitude - minLat) / (maxLat - minLat)) * 100;
        return (
          <div className={`node ${facility.type}`} key={facility.id} style={{ left: `${x}%`, top: `${y}%` }} title={facility.name}>
            <span>{facility.market.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatBusinessUnit(value: BusinessUnit): string {
  return value === "beverage" ? "Beverage" : "Foods";
}

function FileUpIcon() {
  return <Boxes size={18} />;
}

createRoot(document.getElementById("root")!).render(<App />);
