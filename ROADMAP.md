# Roadmap

## A fazer

- **Importação em lote de publicações via arquivo (JSON/YAML/CSV)**
  - Hoje cada post é criado um a um pelo `/new`. Para encher a fila do mês de uma vez, queremos um formato de entrada (a definir) listando data, título, legendas IG/LI e caminhos das imagens → um importador (script CLI ou rota `/import`) cria as pastas em `posts/`.
  - Decisões em aberto: formato (provavelmente JSON pela simplicidade), referência às imagens (caminho local vs já estarem numa pasta de staging), comportamento em conflitos (sobrescrever vs pular vs criar com sufixo).

## Já feito

- Fase 1 — Painel local Next.js (fila, novo post drag-drop, detalhe com editor IG/LI, status por rede)
- Fase 2 — Calendário, notificação no horário agendado, auto-publish Instagram via Graph API + Vercel Blob
