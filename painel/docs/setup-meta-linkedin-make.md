# Manual de configuração — Meta, LinkedIn e Make

Este manual mostra, passo a passo, como preparar tudo que o painel precisa pra publicar automaticamente no **Instagram** (via Meta) e no **LinkedIn** (via Make.com).

Tempo estimado: **40–60 min** (na primeira vez).

---

## Pré-requisitos

Antes de começar, tenha em mãos:

- Uma **conta no Facebook** (pessoal).
- Uma **Página no Facebook** vinculada à sua empresa/marca.
- Uma conta **Instagram Profissional** (Business ou Creator) conectada à Página acima.
- Uma **Página de Empresa no LinkedIn** (Company Page) onde você seja administrador.
- Acesso ao **painel** (URL e login).

> ⚠️ Conta pessoal do Instagram **não funciona**. Precisa ser conta Profissional (Comercial ou Criador de Conteúdo).

---

## Parte 1 — Meta / Instagram

### 1.1 Verificar conexão entre Página e Instagram

1. Abra o Facebook → vá na sua **Página**.
2. Menu lateral → **Configurações da Página** → **Contas vinculadas** → **Instagram**.
3. Confirme que o Instagram está conectado. Se não estiver, clique em **Conectar conta** e siga os passos.

### 1.2 Criar um App no Meta for Developers

1. Acesse https://developers.facebook.com/apps
2. Faça login com a mesma conta do Facebook.
3. Clique em **Criar app**.
4. Em **Casos de uso**, escolha **Outro** → **Avançar**.
5. Em **Tipo de app**, escolha **Empresa** → **Avançar**.
6. Preencha:
   - **Nome do app**: algo como `Painel Postagens [Sua Marca]`
   - **E-mail de contato**: seu e-mail
   - **Conta de empresa**: deixe como está ou crie uma nova se pedir.
7. Clique em **Criar app** e confirme com sua senha.

### 1.3 Adicionar produtos ao app

Dentro do app criado:

1. Menu lateral → **Adicionar produtos**.
2. Adicione **Instagram Graph API**.
3. Adicione **Facebook Login for Business** (necessário pra autenticar).

### 1.4 Pegar o App ID e App Secret

Esses dois valores permitem que o painel **renove o token automaticamente** (sem isso, vc precisa gerar token manualmente a cada 60 dias).

1. Menu lateral → **Configurações** → **Básico**.
2. Copie:
   - **ID do app** → vai virar `App ID` no painel.
   - **Chave secreta do app** → clique em **Mostrar** (vai pedir sua senha) → copie. Vai virar `App Secret` no painel.

> 🔒 Guarde o App Secret com cuidado — quem tem ele pode usar o app no seu nome.

### 1.5 Gerar o Access Token (token de acesso)

1. Acesse o **Graph API Explorer**: https://developers.facebook.com/tools/explorer
2. No topo direito, em **Aplicativo Meta**, selecione o app que vc criou.
3. Em **Usuário ou Página**, escolha **Obter token de acesso à página** → selecione a Página que tem o Instagram conectado.
4. Clique em **Adicionar permissões** e marque as 5 abaixo:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
5. Clique em **Gerar token de acesso** → autorize na janela popup.
6. Copie o token que apareceu na caixa **Token de acesso** (começa com `EAA...`).

> ⚠️ Esse token dura **1 hora**. O passo 1.6 abaixo transforma ele em um token de longa duração (60 dias). Se vc colocar App ID + App Secret no painel, ele cuida do refresh automático daí em diante.

### 1.6 Trocar por token de longa duração (opcional se já tem App ID/Secret)

Se vc preencher App ID e App Secret no painel, **pule este passo** — o painel faz a extensão sozinho.

Caso prefira fazer manual: cole na URL do navegador (substituindo `APP_ID`, `APP_SECRET` e `TOKEN_CURTO`):

```
https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN_CURTO
```

Vai retornar um JSON com o novo token. Esse novo token dura ~60 dias.

### 1.7 Descobrir o Instagram User ID

