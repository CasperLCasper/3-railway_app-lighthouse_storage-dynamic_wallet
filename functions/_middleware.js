export async function onRequest(context) {
  const response = await context.next();

  // Klonējam atbildi, lai varētu pievienot galvenes
  const newResponse = new Response(response.body, response);

  // Pilnā CSP ar default-src 'none'
  newResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net chrome-extension:; connect-src 'self' https: wss: chrome-extension:; img-src 'self' data: https: blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob:; video-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests;"
  );

  // Pārējās drošības galvenes
  newResponse.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return newResponse;
}
