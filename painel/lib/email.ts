import { Resend } from "resend";

export function resendEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "onboarding@resend.dev";
}

let cached: Resend | null = null;
function client(): Resend {
  if (!cached) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY ausente");
    cached = new Resend(key);
  }
  return cached;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!resendEnabled()) return;
  await client().emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}
