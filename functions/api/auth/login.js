import { verifySignature, createToken } from "../../_lib/auth.js";
import { jwtVerify } from "jose";

export async function onRequestPost(context) {
  try {
    let body;
    try {
      body = await context.request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { address, message, signature } = body;
    if (!address || !message || !signature) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Nonce tagad ir JWT. Tas atrodas ziņojuma sākumā, pirms " - ".
    const parts = message.split(" - ", 2);
    if (parts.length !== 2) {
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const nonceToken = parts[0];
    // messageText (piem., "Login to NFT Wallet Visualizer") nav obligāti jāpārbauda

    // Verificējam nonce JWT
    let nonce;
    try {
      const secret = new TextEncoder().encode(context.env?.JWT_SECRET || "");
      const { payload } = await jwtVerify(nonceToken, secret);
      nonce = payload.nonce;
    } catch {
      return new Response(JSON.stringify({ error: "Nonce expired or invalid. Request a new one." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!nonce) {
      return new Response(JSON.stringify({ error: "Invalid nonce" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verificējam maka parakstu (joprojām validējam visu ziņojumu)
    const isValid = verifySignature(address, message, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Izveidojam lietotāja JWT
    const token = await createToken(address, context.env);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return new Response(JSON.stringify({ error: "Login failed: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
