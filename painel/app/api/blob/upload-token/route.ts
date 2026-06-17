import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";
import { clerkEnabled, DEFAULT_USER_ID } from "@/lib/auth";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
];

const MAX_BYTES = 100 * 1024 * 1024; // 100MB

async function resolveUserId(): Promise<string> {
  if (!clerkEnabled()) return process.env.DEV_USER_ID || DEFAULT_USER_ID;
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  return userId;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const userId = await resolveUserId();
        const expectedPrefix = `media/${userId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error(`pathname deve começar com ${expectedPrefix}`);
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => {
        // no-op: the post row is created by /api/import/one once the client confirms all media
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