1. Ainda no **Graph API Explorer**, com o token selecionado, mude o campo do meio (que tem `me?fields=id,name`) para:

   ```
   me/accounts
   ```

2. Clique em **Enviar**. Vai listar as Páginas. Encontre a Página correta e copie o `id` dela (é numérico, ex.: `123456789012345`).

3. Agora mude o campo para:

   ```
   PAGE_ID?fields=instagram_business_account
   ```

   (substituindo `PAGE_ID` pelo número que vc acabou de copiar).

4. Clique em **Enviar**. Vai retornar algo como:

   ```json
   {
     "instagram_business_account": { "id": "17841400000000000" }
   }
   ```

   Copie o `id` aqui dentro. **Esse é o seu Instagram User ID** — vai no painel.

### 1.8 Configurar no painel

1. Acesse o painel → **Configurações** (ou `/settings`).
2. Na seção **Contas Instagram**, clique em **Adicionar conta**.
3. Preencha:
   - **Nome**: nome curto pra vc identificar (ex.: `Da Timidez à Liderança`).
   - **Instagram User ID**: o número que vc copiou no passo 1.7.
   - **Access Token**: o token (longo, começa com `EAA...`).
   - **App ID** (opcional, recomendado): do passo 1.4.
   - **App Secret** (opcional, recomendado): do passo 1.4.
4. Marque como **Conta padrão** se for sua única conta.
5. Clique em **Salvar**.

> ✅ Se aparecer um badge verde "Token válido até DD/MM" perto da conta, está tudo certo. Se aparecer vermelho, refaça o passo 1.5.

---

## Parte 2 — LinkedIn (via webhook + Make)

Diferente do Instagram, o LinkedIn não permite postar direto via API sem aprovação demorada da plataforma. A solução: o painel manda os dados para um **webhook do Make**, e o Make publica usando o módulo oficial do LinkedIn.

### 2.1 Garantir acesso administrador na Página da Empresa

1. Acesse https://www.linkedin.com/company/[sua-empresa]/admin/
2. Confirme que vc consegue ver o painel administrativo. Se não, peça pro dono da página te promover a **Super Admin**.

### 2.2 Criar conta no Make.com

1. Acesse https://www.make.com → **Sign up** (grátis até 1.000 operações/mês, suficiente pra ~30 posts/mês).
2. Confirme o e-mail.

---

## Parte 3 — Make.com (cenário webhook → LinkedIn)

### 3.1 Criar um novo cenário

1. Painel Make → **Scenarios** → **Create a new scenario**.

### 3.2 Adicionar o trigger (Webhook)

1. Clique no círculo grande no centro → busque por **Webhooks** → escolha **Custom webhook**.
2. Em **Webhook**, clique em **Add**:
   - **Webhook name**: `Painel Postagens` (qualquer nome).
   - Deixe o resto padrão → **Save**.
3. Copie a **URL gerada** (algo como `https://hook.eu2.make.com/abc123xyz...`). **Guarde** — vai pro painel.

### 3.3 Enviar payload de teste (do painel)

Pra que o Make entenda a estrutura dos dados, precisamos mandar um exemplo.

1. No painel → **Configurações** → seção **LinkedIn**.
2. Cole a **URL do webhook** que vc copiou.
3. Clique em **Salvar**.
4. Clique em **Enviar payload de teste**.
5. Volte ao Make. No módulo Webhook, deve aparecer **Successfully determined**. Se não aparecer, clique em **Redetermine data structure** e mande outro teste do painel.

### 3.4 Adicionar o módulo LinkedIn

1. No Make, clique no semicírculo à direita do webhook (`+`) → busque por **LinkedIn**.
2. **IMPORTANTE**: escolha o módulo **Create a Company Image Post** (NÃO escolha "Create a Post" sozinho — esse posta no seu feed pessoal).
3. Em **Connection**, clique **Add**:
   - Faça login com a conta LinkedIn que administra a Página.
   - Autorize o Make.

### 3.5 Configurar o módulo LinkedIn

Preencha os campos assim:

