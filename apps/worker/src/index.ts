import { createTexasOklahomaScenario } from "@control-tower/data-gen";
import { runSimulation } from "@control-tower/simulation";

function runBatchSimulation(): void {
  const scenario = createTexasOklahomaScenario();
  const finalState = runSimulation(scenario, 56);

  console.log(
    JSON.stringify(
      {
        scenarioId: finalState.id,
        scenarioName: finalState.name,
        currentTime: finalState.currentTime,
        metrics: finalState.metrics,
        topExceptions: finalState.exceptions.slice(0, 10).map((exception) => ({
          id: exception.id,
          type: exception.type,
          severity: exception.severity,
          title: exception.title,
          recommendation: exception.recommendation?.title
        }))
      },
      null,
      2
    )
  );
}

if (process.argv.includes("--once")) {
  runBatchSimulation();
} else {
  const intervalMs = Number(process.env.SIMULATION_TICK_MS ?? 60_000);
  runBatchSimulation();
  setInterval(runBatchSimulation, intervalMs);
}
