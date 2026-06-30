export type Network = "ig" | "li" | "tt" | "th";

export function getDisabledNetworks(): Network[] {
  const raw = process.env.DISABLED_NETWORKS ?? "";
  const valid: Network[] = ["ig", "li", "tt", "th"];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Network => (valid as string[]).includes(s));
}

export function isNetworkDisabled(n: Network): boolean {
  return getDisabledNetworks().includes(n);
}
