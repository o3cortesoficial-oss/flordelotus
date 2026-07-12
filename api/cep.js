export default async function handler(request, response) {
  response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  const cep = String(request.query?.cep || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) {
    return response.status(400).json({ erro: true, message: 'CEP inválido' });
  }

  try {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
    });
    const address = await viaCepResponse.json();

    if (!viaCepResponse.ok || address.erro) {
      return response.status(404).json({ erro: true, message: 'CEP não encontrado' });
    }

    return response.status(200).json({
      cep: address.cep,
      logradouro: address.logradouro,
      bairro: address.bairro,
      localidade: address.localidade,
      uf: address.uf,
    });
  } catch (primaryError) {
    try {
      const fallbackResponse = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
        headers: { Accept: 'application/json' },
      });
      const address = await fallbackResponse.json();

      if (!fallbackResponse.ok) {
        return response.status(404).json({ erro: true, message: 'CEP não encontrado' });
      }

      return response.status(200).json({
        cep: address.cep,
        logradouro: address.street,
        bairro: address.neighborhood,
        localidade: address.city,
        uf: address.state,
      });
    } catch (fallbackError) {
      return response.status(502).json({ erro: true, message: 'Serviço de CEP indisponível' });
    }
  }
}
