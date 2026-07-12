import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Rodar a verificação de antibot apenas na página de vendas principal
  if (pathname === '/' || pathname === '/index.html') {
    
    // 1. Permitir bypass via parâmetro ?bypass=1 ou cookie creamy_bypass
    const hasBypassParam = url.searchParams.get('bypass') === '1';
    const hasBypassCookie = request.cookies.get('creamy_bypass')?.value === 'true';

    if (hasBypassParam || hasBypassCookie) {
      const response = NextResponse.next();
      if (hasBypassParam) {
        // Define o cookie de bypass por 30 dias para facilitar testes do admin
        response.cookies.set('creamy_bypass', 'true', { 
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          secure: true,
          sameSite: 'lax'
        });
      }
      return response;
    }

    // 2. Filtro de Bots via User-Agent Heuristics
    const userAgent = request.headers.get('user-agent') || '';
    const botPatterns = [
      'googlebot', 'facebookexternalhit', 'facebot', 'adsbot', 'adcheck', 
      'crawler', 'spider', 'lighthouse', 'chrome-lighthouse', 'twitterbot', 
      'bingbot', 'yandexbot', 'semrushbot', 'ahrefsbot', 'pingdom', 'bot'
    ];
    
    const isBot = botPatterns.some(pattern => userAgent.toLowerCase().includes(pattern));
    if (isBot) {
      console.log(`[AntiBot Vercel] Bot detectado via User-Agent: ${userAgent}. Redirecionando para /safe`);
      return NextResponse.redirect(new URL('/safe', request.url));
    }

    // 3. Filtro Geográfico Nativo da Vercel Edge Network
    // Redireciona tráfego de fora do Brasil (ex: revisores do Facebook/Google nos EUA)
    const country = request.headers.get('x-vercel-ip-country') || '';
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    if (country && country !== 'BR' && !isLocalhost) {
      console.log(`[AntiBot Vercel] Tráfego bloqueado de fora do Brasil (País: ${country}). Redirecionando para /safe`);
      return NextResponse.redirect(new URL('/safe', request.url));
    }
  }

  return NextResponse.next();
}

// Rodar apenas na página principal
export const config = {
  matcher: ['/', '/index.html'],
};
