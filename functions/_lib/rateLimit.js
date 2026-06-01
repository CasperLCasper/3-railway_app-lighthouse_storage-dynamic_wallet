// functions/_lib/rateLimit.js
import { Redis } from "@upstash/redis";

/**
 * Pārbauda ātruma ierobežojumu, izmantojot Upstash Redis.
 * Ja Redis nav pieejams, izmanto atmiņas fallback (nav ieteicams ražošanā).
 */
export async function checkRateLimit({ key, limit = 20, windowMs = 60000 }, env) {
  // Ja nav Redis konfigurācijas, izmanto veco Map (tikai testam)
  if (!env?.UPSTASH_REDIS_REST_URL || !env?.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Upstash Redis nav konfigurēts! Izmanto fallback (nav ieteicams).");
    return legacyCheckRateLimit({ key, limit, windowMs });
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const pipe = redis.pipeline();
    pipe.incr(key);       // palielina skaitītāju par 1
    pipe.pttl(key);       // atgriež atlikušo TTL milisekundēs

    const [count, ttl] = await pipe.exec();

    // Ja atslēga ir jauna vai TTL beidzies, iestatām loga ilgumu
    if (count === 1 || ttl === -1 || ttl === -2) {
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }

    // count jau ir palielināts – pārbaudām, vai nav pārsniegts limits
    return count <= limit;
  } catch (err) {
    console.error("Upstash Redis rate limit error:", err);
    // Kļūdas gadījumā atļaujam pieprasījumu, lai nebojātu lietotāja pieredzi
    return true;
  }
}

// Fallback atmiņā (ja Redis nav pieejams)
const legacyMap = new Map();
function legacyCheckRateLimit({ key, limit = 20, windowMs = 60000 }) {
  const now = Date.now();
  const data = legacyMap.get(key);
  if (data && now - data.timestamp >= windowMs) {
    legacyMap.delete(key);
  }
  const fresh = legacyMap.get(key);
  if (fresh) {
    if (fresh.count >= limit) return false;
    fresh.count++;
  } else {
    legacyMap.set(key, { count: 1, timestamp: now });
  }
  return true;
}
