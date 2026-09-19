import { PrismaClient } from "@prisma/client";

/**
 * Instancia única de PrismaClient para todo el proceso, con inicialización
 * perezosa: `new PrismaClient()` no corre hasta el primer uso real (primer
 * acceso a una propiedad/método), no en el momento en que se importa este
 * módulo.
 *
 * Esto importa por dos razones, no solo por conveniencia de desarrollo:
 * 1) Rutas que no tocan la base de datos (p. ej. GET /health) no deben
 *    fallar solo porque el grafo de módulos importa este archivo — antes,
 *    con instanciación al importar, CUALQUIER import transitivo de
 *    repository.ts rompía incluso /health si el cliente generado de
 *    Prisma no estaba disponible.
 * 2) En dev con tsx watch, el módulo puede recargarse; usar globalThis
 *    evita abrir una conexión nueva en cada reload (patrón recomendado
 *    por Prisma), y con inicialización perezosa tampoco se abre una
 *    conexión de más solo por el reload en sí.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getOrCreatePrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getOrCreatePrismaClient();
    return Reflect.get(client as object, prop, receiver);
  },
});
