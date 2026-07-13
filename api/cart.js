import { CATALOG, presentCart, readCart, writeCart } from './lib/cart-state.js';
import { recordCheckoutActivation, recordFunnelStage } from './lib/events.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  let state = readCart(request);

  if (request.method === 'POST') {
    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const action = body.action;

    if (action === 'activate') {
      state.quantity = Math.max(1, Math.min(99, Number.parseInt(body.quantity, 10) || 1));
      const activationToken = String(body.activationToken || '').slice(0, 100);
      if (!activationToken) return response.status(422).json({ error: 'Identificador da ativação ausente' });
      if (activationToken !== state.lastActivationToken) {
        const total = CATALOG.product.sellingPrice * state.quantity;
        try {
          await recordCheckoutActivation({ request, quantity: state.quantity, total });
          if (!state.funnelStages.includes('cart')) state.funnelStages.push('cart');
          state.lastActivationToken = activationToken;
        } catch (error) {
          console.error('Erro ao registrar ativação do checkout:', error);
        }
      }
    } else if (action === 'stage') {
      const stage = String(body.stage || '');
      const labels = { product: 'Página do produto', profile: 'Identificação', shipping: 'Entrega', payment: 'Pagamento' };
      if (!labels[stage]) return response.status(422).json({ error: 'Etapa inválida' });
      if (!state.funnelStages.includes(stage)) {
        try {
          await recordFunnelStage({ request, stage, detail: labels[stage], value: 0 });
          state.funnelStages.push(stage);
        } catch (error) {
          console.error('Erro ao registrar etapa do funil:', error);
        }
      }
    } else if (action === 'quantity') {
      state.quantity = Math.max(1, Math.min(99, Number.parseInt(body.quantity, 10) || 1));
      state.pix = null;
    } else if (action === 'coupon') {
      if (String(body.code || '').toUpperCase() !== CATALOG.coupon.code) {
        return response.status(422).json({ error: 'Cupom inválido' });
      }
      state.couponCode = CATALOG.coupon.code;
      state.pix = null;
    } else if (action === 'gift') {
      const giftId = String(body.giftId || '');
      if (giftId && !CATALOG.gifts.has(giftId)) return response.status(422).json({ error: 'Brinde inválido' });
      state.giftId = giftId || null;
      state.pix = null;
    } else if (action === 'addon') {
      const addonId = String(body.addonId || '');
      if (!CATALOG.addons.has(addonId)) return response.status(422).json({ error: 'Produto adicional inválido' });
      if (!state.addonIds.includes(addonId)) state.addonIds.push(addonId);
      state.pix = null;
    } else if (action === 'addon-remove') {
      const addonId = String(body.addonId || '');
      state.addonIds = state.addonIds.filter(id => id !== addonId);
      state.pix = null;
    } else if (action === 'profile') {
      const profile = body.profile || {};
      const email = String(profile.email || '').trim().toLowerCase();
      const phone = String(profile.phone || '').replace(/\D/g, '');
      const document = String(profile.document || '').replace(/\D/g, '');
      const firstName = String(profile.firstName || '').trim();
      const lastName = String(profile.lastName || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName || !/^\d{10,11}$/.test(phone) || !/^\d{11}$/.test(document)) {
        return response.status(422).json({ error: 'Preencha corretamente os dados de identificação' });
      }
      state.profile = { email, phone, document, firstName: firstName.slice(0, 80), lastName: lastName.slice(0, 120) };
      state.pix = null;
    } else if (action === 'shipping') {
      if (!body.shipping || !['delivery', 'pickup'].includes(body.shipping.method)) {
        return response.status(422).json({ error: 'Entrega inválida' });
      }
      state.shipping = {
        method: body.shipping.method,
        cep: String(body.shipping.cep || '').replace(/\D/g, '').slice(0, 8),
        address: String(body.shipping.address || '').slice(0, 300),
        store: body.shipping.store ? String(body.shipping.store).slice(0, 300) : null,
        rate: body.shipping.method === 'delivery' ? 'standard-free' : 'pickup',
      };
      state.pix = null;
    } else if (action === 'address') {
      const address = body.address || {};
      const cep = String(address.cep || '').replace(/\D/g, '').slice(0, 8);
      const required = ['recipient', 'street', 'number', 'neighborhood', 'city', 'state'];
      if (cep.length !== 8 || required.some(field => !String(address[field] || '').trim())) {
        return response.status(422).json({ error: 'Preencha o endereço completo' });
      }
      state.shipping = {
        method: 'delivery',
        rate: 'standard-free',
        cep,
        recipient: String(address.recipient).trim().slice(0, 120),
        street: String(address.street).trim().slice(0, 160),
        number: String(address.number).trim().slice(0, 30),
        complement: String(address.complement || '').trim().slice(0, 100),
        neighborhood: String(address.neighborhood).trim().slice(0, 100),
        city: String(address.city).trim().slice(0, 100),
        state: String(address.state).trim().toUpperCase().slice(0, 2),
        address: [address.street, address.number, address.complement, address.neighborhood, address.city, address.state]
          .map(value => String(value || '').trim()).filter(Boolean).join(', ').slice(0, 500),
        store: null,
      };
      state.pix = null;
    } else {
      return response.status(400).json({ error: 'Ação inválida' });
    }

    writeCart(response, state);
  } else if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Método não permitido' });
  }

  return response.status(200).json(presentCart(state));
}
