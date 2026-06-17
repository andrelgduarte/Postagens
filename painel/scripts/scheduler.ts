import { loadConfig } from "../lib/config";
import { runTick } from "../lib/scheduler";

type Args = { dryRun: boolean; loop: boolean; notify: boolean; once: boolean };

function parseArgs(argv: string[]): Args {
  return {
    dryRun: argv.includes("--dry-run"),
    loop: argv.includes("--loop"),
    notify: !argv.includes("--no-notify"),
    once: argv.includes("--once"),
  };
}

async function tick(args: Args) {
  const res = await runTick({ dryRun: args.dryRun, notify: args.notify });
  const line = `tick: considered=${res.considered} ok=${res.published.length} skip=${res.skipped.length} fail=${res.failed.length} insights=${res.insights.length}`;
  console.log(line);
  if (res.published.length) console.log("  ok:", res.published.join(", "));
  if (res.skipped.length)
    console.log(
      "  skip:",
      res.skipped.map((s) => `${s.slug} (${s.reason})`).join(", ")
    );
  if (res.failed.length)
    console.log(
      "  fail:",
      res.failed.map((s) => `${s.slug} (${s.reason})`).join(", ")
    );
  if (res.insights.length)
    console.log(
      "  insights:",
      res.insights.map((i) => `${i.slug}@${i.milestone}${i.ok ? "" : " (fail)"}`).join(", ")
    );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.loop || args.once) {
    await tick(args);
    return;
  }
  const config = await loadConfig();
  const intervalMs = Math.max(1, config.scheduler.interval_minutes) * 60_000;
  console.log(
    `loop: tick a cada ${config.scheduler.interval_minutes}min, janela ${config.scheduler.window_start}-${config.scheduler.window_end}, retries=${config.scheduler.retries}`
  );
  // run an immediate tick, then setInterval
  await tick(args);
  setInterval(() => {
    tick(args).catch((e) => console.error(e));
  }, intervalMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
