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
    const { area, urgency, size, description, lang, language, response_language, instruction } = req.body || {};
    const desc = String(description || '').slice(0, 2000);
    const requestedLang = String(lang || language || response_language || '').toLowerCase();
const isEnglish = requestedLang.startsWith('en') || requestedLang.includes('english');

const labels = isEnglish ? {
  companyContext: 'family-owned and privately held companies, especially manufacturing businesses',
  answerLanguage: 'Answer in English, specifically and actionably, in bullet points (max 6 steps), focused on steps deployable within 30–60 days.',
  consider: 'Consider: owner–management relationship, company culture, communication and trust, planning, capacity bottlenecks, and leadership.',
  dontAsk: 'Do not request personal data, do not provide legal/accounting advice, and do not change the topic of the request.',
  output: 'Return the output as clean HTML for embedding on a website:',
  cta: 'At the end, always add a CTA block with the email info@outofthebox.cz and a subject line based on the problem area.',
  context: 'CONTEXT',
  area: 'Area',
  urgency: 'Urgency',
  size: 'Company size',
  desc: 'Problem description (anonymous, no PII)',
  task: 'TASK',
  task1: 'Name the core problem in <h4>.',
  task2: 'Add 5–7 practical steps (<li>…</li>) for diagnosis → pilot → stabilization.',
  task3: 'Where relevant, consider plan vs. actuals, capacity, and bottlenecks.',
  task4: 'Finish with a CTA block "Schedule a consultation" (mailto: info@outofthebox.cz; subject = "Consultation – ' ,
  fallbackTitle: 'Recommendation',
  fallback1: 'Start with a short diagnostic call (30 min).',
  fallback2: 'Select one pilot topic for 2–4 weeks.',
  fallback3: 'Use ongoing feedback and stabilization.',
  fallbackBtn1: 'Schedule a consultation',
  fallbackBtn2: 'Learn more',
  fallbackText: 'Start with a short diagnosis (30 min), choose one pilot topic, and set up a feedback loop.',
  fallbackArea: 'Diagnostics'
} : {
  companyContext: 'rodinným a privátním (zejm. výrobním) firmám',
  answerLanguage: 'Odpovídej česky, konkrétně a akčně v bodech (max 6 kroků), zaměř se na kroky nasaditelné do 30–60 dní.',
  consider: 'Zohledňuj: vztah vlastník–management, firemní kulturu, komunikaci a důvěru, plánování, kapacitní úzká hrdla, leadership.',
  dontAsk: 'Nevyžaduj osobní údaje, nedávej právní/účetní rady, neměň téma dotazu.',
  output: 'Výstup vrať jako čisté HTML pro vložení do webu:',
  cta: 'V závěru vždy přidej CTA blok s e-mailem info@outofthebox.cz a předmětem podle oblasti problému.',
  context: 'KONTEKST',
  area: 'Oblast',
  urgency: 'Urgence',
  size: 'Velikost firmy',
  desc: 'Popis problému (anonymně, bez PII)',
  task: 'ÚKOL',
  task1: 'Pojmenuj v <h4> hlavní jádro problému.',
  task2: 'Přidej 5–7 praktických kroků (<li>…</li>) pro diagnostiku → pilot → stabilizaci.',
  task3: 'Pokud dává smysl, zohledni plán vs. skutečnost, kapacitu a úzká hrdla.',
  task4: 'Zakonči CTA blokem „Domluvit konzultaci“ (mailto: info@outofthebox.cz; předmět = „Konzultace – ',
  fallbackTitle: 'Doporučení',
  fallback1: 'Krátký diagnostický rozhovor (30 min).',
  fallback2: 'Vyberte 1 pilotní téma na 2–4 týdny.',
  fallback3: 'Průběžná zpětná vazba a stabilizace.',
  fallbackBtn1: 'Domluvit konzultaci',
  fallbackBtn2: 'Zjistit víc',
  fallbackText: 'Zahajte krátkou diagnostiku (30 min), vyberte 1 pilotní téma a nastavte zpětnou vazbu.',
  fallbackArea: 'Diagnostika'
};

    // 1) Klíč k OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        ok: false,
        error: 'MISSING_OPENAI_KEY',
        advice: fallbackText(isEnglish)
      });
    }

    // 2) Prompty – neutrální (rodinné/privátní firmy, výroba obecně)
    const system = `
Jsi seniorní konzultant společnosti Out of the Box, která pomáhá ${labels.companyContext}.
${labels.answerLanguage}
${labels.consider}
${labels.dontAsk}
${labels.output}
<h4>…</h4>
<ul><li>…</li></ul>
<div class="oobpa-cta">…</div>
${labels.cta}
${instruction ? `Additional instruction: ${instruction}` : ''}
`.trim();

const user = `
${labels.context}:
- ${labels.area}: ${area}
- ${labels.urgency}: ${urgency}
- ${labels.size}: ${size}
- ${labels.desc}: ${desc}

${labels.task}:
1) ${labels.task1}
2) ${labels.task2}
3) ${labels.task3}
4) ${labels.task4}${area || labels.fallbackArea}”).
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
        advice: fallbackText(isEnglish)
      });
    }

    // 5) Úspěch – vyčisti HTML a vrať
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    const adviceHtml = sanitizeHtml(text) || fallbackHtml(area, isEnglish);

    return res.status(200).json({ ok: true, adviceHtml });

  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: 'ENDPOINT_EXCEPTION',
      advice: fallbackText(isEnglish)
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

function fallbackHtml(area, isEnglish = false) {
  const t = isEnglish ? {
    title: 'Recommendation',
    l1: 'Start with a short diagnostic call (30 min).',
    l2: 'Select one pilot topic for 2–4 weeks.',
    l3: 'Use ongoing feedback and stabilization.',
    btn1: 'Schedule a consultation',
    btn2: 'Learn more',
    area: 'Diagnostics'
  } : {
    title: 'Doporučení',
    l1: 'Krátký diagnostický rozhovor (30 min).',
    l2: 'Vyberte 1 pilotní téma na 2–4 týdny.',
    l3: 'Průběžná zpětná vazba a stabilizace.',
    btn1: 'Domluvit konzultaci',
    btn2: 'Zjistit víc',
    area: 'Diagnostika'
  };

  return `<h4>${t.title}</h4>
<ul>
  <li>${t.l1}</li>
  <li>${t.l2}</li>
  <li>${t.l3}</li>
</ul>
<div class="oobpa-cta">
  <a class="primary" href="mailto:info@outofthebox.cz?subject=${encodeURIComponent((isEnglish ? 'Consultation' : 'Konzultace') + ' – ' + (area || t.area))}">${t.btn1}</a>
  <a href="#jak-pomahame">${t.btn2}</a>
</div>`;
}

function fallbackText(isEnglish = false) {
  return isEnglish
    ? 'Start with a short diagnosis (30 min), choose one pilot topic, and set up a feedback loop.'
    : 'Zahajte krátkou diagnostiku (30 min), vyberte 1 pilotní téma a nastavte zpětnou vazbu.';
}
