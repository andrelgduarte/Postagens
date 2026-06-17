import { legacyAccountFromEnv, loadConfig } from "@/lib/config";
import { SettingsView } from "./view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await loadConfig();
  const legacy = config.accounts.length === 0 ? legacyAccountFromEnv() : null;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-neutral-500">
          Tudo é salvo em <code className="font-mono">painel/config.json</code> (fora do git).
        </p>
      </div>
      <SettingsView config={config} legacyHint={legacy} />
    </div>
  );
}
