import { listPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await listPosts();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const due = posts
    .filter((p) => {
      if (!p.meta.scheduled) return false;
      if (p.meta.scheduled.slice(0, 16) > localNow) return false;
      return p.meta.status_ig === "queued" || p.meta.status_li === "queued";
    })
    .map((p) => {
      const networks: string[] = [];
      if (p.meta.status_ig === "queued") networks.push("Instagram");
      if (p.meta.status_li === "queued") networks.push("LinkedIn");
      return { slug: p.slug, title: p.title, networks, scheduled: p.meta.scheduled };
    });

  return Response.json(due);
}
