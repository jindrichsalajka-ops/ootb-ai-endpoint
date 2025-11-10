// api/ootb-advice.js
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // CORS – můžeš zpřísnit na konkrétní doménu tvého webu
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { area, urgency, size, description } = req.body || {};
    const desc = String(description || '').slice(0, 2000);

    const system = `
Jsi seniorní konzultant Out of the Box. Odpovídej česky, prakticky, v bodech (max 6), bez právních rad a bez osobních údajů.
Vrať jednoduché HTML: <h4>…</h4><ul>…</ul><div class="oobpa-cta">…</div> s tlačítkem "Domluvit konzultaci" (mailto:info@outofthebox.cz).
`.trim();

    const user = `
Oblast: ${area}
Urgence: ${urgency}
Velikost firmy: ${size}
Popis (anonymně): ${desc}
`.trim();

    const model = process.env.OOB_MODEL || 'gpt-4o-mini';

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.4,
        max_tokens: 600
      })
    });

    if (!r.ok) {
      return res.status(200).json({ ok: true, advice: fallbackText(area) });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    const adviceHtml = sanitizeHtml(text) || fallbackHtml(area);

    return res.status(200).json({ ok: true, adviceHtml });
  } catch (e) {
    return res.status(200).json({ ok: true, advice: fallbackText('Diagnostika') });
  }
}

function sanitizeHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '');
}

function fallbackHtml(area) {
  return `<h4>Doporučení</h4>
<ul>
  <li>Krátký diagnostický rozhovor (30 min).</li>
  <li>Vyberte 1 pilotní téma na 2–4 týdny.</li>
  <li>Průběžná zpětná vazba a stabilizace.</li>
</ul>
<div class="oobpa-cta">
  <a class="primary" href="mailto:info@outofthebox.cz?subject=Konzultace%20–%20${encodeURIComponent(area || 'Diagnostika')}">Domluvit konzultaci</a>
  <a href="#jak-pomahame">Zjistit víc</a>
</div>`;
}

function fallbackText() {
  return 'Zahajte krátkou diagnostiku (30 min), vyberte 1 pilotní téma a nastavte zpětnou vazbu.';
}
