import { legacyAccountFromEnv, loadConfig } from "@/lib/config";
import { SettingsView } from "./view";
import { getLinkedinAccountInfo, getTiktokAccountInfo } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    li_ok?: string;
    li_error?: string;
    tt_ok?: string;
    tt_error?: string;
  }>;
}) {
  const config = await loadConfig();
  const legacy = config.accounts.length === 0 ? legacyAccountFromEnv() : null;
  const [linkedinAccount, tiktokAccount] = await Promise.all([
    getLinkedinAccountInfo(),
    getTiktokAccountInfo(),
  ]);
  const params = await searchParams;
  const linkedinStatus =
    params.li_ok === "1"
      ? { ok: true }
      : params.li_error
        ? { error: params.li_error }
        : undefined;
  const tiktokStatus =
    params.tt_ok === "1"
      ? { ok: true }
      : params.tt_error
        ? { error: params.tt_error }
        : undefined;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-neutral-500">
          Tudo é salvo em <code className="font-mono">painel/config.json</code> (fora do git).
        </p>
      </div>
      <SettingsView
        config={config}
        legacyHint={legacy}
        linkedinAccount={linkedinAccount}
        linkedinStatus={linkedinStatus}
        tiktokAccount={tiktokAccount}
        tiktokStatus={tiktokStatus}
      />
    </div>
  );
}
