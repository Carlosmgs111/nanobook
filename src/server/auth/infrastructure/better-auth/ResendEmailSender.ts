export interface ResendEmailSenderOptions {
  apiKey?: string;
  from: string;
}

export interface VerificationEmail {
  to: string;
  url: string;
}

export class ResendEmailSender {
  constructor(private readonly options: ResendEmailSenderOptions) {}

  async sendVerificationEmail({ to, url }: VerificationEmail): Promise<void> {
    if (!this.options.apiKey) {
      throw new Error(
        "RESEND_API_KEY must be configured to send verification emails.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [to],
        subject: "Verifica tu correo electrónico en Nanobook",
        text: `Confirma tu correo electrónico para activar tu cuenta en Nanobook:\n${url}`,
        html: `<p>Confirma tu correo electrónico para activar tu cuenta en Nanobook.</p><p><a href="${escapeHtml(url)}">Verificar correo electrónico</a></p>`,
      }),
    });

    if (!response.ok) {
      throw new Error("No fue posible enviar el correo de verificación.");
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
