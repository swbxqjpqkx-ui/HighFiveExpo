// Vercel serverless proxy for the Anthropic (Claude) API.
//
// WHY THIS EXISTS: the High Five web build is a public JavaScript bundle, so the
// Anthropic API key must never ship inside it. Instead, the web app POSTs the
// same request body it would normally send to /v1/messages to THIS endpoint,
// and this server-side function injects the secret key (read from the
// ANTHROPIC_API_KEY environment variable configured in the Vercel dashboard)
// before forwarding the request to Anthropic. The key stays on the server.
//
// The native iOS/Android app is unaffected — it keeps calling Anthropic directly
// with the key from src/config/ai.ts.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    return;
  }

  try {
    // Vercel parses JSON bodies automatically; forward whatever the client sent.
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json');
    res.send(text);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? 'Proxy request to Anthropic failed.' });
  }
}
