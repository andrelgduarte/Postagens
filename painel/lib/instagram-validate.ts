import { imageSize } from "image-size";

const FEED_MIN_RATIO = 0.8;
const FEED_MAX_RATIO = 1.91;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar mídia para validação (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function validateFeedImageAspect(url: string): Promise<void> {
  const buf = await fetchImageBuffer(url);
  let dim: { width?: number; height?: number };
  try {
    dim = imageSize(buf);
  } catch {
    return;
  }
  if (!dim.width || !dim.height) return;
  const ratio = dim.width / dim.height;
  if (ratio < FEED_MIN_RATIO || ratio > FEED_MAX_RATIO) {
    throw new Error(
      `Instagram exige razão entre 4:5 (0.8) e 1.91:1 para posts do feed. ` +
        `Sua imagem está em ${dim.width}×${dim.height} (razão ${ratio.toFixed(2)}). ` +
        `Recorte para 1080×1350 (4:5 retrato) ou 1080×1080 (1:1 quadrado).`
    );
  }
}
