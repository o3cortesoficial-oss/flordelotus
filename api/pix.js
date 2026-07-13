import { presentCart, readCart, writeCart } from './lib/cart-state.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nlawvbnenzyjknmsqlwa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYXd2Ym5lbnp5amtubXNxbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjg3NTcsImV4cCI6MjA5MTg0NDc1N30.gEr2isb_ibqpFQBXpPDcqai0_szbE3bucOt-oiqv0Uo';

async function loadGateway() {
  if (process.env.WESTPAY_API_KEY && process.env.WESTPAY_PUBLIC_KEY) {
    return { provider: 'westpay', apiKey: process.env.WESTPAY_API_KEY, publicKey: process.env.WESTPAY_PUBLIC_KEY };
  }
  const result = await fetch(`${SUPABASE_URL}/rest/v1/creamy_gateway_config?id=eq.1&select=provider,client_id,client_secret`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!result.ok) throw new Error('Não foi possível carregar o gateway ativo');
  const rows = await result.json();
  const config = rows[0];
  if (!config || config.provider !== 'westpay' || !config.client_id || !config.client_secret) {
    throw new Error('West Pay não está configurada');
  }
  return { provider: 'westpay', apiKey: config.client_id, publicKey: config.client_secret };
}

function originFrom(request) {
  const proto = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido' });

  try {
    const state = readCart(request);
    const cart = presentCart(state);
    if (!state.profile) return response.status(422).json({ error: 'Preencha a identificação antes do pagamento' });
    if (!state.shipping || state.shipping.method !== 'delivery' || !state.shipping.street) {
      return response.status(422).json({ error: 'Preencha o endereço de entrega antes do pagamento' });
    }

    const fingerprint = [cart.totals.total, cart.quantity, state.couponCode || '', state.addonIds.join(','), state.shipping.cep].join(':');
    if (state.pix && state.pix.fingerprint === fingerprint && state.pix.qrcode && new Date(state.pix.expiresAt).getTime() > Date.now() + 30000) {
      return response.status(200).json({ transactionId: state.pix.id, copyPaste: state.pix.qrcode, expiresAt: state.pix.expiresAt, gateway: 'westpay' });
    }

    const gateway = await loadGateway();
    const externalRef = `creamy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
      amount: cart.totals.total,
      paymentMethod: 'pix',
      externalRef,
      customer: {
        name: `${state.profile.firstName} ${state.profile.lastName}`.trim(),
        email: state.profile.email,
        phone: state.profile.phone,
        document: { number: state.profile.document, type: 'cpf' },
      },
      items: [{ title: 'Pedido Creamy', unitPrice: cart.totals.total, quantity: 1, tangible: true, externalRef }],
      shipping: {
        fee: 0,
        address: {
          street: state.shipping.street,
          streetNumber: state.shipping.number,
          complement: state.shipping.complement || '',
          zipCode: state.shipping.cep,
          neighborhood: state.shipping.neighborhood,
          city: state.shipping.city,
          state: state.shipping.state,
          country: 'br',
        },
      },
      pix: { expiresInDays: 1 },
      postbackUrl: `${originFrom(request)}/api/webhook/pix`,
    };

    const westPayResponse = await fetch('https://api.gw.westpay.com.br/api/v1/transactions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${gateway.apiKey}:${gateway.publicKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OfertaCreamy/1.0',
      },
      body: JSON.stringify(payload),
    });
    const data = await westPayResponse.json().catch(() => ({}));
    if (!westPayResponse.ok || !data.pix?.qrcode) {
      console.error('West Pay recusou a cobrança:', westPayResponse.status, data);
      const message = westPayResponse.status === 401 ? 'Credenciais da West Pay inválidas' : 'Não foi possível gerar o Pix na West Pay';
      return response.status(502).json({ error: message });
    }

    state.pix = { id: String(data.id), qrcode: String(data.pix.qrcode), expiresAt: String(data.pix.expiresAt), fingerprint };
    writeCart(response, state);
    return response.status(201).json({ transactionId: state.pix.id, copyPaste: state.pix.qrcode, expiresAt: state.pix.expiresAt, gateway: 'westpay' });
  } catch (error) {
    console.error('Erro ao criar Pix:', error);
    return response.status(500).json({ error: error.message || 'Não foi possível gerar o Pix' });
  }
}
