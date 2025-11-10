// api/ootb-advice.js
// Out of the Box – AI endpoint pro personalizovaná doporučení (HTML výstup)
//
// ENV proměnné (Project → Settings → Environment Variables):
//   OPENAI_API_KEY = sk-...           (povinné)
//   OOB_MODEL      = gpt-4o-mini      (volitelné; default viz níže)

export default async function handler(req, res) {
  // CORS & metody
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', getOrigin(req));
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // CORS hlavičky pro odpověď
  const origin = getOrigin(req); // pro produkci můžeš nahradit konkrétní doménou: 'https://outofthebox.cz'
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { area, urgency, size, description } = req.body || {};
    const desc = String(description || '').slice(0, 2000);

    // 1) Klíč k OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        ok: false,
        error: 'MISSING_OPENAI_KEY',
        advice: fallbackText()
      });
    }

    // 2) Prompty – neutrální (rodinné/privátní firmy, výroba obecně; žádné obuvnictví)
    const system = `
Jsi seniorní konzultant společnosti Out of the Box, která pomáhá rodinným a privátním (zejm. výrobním) firmám.
Odpovídej česky, konkrétně a akčně v bodech (max 6 kroků), zaměř se na kroky nasaditelné do 30–60 dní.
Zohledňuj: vztah vlastník–management, firemní kulturu, komunikaci a důvěru, plánování, kapacitní úzká hrdla, leadership.
Nevyžaduj osobní údaje, nedávej právní/účetní rady, neměň téma dotazu.
Výstup vrať jako čisté HTML pro vložení do webu:
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
- Popis problému (anonymně, bez PII): ${desc}

ÚKOL:
1) Pojmenuj v <h4> hlavní jádro problému.
2) Přidej 4–6 praktických kroků (<li>…</li>) pro diagnostiku → pilot → stabilizaci.
3) Pokud dává smysl, zohledni plán vs. skutečnost, kapacitu a úzká hrdla.
4) Zakonči CTA blokem „Domluvit konzultaci“ (mailto: info@outofthebox.cz; předmět = „Konzultace – ${area || 'Diagnostika'}“).
`.trim();

    // 3) Volání OpenAI
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
        temperature: 0.35,
        max_tokens: 600
      })
    });

    // 4) Chyby z OpenAI – přátelštější diagnostika pro UI
    if (!r.ok) {
      const detail = await safeText(r);
      const is429 = r.status === 429;
      return res.status(200).json({
        ok: false,
        error: `OPENAI_${r.status}`,
        detail: (detail || '').slice(0, 500),
        aiUnavailable: is429 ? true : false,
        advice: fallbackText()
      });
    }

    // 5) Úspěch – vyčisti HTML a vrať
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    const adviceHtml = sanitizeHtml(text) || fallbackHtml(area);

    return res.status(200).json({ ok: true, adviceHtml });

  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: 'ENDPOINT_EXCEPTION',
      advice: fallbackText()
    });
  }
}

// ————— Pomocné funkce —————
function getOrigin(req) {
  // Pro produkci můžeš vrátit konkrétní doménu WP: 'https://outofthebox.cz'
  return req.headers.origin || '*';
}

async function safeText(resp) {
  try { return await resp.text(); } catch { return ''; }
}

function sanitizeHtml(s) {
  // Jednoduché očištění – povolíme běžné značky, stripneme skripty/handler atributy
  return String(s || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
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

