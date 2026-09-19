import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { registerAuthRoutes } from "./modules/auth/routes";
import { HttpError } from "./modules/auth/middleware";
import { registerPotRoutes } from "./modules/pot/routes";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  void app.register(fastifyCookie);

  // Rate limiting (paso 1 del middleware de auth, resuelve N14): se
  // registra como plugin global; su hook onRequest corre antes que
  // cualquier preHandler de las rutas, así que basta con que cada ruta
  // declare su propio config.rateLimit (ver auth/routes.ts, pot/routes.ts)
  // para que el orden "rate limit primero" se cumpla sin código adicional.
  // El límite global por defecto (sin config.rateLimit explícito) es
  // deliberadamente generoso: cada ruta sensible ya declara el suyo.
  void app.register(fastifyRateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
  });

  void app.register(registerAuthRoutes);
  void app.register(registerPotRoutes);

  // Traduce HttpError (lanzado por los preHandlers de auth/middleware.ts:
  // CSRF, verificación de JWT, estado de cuenta) a la convención de
  // errores de la spec. Global, para que cualquier módulo futuro que use
  // HttpError quede cubierto igual.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    return reply.send(error);
  });

  return app;
}

async function main() {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

// Solo arranca el servidor si este archivo se ejecuta directamente
// (no cuando se importa buildApp() desde un test).
//
// pathToFileURL() normaliza process.argv[1] con las mismas reglas que Node
// usa para construir import.meta.url (separadores, %-encoding, mayúsculas
// de unidad), así que la comparación es correcta en Windows, macOS y Linux
// por igual (resuelve A4 — NO modificado en esta ronda, ya estaba correcto).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
