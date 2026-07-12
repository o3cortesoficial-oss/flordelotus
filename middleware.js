export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Rodar a verificação de antibot apenas na página de vendas principal
  if (pathname === '/' || pathname === '/index.html') {
    
    // 1. Permitir bypass via parâmetro ?bypass=1 ou cookies
    const hasBypassParam = url.searchParams.get('bypass') === '1';
    
    // Ler cookie creamy_bypass da requisição manual
    const cookieHeader = request.headers.get('cookie') || '';
    const hasBypassCookie = cookieHeader.includes('creamy_bypass=true');

    if (hasBypassParam || hasBypassCookie) {
      // Se tiver parâmetro de bypass, precisamos definir o cookie na resposta e recarregar
      if (hasBypassParam) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': url.origin + '/',
            'Set-Cookie': 'creamy_bypass=true; Path=/; Max-Age=2592000; Secure; SameSite=Lax'
          }
        });
      }
      // Se já tiver o cookie de bypass, simplesmente não retorna nada para continuar a requisição
      return;
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
      console.warn("[Middleware] Bot detectado. Servindo Safe Page in-place.");
      const safeUrl = new URL('/artigo-skincare-cuidados.html', request.url);
      return fetch(safeUrl);
    }

    // 3. Filtro Geográfico Nativo da Vercel Edge Network
    // Serve a Safe Page in-place para tráfego de fora do Brasil
    const country = request.headers.get('x-vercel-ip-country') || '';
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    if (country && country !== 'BR' && !isLocalhost) {
      console.warn("[Middleware] IP Estrangeiro detectado (" + country + "). Servindo Safe Page in-place.");
      const safeUrl = new URL('/artigo-skincare-cuidados.html', request.url);
      return fetch(safeUrl);
    }
  }

  // Não retornando nada, a Vercel continua a requisição normalmente servindo a página
}
