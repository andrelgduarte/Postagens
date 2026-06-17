"use server";

import { revalidatePath } from "next/cache";
import { importEntry, scanStaging, type ImportResult } from "@/lib/import";

export async function importOneAction(relPath: string): Promise<ImportResult> {
  const entries = await scanStaging();
  const entry = entries.find((e) => e.relPath === relPath);
  if (!entry) {
    return { relPath, error: "Pasta não está mais em staging" };
  }
  const result = await importEntry(entry);
  revalidatePath("/import");
  revalidatePath("/");
  return result;
}

export async function importAllAction(): Promise<ImportResult[]> {
  const entries = await scanStaging();
  const results: ImportResult[] = [];
  for (const entry of entries) {
    results.push(await importEntry(entry));
  }
  revalidatePath("/import");
  revalidatePath("/");
  return results;
}
