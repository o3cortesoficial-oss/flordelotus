const CART_COOKIE = 'creamy_cart';

export const CATALOG = Object.freeze({
  product: {
    id: 'kit-firmador',
    name: 'Kit Firmador',
    listPrice: 46313,
    sellingPrice: 43997,
  },
  coupon: {
    code: 'MEUKIT50OFF',
    percentOff: 50,
  },
  gifts: new Set(['37', '38', '39', '40']),
});

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))];
  }).filter(([key]) => key));
}

function encodeState(state) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

function decodeState(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

export function readCart(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  const raw = decodeState(cookies[CART_COOKIE] || '');
  return {
    quantity: Math.max(1, Math.min(99, Number.parseInt(raw.quantity, 10) || 1)),
    couponCode: raw.couponCode === CATALOG.coupon.code ? raw.couponCode : null,
    giftId: CATALOG.gifts.has(String(raw.giftId)) ? String(raw.giftId) : null,
    shipping: raw.shipping && typeof raw.shipping === 'object' ? raw.shipping : null,
    lastActivationToken: typeof raw.lastActivationToken === 'string' ? raw.lastActivationToken.slice(0, 100) : null,
  };
}

export function writeCart(response, state) {
  response.setHeader('Set-Cookie', `${CART_COOKIE}=${encodeURIComponent(encodeState(state))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}

export function presentCart(state) {
  const subtotal = CATALOG.product.listPrice * state.quantity;
  const regularTotal = CATALOG.product.sellingPrice * state.quantity;
  const total = state.couponCode ? Math.round(regularTotal * (100 - CATALOG.coupon.percentOff) / 100) : regularTotal;
  return {
    quantity: state.quantity,
    coupon: state.couponCode ? { code: state.couponCode, percentOff: CATALOG.coupon.percentOff } : null,
    giftId: state.giftId,
    shipping: state.shipping,
    product: CATALOG.product,
    totals: {
      subtotal,
      discount: subtotal - total,
      total,
      currency: 'BRL',
    },
  };
}
