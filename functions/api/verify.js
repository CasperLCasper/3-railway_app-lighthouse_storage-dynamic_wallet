import { verifyToken } from "../_lib/auth.js";

export async function onRequest(context) {
  try {
    const { request, env } = context;

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // verifyToken tagad ir asinhrona — jāizmanto await
    const user = await verifyToken(token, env);

    if (!user || !user.address) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      address: user.address
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
