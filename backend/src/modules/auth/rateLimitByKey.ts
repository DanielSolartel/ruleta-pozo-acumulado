/**
 * Rate limiter secundario, en memoria, por clave arbitraria (email o
 * user_id) — complementa a @fastify/rate-limit, que solo limita por IP.
 *
 * Se implementa a mano en vez de añadir una dependencia nueva porque
 * @fastify/rate-limit no soporta dos límites independientes (IP + email)
 * sobre la misma ruta de forma directa. Es una ventana deslizante simple,
 * suficiente para V0.3 (proceso único, sin múltiples instancias); si el
 * backend llega a correr en varias instancias, esto necesitará moverse a
 * un store compartido (p. ej. Redis) — documentado como limitación
 * conocida, no una omisión.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitByKeyOptions {
  max: number;
  windowMs: number;
}

/** true si la clave AÚN tiene cupo (y registra este intento); false si excede el límite. */
export function checkRateLimitByKey(key: string, options: RateLimitByKeyOptions): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);

  if (bucket.timestamps.length >= options.max) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}

/** Solo para tests: limpia todos los buckets entre casos de prueba. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
