import { pathToFileURL } from "node:url";
import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    return { status: "ok" };
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
// El guard anterior comparaba import.meta.url (siempre file://... con
// barras "/") contra `file://${process.argv[1]}` construido a mano, que en
// Windows arrastra el separador "\" y las mayusculas de unidad de argv[1]
// (p. ej. "C:\Users\...\app.ts") sin normalizar — la comparacion de
// strings nunca coincidia, asi que `main()` nunca se llamaba y el servidor
// no arrancaba. pathToFileURL() normaliza argv[1] con las mismas reglas
// que Node usa para construir import.meta.url (separadores, %-encoding,
// mayusculas de unidad), asi que la comparacion es correcta en Windows,
// macOS y Linux por igual.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
