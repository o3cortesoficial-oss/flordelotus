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
    } else {
      return response.status(400).json({ error: 'Ação inválida' });
    }

    writeCart(response, state);
  } else if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Método não permitido' });
  }

  return response.status(200).json(presentCart(state));
}
