import { SignJWT } from "jose";

const NONCE_TTL = "5m"; // 5 minūtes

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.JWT_SECRET) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const nonce = crypto.randomUUID();
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  // Izveido JWT, kas satur nonci un ir derīgs 5 minūtes
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(NONCE_TTL)
    .sign(secret);

  return new Response(JSON.stringify({ nonce: token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
