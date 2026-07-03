import { runTick } from "../lib/scheduler";
async function main() {
  const dry = process.argv.includes("--dry");
  console.log(dry ? "== dryRun tick ==" : "== LIVE tick ==");
  const r = await runTick({ dryRun: dry });
  console.log(JSON.stringify(r, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
