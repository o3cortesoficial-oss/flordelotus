export default async function handler(request, response) {
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  const address = String(request.query?.address || '').trim().slice(0, 300);
  if (address.length < 5) return response.status(400).json({ error: 'Endereço obrigatório' });

  try {
    const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`, {
      headers: { 'User-Agent': 'CreamyCheckout/1.0', Accept: 'application/json' },
    });
    const geocode = await geocodeResponse.json();
    if (!geocodeResponse.ok || !geocode.length) return response.status(404).json({ error: 'Localização não encontrada' });
    const latitude = Number(geocode[0].lat);
    const longitude = Number(geocode[0].lon);
    const query = `[out:json][timeout:15];(node["name"~"Creamy",i](around:50000,${latitude},${longitude});way["name"~"Creamy",i](around:50000,${latitude},${longitude}););out center tags;`;
    const storesResponse = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const storesData = await storesResponse.json();
    if (!storesResponse.ok || !storesData.elements?.length) return response.status(404).json({ error: 'Nenhuma loja próxima' });

    const stores = storesData.elements.map(store => {
      const lat = store.lat || store.center?.lat;
      const lon = store.lon || store.center?.lon;
      const distance = Math.hypot((lat - latitude) * 111, (lon - longitude) * 111 * Math.cos(latitude * Math.PI / 180));
      const tags = store.tags || {};
      return {
        name: tags.name || 'Creamy',
        address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
        distanceKm: Math.round(distance * 10) / 10,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);

    return response.status(200).json(stores[0]);
  } catch {
    return response.status(502).json({ error: 'Serviço de lojas indisponível' });
  }
}
