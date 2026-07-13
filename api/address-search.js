export default async function handler(request, response) {
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  const query = String(request.query?.q || '').trim().slice(0, 200);
  if (query.length < 5) return response.status(400).json({ error: 'Endereço incompleto' });

  try {
    const upstream = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'CreamyCheckout/1.0', Accept: 'application/json' },
    });
    const results = await upstream.json();
    if (!upstream.ok || !results.length) return response.status(404).json({ error: 'Endereço não encontrado' });
    const result = results[0];
    return response.status(200).json({
      displayName: result.display_name,
      cep: result.address?.postcode || null,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    });
  } catch {
    return response.status(502).json({ error: 'Serviço de endereço indisponível' });
  }
}
