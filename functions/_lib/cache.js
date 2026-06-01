// functions/_lib/cache.js
import { Redis } from "@upstash/redis";

let redis;

function getRedis(env) {
  if (!redis && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function getCache(key, env) {
  const r = getRedis(env);
  if (!r) return null;
  try {
    const value = await r.get(key);
    if (value === null || value === undefined) return null;
    // Ja izskatās pēc JSON, parsējam, citādi atgriežam kā stringu
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch {
        return value; // ja parsēšana neizdodas, atgriežam kā ir
      }
    }
    return value;
  } catch (e) {
    console.error("Redis getCache error:", e);
    return null;
  }
}

export async function setCache(key, value, env, ttlMs = 60000) {
  const r = getRedis(env);
  if (!r) return;
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await r.set(key, serialized, { ex: Math.ceil(ttlMs / 1000) });
  } catch (e) {
    console.error("Redis setCache error:", e);
  }
}

export async function deleteCache(key, env) {
  const r = getRedis(env);
  if (!r) return;
  try {
    await r.del(key);
  } catch (e) {
    console.error("Redis deleteCache error:", e);
  }
}
