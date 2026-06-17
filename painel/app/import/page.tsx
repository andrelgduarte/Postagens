import { ImportView } from "./view";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar em lote</h1>
        <p className="text-sm text-neutral-500">
          Selecione a pasta com sub-pastas, cada uma contendo{" "}
          <code className="font-mono">post.yaml</code> + mídias. Imagens e vídeos
          vão direto pro Blob; o sistema cria os posts em sequência.
        </p>
      </div>
      <ImportView />
    </div>
  );
}
