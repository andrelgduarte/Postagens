import { scanStaging, importEntry, stagingRoot } from "../lib/import";

async function main() {
  const root = await stagingRoot();
  const entries = await scanStaging();
  if (entries.length === 0) {
    console.log(`Nada para importar em ${root}`);
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const entry of entries) {
    if (entry.kind === "error") {
      console.log(`✗ ${entry.relPath}: ${entry.message}`);
      fail += 1;
      continue;
    }
    const result = await importEntry(entry);
    if (result.error) {
      console.log(`✗ ${entry.relPath}: ${result.error}`);
      fail += 1;
    } else {
      console.log(`✓ ${entry.relPath} → ${result.slug}`);
      ok += 1;
    }
  }

  console.log(`\nResumo: ${ok} importado(s), ${fail} com erro.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
