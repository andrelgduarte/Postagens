export const DEFAULT_TZ = "America/Sao_Paulo";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTZ(d: Date, tz: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function getMinutesInTZ(d: Date, tz: string = DEFAULT_TZ): number {
  const p = partsInTZ(d, tz);
  return p.hour * 60 + p.minute;
}

export function utcToZonedISO(d: Date, tz: string = DEFAULT_TZ): string {
  const p = partsInTZ(d, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function zonedISOToUtc(iso: string, tz: string = DEFAULT_TZ): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4] ?? "0");
  const mi = Number(m[5] ?? "0");
  const s = Number(m[6] ?? "0");
  // First guess: interpret as UTC
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // See what tz shows that instant as
  const seen = partsInTZ(guess, tz);
  const seenUtc = new Date(
    Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second)
  );
  // Offset between "what we wanted" and "what we got" in tz
  const diff = guess.getTime() - seenUtc.getTime();
  return new Date(guess.getTime() + diff);
}
