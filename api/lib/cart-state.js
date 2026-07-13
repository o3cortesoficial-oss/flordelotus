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
  addons: new Map([
    ['134', { id: '134', name: 'Creme Hidratante Labial - Lip Balm Latte', listPrice: 3683, sellingPrice: 3499 }],
    ['135', { id: '135', name: 'Creme Hidratante Labial - Lip Balm Chai', listPrice: 3683, sellingPrice: 3499 }],
    ['136', { id: '136', name: 'Creme Hidratante Labial - Lip Balm Mocha', listPrice: 3683, sellingPrice: 3499 }],
    ['216', { id: '216', name: 'Loção Hidratante Fortalecedora - Ceramide Body Cream 200ml', listPrice: 4499, sellingPrice: 4274 }],
  ]),
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
    addonIds: Array.isArray(raw.addonIds) ? raw.addonIds.map(String).filter(id => CATALOG.addons.has(id)) : [],
    lastActivationToken: typeof raw.lastActivationToken === 'string' ? raw.lastActivationToken.slice(0, 100) : null,
  };
}

export function writeCart(response, state) {
  response.setHeader('Set-Cookie', `${CART_COOKIE}=${encodeURIComponent(encodeState(state))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}

export function presentCart(state) {
  const subtotal = CATALOG.product.listPrice * state.quantity;
  const regularTotal = CATALOG.product.sellingPrice * state.quantity;
  const addons = state.addonIds.map(id => CATALOG.addons.get(id)).filter(Boolean);
  const addonsSubtotal = addons.reduce((sum, item) => sum + item.listPrice, 0);
  const addonsTotal = addons.reduce((sum, item) => sum + item.sellingPrice, 0);
  const fullSubtotal = subtotal + addonsSubtotal;
  const fullRegularTotal = regularTotal + addonsTotal;
  const total = state.couponCode ? Math.round(fullRegularTotal * (100 - CATALOG.coupon.percentOff) / 100) : fullRegularTotal;
  return {
    quantity: state.quantity,
    coupon: state.couponCode ? { code: state.couponCode, percentOff: CATALOG.coupon.percentOff } : null,
    giftId: state.giftId,
    shipping: state.shipping,
    addons,
    product: CATALOG.product,
    totals: {
      subtotal: fullSubtotal,
      discount: fullSubtotal - total,
      total,
      currency: 'BRL',
    },
  };
}
