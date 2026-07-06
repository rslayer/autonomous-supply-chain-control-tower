import cors from "@fastify/cors";
import Fastify from "fastify";
import { createTexasOklahomaScenario } from "@control-tower/data-gen";
import { runSimulation, stepSimulation } from "@control-tower/simulation";
import type { ScenarioState } from "@control-tower/domain";

const server = Fastify({
  logger: true
});

await server.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true
});

let scenario: ScenarioState = createTexasOklahomaScenario();

server.get("/", async () => ({
  ok: true,
  service: "autonomous-supply-chain-control-tower-api",
  message: "API is running. Open the dashboard at http://localhost:5173/.",
  endpoints: [
    "GET /health",
    "GET /scenario",
    "POST /scenario/reset",
    "POST /simulation/step",
    "POST /simulation/run",
    "GET /simulation/metrics",
    "GET /exceptions"
  ]
}));

server.get("/health", async () => ({
  ok: true,
  service: "autonomous-supply-chain-control-tower-api",
  time: new Date().toISOString()
}));

server.get("/scenario", async () => scenario);

server.post("/scenario/reset", async () => {
  scenario = createTexasOklahomaScenario();
  return scenario;
});

server.post("/simulation/step", async () => {
  const result = stepSimulation(scenario);
  scenario = result.state;
  return {
    state: scenario,
    newEvents: result.newEvents,
    newExceptions: result.newExceptions
  };
});

server.post<{ Body: { steps?: number } }>("/simulation/run", async (request) => {
  const steps = Math.max(1, Math.min(56, request.body?.steps ?? 8));
  scenario = runSimulation(scenario, steps);
  return scenario;
});

server.get("/simulation/metrics", async () => scenario.metrics);

server.get("/exceptions", async () => scenario.exceptions);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ port, host });
