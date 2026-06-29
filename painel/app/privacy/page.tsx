export const metadata = {
  title: "Política de privacidade · Painel TikTok",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-neutral-800 dark:text-neutral-200">
      <h1 className="text-2xl font-semibold tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-xs text-neutral-500">Última atualização: 29/06/2026</p>

      <section className="mt-6 space-y-4 text-sm leading-relaxed">
        <p>
          O Painel TikTok é uma ferramenta pessoal de uso restrito. Esta política
          descreve quais dados o Serviço coleta, com que finalidade e como são
          armazenados.
        </p>

        <h2 className="font-semibold mt-4">Dados coletados</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Autenticação:</strong> e-mail e identificador único do
            provedor de login (Google/GitHub via Clerk).
          </li>
          <li>
            <strong>TikTok OAuth:</strong> <code className="font-mono">open_id</code>,{" "}
            <code className="font-mono">display_name</code>, <code className="font-mono">avatar_url</code>,{" "}
            access token e refresh token recebidos via <code className="font-mono">video.upload</code>{" "}
            scope. Tokens são armazenados criptografados no banco de dados Neon
            Postgres e usados unicamente para enviar conteúdo do próprio usuário
            ao inbox/drafts do app TikTok.
          </li>
          <li>
            <strong>Conteúdo de posts:</strong> imagens, vídeos e legendas que o
            próprio usuário cria no Painel.
          </li>
        </ul>

        <h2 className="font-semibold mt-4">Compartilhamento</h2>
        <p>
          Nenhum dado é compartilhado, vendido ou cedido a terceiros. Dados são
          enviados apenas para os serviços operacionais necessários: TikTok
          (publicação), Meta Graph API (Instagram), LinkedIn API, Vercel Blob
          (armazenamento de mídia) e Clerk (autenticação).
        </p>

        <h2 className="font-semibold mt-4">Retenção e remoção</h2>
        <p>
          Você pode desconectar a integração com TikTok a qualquer momento em{" "}
          <code className="font-mono">/settings</code> — isso apaga
          imediatamente o token armazenado. Para remoção completa de dados,
          escreva para{" "}
          <a className="underline" href="mailto:andrelgduarte@gmail.com">
            andrelgduarte@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
