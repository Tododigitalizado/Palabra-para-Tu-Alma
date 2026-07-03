// Backend serverless (Vercel) — versículo del día.
// Usa la key SECRETA del servidor (ANTHROPIC_API_KEY). Los usuarios no la ven.

const MODELO = "claude-sonnet-5";

function parseJSONSeguro(texto) {
  let t = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export default async function handler(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel." });
    return;
  }

  const fecha = new Date().toDateString();

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 300,
        system: "Responde ÚNICAMENTE con JSON válido, sin texto extra ni backticks. Usa Reina-Valera 1960.",
        messages: [
          {
            role: "user",
            content:
              `Dame UN versículo bíblico poderoso y esperanzador para hoy ${fecha}. Responde solo JSON: { "versiculo": "...", "texto": "...", "testamento": "..." }`,
          },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: "Error de Anthropic", detalle: data });
      return;
    }

    const texto = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Cache de 6 horas en el borde de Vercel para no pagar una llamada por visita.
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate");
    res.status(200).json(parseJSONSeguro(texto));
  } catch (e) {
    res.status(500).json({ error: "No se pudo procesar la respuesta.", detalle: String(e) });
  }
}
