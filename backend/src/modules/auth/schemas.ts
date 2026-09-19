import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifySchema = z.object({
  token: z.string().min(1),
});
export type VerifyInput = z.infer<typeof verifySchema>;

export const loginSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Convierte los issues de un ZodError al formato { field, issue } que usa
 * la convención de errores de la spec (F: error.details en 422).
 */
export function zodIssuesToDetails(error: z.ZodError): Array<{ field: string; issue: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    issue: issue.message,
  }));
}
