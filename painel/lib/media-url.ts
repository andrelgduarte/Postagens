export function imageUrl(slug: string, filename: string): string {
  return `/api/img/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`;
}
