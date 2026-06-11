export async function analyzeChantier(imageUris, description, tradeType) {
  const response = await fetch('https://presupclick-backend.vercel.app/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUris, description, tradeType }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}