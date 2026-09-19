// Módulo "audit" — en V0.3 solo contiene el mailer de desarrollo
// (mailer.ts), usado por el módulo auth para el flujo de verificación de
// email. El resto de responsabilidades de auditoría (logs estructurados,
// ver spec C "Observabilidad") sigue sin implementación de código propia.
export { getMailer, setMailerForTesting } from "./mailer";
export type { Mailer, EmailMessage } from "./mailer";
