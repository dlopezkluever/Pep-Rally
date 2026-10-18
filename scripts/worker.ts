if (!process.env.WORKER_DATABASE_URL)
  throw new Error(
    "WORKER_DATABASE_URL is required. The worker must not use web or migration credentials.",
  );
process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
const { runDiscoveryJob } = await import("../src/lib/research");
const { closeDatabase } = await import("../src/lib/db");
try {
  let processed = 0;
  while (await runDiscoveryJob()) {
    processed++;
    if (process.argv.includes("--once")) break;
  }
  process.stdout.write(`Processed ${processed} queued research jobs.\n`);
} finally {
  await closeDatabase();
}
export {};
