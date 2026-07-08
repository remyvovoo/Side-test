export const config = { runtime: 'edge' };

// V1 : les emails sont visibles dans les logs Vercel (onglet Logs du projet).
// V2 : brancher Brevo (gratuit jusqu'à 300 emails/jour) pour la vraie liste.
export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'invalid_email' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Visible dans les logs Vercel — recherche "SUBSCRIBE"
    console.log('[cardshot] SUBSCRIBE:', email, new Date().toISOString());

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}
