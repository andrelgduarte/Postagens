import { promises as fs } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import YAML from "yaml";

const PAINEL_DIR = path.resolve(process.cwd());
const STAGING_DIR = path.join(PAINEL_DIR, "staging");

type Row = {
  Dia: number;
  "Título": string;
  Tipo: "Imagem única" | "Carrossel" | string;
  "Nº imagens": number;
  "Arquivos (imagens)": string;
  "Data publicação": number;
  Hora: number;
  "Legenda Instagram": string;
};

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function decodeDate(serial: number): { date: string; time: string } {
  const d = XLSX.SSF.parse_date_code(serial);
  const date = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  const time = `${String(d.H).padStart(2, "0")}:${String(d.M).padStart(2, "0")}`;
  return { date, time };
}

function detectType(typeRaw: string): "single" | "carousel" {
  if (/carrossel/i.test(typeRaw)) return "carousel";
  return "single";
}

async function main() {
  const xlsxPath = path.resolve(PAINEL_DIR, "..", "Import", "calendario_instagram.xlsx");
  const importDir = path.resolve(PAINEL_DIR, "..", "Import");
  const dryRun = process.argv.includes("--dry-run");

  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets["Calendário de Posts"];
  const rows: Row[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`Lidas ${rows.length} linhas.\n`);

  const summary: { slug: string; date: string; time: string; count: number; sources: string[] }[] = [];

  for (const r of rows) {
    if (typeof r["Data publicação"] !== "number" || typeof r["Hora"] !== "number") {
      console.warn(`Linha sem data/hora, pulando: dia ${r.Dia} - ${r["Título"]}`);
      continue;
    }
    const { date, time } = decodeDate(r["Data publicação"] + r["Hora"]);
    const type = detectType(r.Tipo);
    const title = String(r["Título"] ?? "").trim();
    const slug = `${date}-${slugify(title) || "post"}`;
    const sources = String(r["Arquivos (imagens)"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    summary.push({ slug, date, time, count: sources.length, sources });

    if (dryRun) continue;

    const dir = path.join(STAGING_DIR, slug);
    await fs.mkdir(dir, { recursive: true });

    for (let i = 0; i < sources.length; i++) {
      const src = path.join(importDir, sources[i]);
      const ext = path.extname(sources[i]) || ".jpg";
      const dst = path.join(dir, `${String(i + 1).padStart(2, "0")}${ext}`);
      try {
        await fs.copyFile(src, dst);
      } catch (e) {
        console.error(`falha ao copiar ${src}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const fm = {
      date,
      title,
      type,
      auto_publish: true,
      time,
      caption_ig: String(r["Legenda Instagram"] ?? "").replace(/\r\n/g, "\n"),
    };
    const yamlPath = path.join(dir, "post.yaml");
    await fs.writeFile(yamlPath, YAML.stringify(fm), "utf8");
  }

  console.log(`\nResumo (${summary.length} posts):`);
  for (const s of summary.slice(0, 5)) {
    console.log(`  ${s.slug} · ${s.date} ${s.time} · ${s.count} mídia(s): ${s.sources.join(", ")}`);
  }
  if (summary.length > 5) console.log(`  ... e mais ${summary.length - 5}`);

  if (dryRun) {
    console.log(`\n(dry-run; nenhum arquivo escrito)`);
  } else {
    console.log(`\nArquivos gravados em ${STAGING_DIR}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
