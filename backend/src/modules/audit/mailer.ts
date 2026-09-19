/**
 * Mailer de desarrollo (V0.3): NO integra ningún proveedor de email real.
 * Decisión documentada (ver spec, PARTE 1 del encargo de V0.3): esto
 * permite probar el flujo completo de registro/verificación sin depender
 * de un servicio externo, y evita commitear o requerir credenciales de un
 * proveedor de email antes de que exista una necesidad real de enviarlos.
 *
 * - NODE_ENV === "development": imprime el email a stdout como JSON
 *   estructurado (to, subject, body), en vez de enviarlo.
 * - Cualquier otro NODE_ENV (incluida "production" y "test" sin
 *   configuración): lanza un error explícito, para no fallar en silencio
 *   ni fingir que un email se envió cuando no existe integración real.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

class StdoutMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      JSON.stringify({
        type: "email",
        to: message.to,
        subject: message.subject,
        body: message.body,
      })
    );
  }
}

class UnconfiguredMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error(
      "email provider not configured — set up a real provider before running outside development (EMAIL_PROVIDER_KEY exists in .env.example but no provider is wired yet, ver V0.3)"
    );
  }
}

let mailerInstance: Mailer | null = null;

export function getMailer(): Mailer {
  if (!mailerInstance) {
    mailerInstance =
      process.env.NODE_ENV === "development" ? new StdoutMailer() : new UnconfiguredMailer();
  }
  return mailerInstance;
}

/** Solo para tests: fuerza una instancia de mailer específica (p. ej. un mock). */
export function setMailerForTesting(mailer: Mailer | null): void {
  mailerInstance = mailer;
}
