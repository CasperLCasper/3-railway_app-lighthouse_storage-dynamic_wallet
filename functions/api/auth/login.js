import { verifySignature, createToken } from "../../_lib/auth.js";
import { jwtVerify } from "jose";

export default async function handler(req, res) {
  try {
    // Express pusē JSON dati jau ir automātiski apstrādāti tavam req.body
    const { address, message, signature } = req.body || {};
    
    if (!address || !message || !signature) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Nonce tagad ir JWT. Tas atrodas ziņojuma sākumā, pirms " - ".
    const parts = message.split(" - ", 2);
    if (parts.length !== 2) {
      return res.status(400).json({ error: "Invalid message format" });
    }

    const nonceToken = parts[0];

    // Verificējam nonce JWT (Izmantojam process.env)
    let nonce;
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
      const { payload } = await jwtVerify(nonceToken, secret);
      nonce = payload.nonce;
    } catch (e) {
      return res.status(401).json({ error: "Nonce expired or invalid. Request a new one." });
    }

    if (!nonce) {
      return res.status(401).json({ error: "Invalid nonce" });
    }

    // Verificējam maka parakstu
    const isValid = verifySignature(address, message, signature);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Izveidojam lietotāja JWT (Nododam process.env, ja createToken to sagaida)
    const token = await createToken(address, process.env);

    return res.status(200).json({ token });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Login failed: " + err.message });
  }
}
