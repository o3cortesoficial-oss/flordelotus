import { CATALOG, presentCart, readCart, writeCart } from './lib/cart-state.js';
import { recordCheckoutActivation } from './lib/events.js';

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
          await recordCheckoutActivation({ quantity: state.quantity, total });
          state.lastActivationToken = activationToken;
        } catch (error) {
          console.error('Erro ao registrar ativação do checkout:', error);
        }
      }
    } else if (action === 'quantity') {
      state.quantity = Math.max(1, Math.min(99, Number.parseInt(body.quantity, 10) || 1));
    } else if (action === 'coupon') {
      if (String(body.code || '').toUpperCase() !== CATALOG.coupon.code) {
        return response.status(422).json({ error: 'Cupom inválido' });
      }
      state.couponCode = CATALOG.coupon.code;
    } else if (action === 'gift') {
      const giftId = String(body.giftId || '');
      if (giftId && !CATALOG.gifts.has(giftId)) return response.status(422).json({ error: 'Brinde inválido' });
      state.giftId = giftId || null;
    } else if (action === 'addon') {
      const addonId = String(body.addonId || '');
      if (!CATALOG.addons.has(addonId)) return response.status(422).json({ error: 'Produto adicional inválido' });
      if (!state.addonIds.includes(addonId)) state.addonIds.push(addonId);
    } else if (action === 'addon-remove') {
      const addonId = String(body.addonId || '');
      state.addonIds = state.addonIds.filter(id => id !== addonId);
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
    } else {
      return response.status(400).json({ error: 'Ação inválida' });
    }

    writeCart(response, state);
  } else if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Método não permitido' });
  }

  return response.status(200).json(presentCart(state));
}
