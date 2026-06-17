import { z } from "zod";
import { importFromPayload, validateFrontmatter } from "@/lib/import";
import { currentUserId } from "@/lib/auth";

const Body = z.object({
  frontmatter: z.unknown(),
  media: z.array(
    z.object({
      filename: z.string(),
      kind: z.enum(["image", "video"]),
      url: z.string().url(),
      sizeBytes: z.number().optional(),
      contentType: z.string().optional(),
    })
  ),
});

export async function POST(req: Request): Promise<Response> {
  let parsedBody;
  try {
    parsedBody = Body.parse(await req.json());
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "payload inválido" },
      { status: 400 }
    );
  }

  let frontmatter;
  try {
    frontmatter = validateFrontmatter(parsedBody.frontmatter);
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "frontmatter inválido" },
      { status: 400 }
    );
  }

  try {
    const userId = await currentUserId();
    const result = await importFromPayload({
      frontmatter,
      media: parsedBody.media,
      userId,
    });
    return Response.json({ ok: true, slug: result.slug });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
