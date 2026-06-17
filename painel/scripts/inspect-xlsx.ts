import * as XLSX from "xlsx";

const file = process.argv[2];
if (!file) {
  console.error("uso: tsx scripts/inspect-xlsx.ts <arquivo.xlsx>");
  process.exit(1);
}

const wb = XLSX.readFile(file);
for (const sheetName of wb.SheetNames) {
  console.log(`=== sheet: ${sheetName} ===`);
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    console.log(JSON.stringify(rows[i]));
  }
  console.log(`(total ${rows.length} linhas)`);
}
