import { SignJWT, jwtVerify } from "jose";
import { ethers } from "ethers";

// Verify wallet signature (without nonce – nonce verification is done in login)
export function verifySignature(address, message, signature) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// Create JWT with required secret, jti, iss
export async function createToken(address, env) {
  if (!env?.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const jti = crypto.randomUUID();
  return await new SignJWT({ address, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("nft-wallet-visualizer") // customize per project
    .setExpirationTime("1h")
    .sign(secret);
}

// Verify JWT
export async function verifyToken(token, env) {
  if (!env?.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: "nft-wallet-visualizer",
    });
    return payload; // contains address, jti, iat, exp, iss
  } catch {
    return null;
  }
}

// Optional auth
export async function getOptionalUser(request, env) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace("Bearer ", "");
    return await verifyToken(token, env);
  } catch {
    return null;
  }
}

// Strict auth
export async function requireAuth(request, env) {
  const user = await getOptionalUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
