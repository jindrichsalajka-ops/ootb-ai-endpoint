// api/ootb-advice.js
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { area, urgency, size, description } = req.body || {};
    const desc = String(description || '').slice(0, 2000);

    // 1) chybějící klíč
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ ok: false, error: 'MISSING_OPENAI_KEY', advice: fallbackText() });
    }

    const system = `
Jsi seniorní konzultant společnosti Out of the Box, která pomáhá rodinným a privátním výrobním firmám.
Odpovídej česky, konkrétně a akčně — v bodech (max 6), zaměř se na reálné kroky, které může management nasadit do 1–2 měsíců.
Zohledňuj faktory jako vztah vlastník–management, firemní kultura, komunikace, důvěra, plánování, kapacitní úzká hrdla a rozvoj leadershipu.
Vyhýbej se právním nebo účetním doporučením, nevyžaduj osobní údaje a neměň téma dotazu.
Výstup musí být čisté HTML pro vložení do webu:
<h4>…</h4>
<ul><li>…</li></ul>
<div class="oobpa-cta">…</div>
V závěru vždy přidej CTA blok s e-mailem info@outofthebox.cz a předmětem podle oblasti problému.
`.trim();

const user = `
KONTEKST:
- Oblast: ${area}
- Urgence: ${urgency}
- Velikost firmy: ${size}
- Popis problému (anonymně): ${desc}

ÚKOL:
1) Shrň v <h4> hlavní problém.
2) Přidej 4–6 kroků k nápravě nebo rozvoji (v bodech <li>…</li>).
3) Navrhni reálné první kroky (diagnostika, pilot, zpětná vazba, průvodce změnou).
4) Zakonči CTA blokem „Domluvit konzultaci“ s mailto: info@outofthebox.cz (předmět = „Konzultace – ${area || 'Diagnostika'}“).
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
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.4,
        max_tokens: 600
      })
    });

    // 2) lepší chybové hlášení
    if (!r.ok) {
      const detail = await r.text();
      return res.status(200).json({
        ok: false,
        error: `OPENAI_${r.status}`,
        detail: detail?.slice(0, 500),
        advice: fallbackText()
      });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    const adviceHtml = sanitizeHtml(text) || fallbackHtml(area);

    return res.status(200).json({ ok: true, adviceHtml });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'ENDPOINT_EXCEPTION', advice: fallbackText() });
  }
}

function sanitizeHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '');
}

function fallbackHtml(area) {
  return `<h4>Doporučení</h4><ul><li>Krátký diagnostický rozhovor (30 min).</li><li>Vyberte 1 pilotní téma na 2–4 týdny.</li><li>Průběžná zpětná vazba a stabilizace.</li></ul><div class="oobpa-cta"><a class="primary" href="mailto:info@outofthebox.cz?subject=Konzultace%20–%20${encodeURIComponent(area || 'Diagnostika')}">Domluvit konzultaci</a><a href="#jak-pomahame">Zjistit víc</a></div>`;
}
function fallbackText() {
  return 'Zahajte krátkou diagnostiku (30 min), vyberte 1 pilotní téma a nastavte zpětnou vazbu.';
}
