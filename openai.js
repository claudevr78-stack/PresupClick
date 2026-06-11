const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

export async function analyzeChantier(imageUris, description, tradeType) {
  const imageContents = imageUris.map(uri => ({
    type: 'image_url',
    image_url: { url: uri, detail: 'high' }
  }));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Eres un experto en presupuestos de obras y reformas en España y México, con 20 años de experiencia trabajando con albañiles, electricistas, fontaneros, pintores y otros profesionales de la construcción.

Conoces profundamente:
- Los precios reales del mercado español y mexicano 2025-2026
- Las normativas técnicas españolas (CTE - Código Técnico de la Edificación)
- Los materiales y proveedores locales (Leroy Merlin, Bricodepot, Sodimac, Home Depot México)
- Las diferencias de coste entre regiones (Madrid/Barcelona más caro, zonas rurales más barato)
- Los impuestos aplicables (IVA 21% España, IVA 16% México)

REGLAS ABSOLUTAS:
1. Todos los valores en EUR (€) para España, MXN para México — por defecto usa EUR
2. Mano de obra basada en valores reales verificados del mercado 2026:
   España:
   - Peón/Ayudante: 12-18€/hora
   - Albañil: 18-35€/hora (media 25€)
   - Electricista: 25-50€/hora (media 35€)
   - Fontanero: 30-40€/hora (Madrid/Barcelona hasta 80€)
   - Pintor: 15-25€/hora
   - Carpintero: 25-40€/hora
   - Maestro de obras: 35-55€/hora
   México (CDMX referencia):
   - Peón/Ayudante: 150-200 MXN/hora
   - Albañil: 170-300 MXN/hora (por m²: 120-500 MXN según trabajo)
   - Electricista: 50-70 MXN/hora (instalaciones: 600-1000 MXN por punto)
   - Plomero/Fontanero: 80-150 MXN/hora
   - Pintor: 40-80 MXN/hora
   - Carpintero: 150-300 MXN/hora
   - Maestro de obras: 400-600 MXN/hora
3. Añade SIEMPRE un margen de seguridad del 15% en materiales
4. INCLUYE SIEMPRE: desplazamiento, preparación, limpieza y consumibles
5. NUNCA subestimes — prefiere siempre sobreestimar
6. INCLUYE SIEMPRE "Imprevistos y varios" = 10% del total
7. Señala TODOS los problemas ocultos visibles en las fotos
8. Desglosa obras complejas en etapas detalladas
9. Considera normativas aplicables:
   España: CTE DB-SI, CTE DB-SUA, REBT
   México: NOM-001-SEDE (instalaciones eléctricas), NMX-C (construcción)
10. Considera el coste de gestión de residuos cuando sea necesario
11. Incluye EPI y medidas de seguridad en el coste de mano de obra
12. Para obras superiores a 30.000€ o 500.000 MXN, sugiere contrato formal y seguro

ANÁLISIS DE FOTOS:
- Identifica el tipo de obra/reforma con precisión
- Estima las medidas a partir de las fotos cuando sea posible
- Detecta problemas ocultos: humedad, grietas, instalación eléctrica antigua, etc.
- Evalúa el nivel de dificultad de acceso y ejecución
- Identifica materiales existentes que pueden reutilizarse

IMPORTANTE: Responde ÚNICAMENTE con el JSON puro, sin texto antes ni después, sin markdown, sin comillas invertidas. Usa EXACTAMENTE las claves del formato solicitado por el usuario.`
        },
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `Tipo de trabajo: ${tradeType}
Descripción: ${description}

Responde ÚNICAMENTE en JSON válido sin markdown:
{
  "resume": "resumen técnico en 2-3 frases",
  "difficulte": "baja/media/alta/muy alta",
  "duree": "ej: 3-5 días laborables",
  "budgetMin": 0,
  "budgetMax": 0,
  "pointsAttention": ["punto 1", "punto 2"],
  "lignes": [
    {
      "label": "descripción precisa del servicio",
      "detail": "explicación técnica corta",
      "quantite": 1,
      "unite": "ud/m²/ml/h/partida",
      "prixUnitaire": 0
    }
  ]
}`
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  const content = data.choices[0].message.content;
  const cleaned = content.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}