| Campo | Valor |
|---|---|
| **Author** | Escolha a Página da Empresa (NÃO o seu nome pessoal). |
| **Comment** | Mapeie `{{1.caption}}` (vem do webhook). |
| **Visibility** | `Public` |
| **File** | Veja sub-passos abaixo ↓ |

**Sub-configuração de File**:

1. **Choose Upload Method**: escolha **Upload by link** (NÃO "Upload binary").
2. **Image URL**: mapeie `{{1.media[].url}}` (a primeira mídia do payload).
3. **File name**: mapeie `{{1.media[].filename}}` (ou deixe vazio se der erro).
4. **Description**: pode deixar vazio.

> 🚩 Se vc se confundir e configurar o módulo errado de LinkedIn (o de feed pessoal), o post vai pro seu perfil. Sempre confira: **Author** deve ser o nome da Empresa.

### 3.6 Testar o cenário

1. Clique em **Run once** (botão no rodapé do Make).
2. Volte ao painel → **Configurações** → **Enviar payload de teste**.
3. No Make, vc deve ver as bolinhas verdes em cima dos módulos → o cenário rodou.
4. Vá no LinkedIn → veja se o post de teste apareceu na sua Página.
5. **Apague** o post de teste manualmente no LinkedIn.

### 3.7 Ativar o cenário

1. No editor do cenário, canto inferior esquerdo: toggle **Scheduling** → ative (ON).
2. Em **Run scenario**: escolha **Immediately as data arrives**.
3. Clique em **Save** (ícone disquete no rodapé).

> ⚠️ Se o toggle ficar em OFF, o webhook recebe mas nada acontece. Sempre confira que está **ON**.

---

## Parte 4 — Checklist final

Antes de considerar tudo pronto, confirme:

- [ ] **Meta**: badge verde no painel mostrando token válido.
- [ ] **Meta**: App ID e App Secret preenchidos (renovação automática).
- [ ] **Make**: cenário com toggle Scheduling **ON**.
- [ ] **Make**: módulo LinkedIn configurado com **Author = Página da Empresa**.
- [ ] **Painel**: URL do webhook do LinkedIn salva nas configurações.
- [ ] **Painel**: ao menos uma conta Instagram marcada como **padrão**.
- [ ] **Teste end-to-end**: publicou um post de teste no IG e no LinkedIn com sucesso, depois apagou ambos.

---

## Solução de problemas

### Instagram: "Session has expired" / "Invalid OAuth access token"

O token venceu. Refaça os passos **1.5** e **1.8**. Se vc tiver preenchido App ID + Secret, o painel deveria ter renovado sozinho — confira se eles estão preenchidos corretamente.

### Instagram: post não aparece e nada de erro

- Confira que a conta IG está como **Profissional** (Business ou Creator).
- Confira que a Página do Facebook está vinculada (passo 1.1).
- Veja a aba **Logs** do painel — vai mostrar a tentativa e o erro.

### LinkedIn: post foi pro feed pessoal, não pra Página

Vc usou o módulo errado no Make. Refaça o passo **3.4** escolhendo **Create a Company Image Post** e ajuste o **Author** pra Página da Empresa.

### Make: webhook recebe mas cenário não roda

Toggle de **Scheduling** está OFF. Veja passo **3.7**.

### Make: "data not detected" depois de Save

Clique em **Redetermine data structure** no módulo webhook e mande outro payload de teste pelo painel.

### Make: estourou o limite de operações

O plano grátis tem 1.000 operações/mês. Cada post consome ~2 operações. Se vc passar disso, ou faça upgrade no Make, ou reduza a frequência de posts.

---

## Anexo — Renovação manual do token Meta (sem App ID/Secret)

Se vc optou por não preencher App ID e App Secret, vc precisa renovar manualmente a cada ~60 dias:

1. Receberá um e-mail do painel: "Token vence em 7 dias".
2. Refaça o passo **1.5** (gerar novo token).
3. Atualize no painel pela tela de Configurações → conta → **Editar** → cole o novo token → **Salvar**.

Se preencher App ID + Secret, o painel cuida disso sozinho.
