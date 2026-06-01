// Izmantojam onRequestGet, kas automātiski atļauj TIKAI GET pieprasījumus (aizstāj 405 pārbaudi)
export async function onRequestGet(context) {
  // Paņemam vides mainīgo tieši no Cloudflare context.env
  const contractAddress = context.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    return new Response(JSON.stringify({ error: 'CONTRACT_ADDRESS not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ address: contractAddress }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
