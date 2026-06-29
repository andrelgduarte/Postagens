export const metadata = {
  title: "Termos de uso · Painel TikTok",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-neutral-800 dark:text-neutral-200">
      <h1 className="text-2xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="mt-2 text-xs text-neutral-500">Última atualização: 29/06/2026</p>

      <section className="mt-6 space-y-4 text-sm leading-relaxed">
        <p>
          O Painel TikTok (“Serviço”) é uma ferramenta pessoal de uso próprio do
          titular, hospedada em <code className="font-mono">app.andrelgduarte.com.br</code>,
          destinada exclusivamente ao agendamento e envio de posts próprios para o
          inbox do app do TikTok via Content Posting API.
        </p>
        <p>
          Ao utilizar o Serviço, você concorda em:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Acessar apenas com sua própria conta autenticada;</li>
          <li>Postar somente conteúdo do qual você é autor ou tem licença de uso;</li>
          <li>Respeitar os termos de uso e diretrizes de comunidade do TikTok.</li>
        </ul>
        <p>
          O Serviço é fornecido “como está”, sem garantias. O titular não se
          responsabiliza por falhas de publicação, indisponibilidade de APIs de
          terceiros ou bloqueios decorrentes do uso fora destas condições.
        </p>
        <p>
          Para dúvidas, escreva para{" "}
          <a className="underline" href="mailto:andrelgduarte@gmail.com">
            andrelgduarte@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
