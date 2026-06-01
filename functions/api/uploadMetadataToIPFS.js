import { PinataSDK } from "pinata";
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";
import { setCache } from "../_lib/cache.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await requireAuth(request, env);
    if (user instanceof Response) return user;
    if (!user || !user.address) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const rateKey = `upload-metadata:${user.address.toLowerCase()}`;
    if (!(await checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env))) {
      return new Response(JSON.stringify({ error: 'Too many metadata uploads. Try again later.' }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON format' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let metadata = body;
    if (metadata.metadata && !metadata.name) {
      metadata = metadata.metadata;
    }

    if (!metadata || !metadata.name || !metadata.image) {
      return new Response(JSON.stringify({ error: 'Metadata must contain name and image' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validācija
    if (typeof metadata.name !== 'string' || metadata.name.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid name (max 100 characters)' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (typeof metadata.image !== 'string' || metadata.image.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid image URL' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!/^(https?|ipfs):\/\/.+/.test(metadata.image)) {
      return new Response(JSON.stringify({ error: 'Image must be a valid HTTP/HTTPS or IPFS URL' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const allowedFields = ['name', 'image', 'description', 'attributes', 'animation_url'];
    for (const key of Object.keys(metadata)) {
      if (!allowedFields.includes(key)) {
        delete metadata[key];
      }
    }

    const pinata = new PinataSDK({
      pinataJwt: env.PINATA_JWT,
      pinataGateway: env.PINATA_GATEWAY,
    });

    const result = await pinata.upload.public.json(metadata);
    console.log(`✅ User ${user.address} uploaded metadata: ${metadata.name}, cid: ${result.cid}`);

    // 🔒 Saglabājam CID ar mazajiem burtiem, lai atslēga būtu vienāda ar mint pusi
    await setCache(`lastUploadCID:${user.address.toLowerCase()}`, result.cid, env, 5 * 60 * 1000);

    return new Response(JSON.stringify({
      ipfs: `ipfs://${result.cid}`,
      http: `https://gateway.pinata.cloud/ipfs/${result.cid}`,
      cid: result.cid
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Metadata upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
