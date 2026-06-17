import { listAccounts, loadConfig } from "@/lib/config";
import { NewPostForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [accounts, config] = await Promise.all([listAccounts(), loadConfig()]);
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo post</h1>
        <p className="text-sm text-neutral-500">
          As imagens serão renomeadas para <code className="font-mono">01.jpg</code>,{" "}
          <code className="font-mono">02.jpg</code>… na ordem de upload.
        </p>
      </div>
      <NewPostForm
        defaultDate={today}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, is_default: a.is_default }))}
        defaults={config.defaults}
      />
    </div>
  );
}
