import { SignJWT } from "jose";

const NONCE_TTL = "5m"; // 5 minūtes

export default async function handler(req, res) {
  try {
    // Pārbaudām process.env (Railway vidē)
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error: Missing JWT_SECRET" });
    }

    const nonce = crypto.randomUUID();
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    // Izveido JWT, kas satur nonci un ir derīgs 5 minūtes
    const token = await new SignJWT({ nonce })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(NONCE_TTL)
      .sign(secret);

    // Express atgriež JSON atbildi
    return res.status(200).json({ nonce: token });
    
  } catch (err) {
    console.error("Nonce generation error:", err.message);
    return res.status(500).json({ error: "Failed to generate nonce" });
  }
}
