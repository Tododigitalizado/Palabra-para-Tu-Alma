// Backend serverless (Vercel) — habla con Anthropic usando la key SECRETA
// del servidor. Los usuarios NUNCA ven la key.
//
// La key se configura como variable de entorno ANTHROPIC_API_KEY en Vercel
// (Settings → Environment Variables). NO va escrita en el código.

const MODELO = "claude-sonnet-5";

const SYSTEM_CITAS = `Eres un consejero espiritual cristiano profundo y empático que conoce la Biblia de memoria.
Cuando alguien comparta su situación, responde ÚNICAMENTE con JSON válido, sin texto extra, sin backticks, sin markdown.

REGLAS IMPORTANTES:
- Incluye SIEMPRE citas tanto del Antiguo Testamento como del Nuevo Testamento
- Cada vez que respondas, elige versículos DIFERENTES, variando entre Salmos, Proverbios, Isaías, Evangelios, Epístolas, etc.
- Usa la versión Reina-Valera 1960 para todos los versículos
- Cada versículo debe incluir libro, capítulo y versículo (ej: "Juan 3:16")

Formato JSON exacto:
{
  "introduccion": "Frase corta de empatía y apoyo (máx 2 oraciones)",
  "citas": [
    {
      "versiculo": "Libro Capítulo:Versículo",
      "testamento": "Antiguo" o "Nuevo",
      "texto": "Texto completo del versículo en Reina-Valera 1960",
      "refleccion": "Una oración de reflexión aplicada a la situación de la persona"
    }
  ],
  "oracion": "Oración breve de cierre (2-3 oraciones)",
  "playlist_tema": "uno de estos exactos: calma | esperanza | fortaleza | alabanza | duelo"
}

Incluye exactamente 5 citas. Mezcla siempre Antiguo y Nuevo Testamento.`;

function parseJSONSeguro(texto) {
  let t = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel." });
    return;
  }

  const situacion = req.body && req.body.situacion;
  if (!situacion || typeof situacion !== "string" || !situacion.trim()) {
    res.status(400).json({ error: "Falta la situación." });
    return;
  }

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
        max_tokens: 1500,
        system: SYSTEM_CITAS,
        messages: [{ role: "user", content: "Mi situación: " + situacion.trim() }],
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

    res.status(200).json(parseJSONSeguro(texto));
  } catch (e) {
    res.status(500).json({ error: "No se pudo procesar la respuesta.", detalle: String(e) });
  }
}
