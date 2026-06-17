import { resendEnabled, sendEmail } from "../lib/email";

async function main() {
  if (!resendEnabled()) {
    console.error("RESEND_API_KEY ausente em .env.local");
    process.exit(1);
  }
  const to = process.env.NOTIFY_EMAIL;
  if (!to) {
    console.error("NOTIFY_EMAIL ausente em .env.local");
    process.exit(1);
  }
  console.log(`Enviando teste para ${to}…`);
  await sendEmail({
    to,
    subject: "Painel de Postagens — teste de email",
    text: "Este é um teste do canal de notificação por email.\n\nSe você recebeu, o Resend está configurado corretamente.",
  });
  console.log("ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
