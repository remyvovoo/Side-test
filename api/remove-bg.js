export const config = { runtime: 'edge' };

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
    const formData = await req.formData();
    const imageFile = formData.get('image_file');
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'image_file manquant' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Clé API : variable d'environnement Vercel (Settings > Environment Variables)
    // avec fallback temporaire sur la clé de dev
    const apiKey = process.env.REMOVE_BG_KEY || 'Epk2ThWvG6jxcVR1JBdAEGXm';

    const rbForm = new FormData();
    rbForm.append('image_file', imageFile);
    rbForm.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: rbForm,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[cardshot] remove.bg error', response.status, error);
      return new Response(JSON.stringify({ error: 'removal_failed' }), {
        status: response.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const imageBuffer = await response.arrayBuffer();
    return new Response(imageBuffer, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'image/png' },
    });
  } catch (err) {
    console.error('[cardshot] handler error', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}
