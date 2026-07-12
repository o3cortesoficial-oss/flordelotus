export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const path = pathname.toLowerCase();

  // Rodar a verificação de antibot apenas na página de vendas principal e checkout
  if (path === '/' || path === '/index.html' || path.includes('finalizar') || path.includes('compra')) {
    
    // 1. Permitir bypass via parâmetro ?bypass=1 ou cookies
    const hasBypassParam = url.searchParams.get('bypass') === '1';
    const cookieHeader = request.headers.get('cookie') || '';
    const hasBypassCookie = cookieHeader.includes('creamy_bypass=true');

    if (hasBypassParam || hasBypassCookie) {
      // Se tiver parâmetro de bypass, precisamos definir o cookie na resposta e recarregar
      if (hasBypassParam) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': url.origin + pathname,
            'Set-Cookie': 'creamy_bypass=true; Path=/; Max-Age=2592000; Secure; SameSite=Lax'
          }
        });
      }
      return;
    }

    // 2. Buscar configurações do Cloaker diretamente do Supabase REST API
    const SUPABASE_URL = "https://nlawvbnenzyjknmsqlwa.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYXd2Ym5lbnp5amtubXNxbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjg3NTcsImV4cCI6MjA5MTg0NDc1N30.gEr2isb_ibqpFQBXpPDcqai0_szbE3bucOt-oiqv0Uo";
    
    let cloaker = null;
    try {
      const configRes = await fetch(`${SUPABASE_URL}/rest/v1/creamy_cloaker_config?id=eq.1`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (configRes.ok) {
        const data = await configRes.json();
        if (data && data.length > 0) {
          cloaker = data[0];
        }
      }
    } catch (err) {
      console.error("[Middleware] Erro ao buscar config do Cloaker no Supabase:", err);
    }

    // Se o cloaker não estiver ativado ou falhar a busca, liberamos o tráfego normal
    if (!cloaker || !cloaker.enabled) {
      return;
    }

    // 3. Filtro de Bots via User-Agent Heuristics
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-real-ip') || '';
    const country = request.headers.get('x-vercel-ip-country') || '';
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    let blockThisAccess = false;
    let blockReason = "";
    let botType = "other_block";

    // Classificação de Bots
    const ua = userAgent.toLowerCase();
    let isBot = false;

    if (ua.includes("facebookexternalhit") || ua.includes("facebot") || ua.includes("meta-externalagent") || ua.includes("facebook")) {
      botType = "meta";
      isBot = true;
    } else if (ua.includes("googlebot") || ua.includes("adsbot") || ua.includes("google-keyword") || ua.includes("mediapartners")) {
      botType = "google";
      isBot = true;
    } else if (ua.includes("tiktokbot") || ua.includes("bytedance")) {
      botType = "tiktok";
      isBot = true;
    } else {
      const botPatterns = [
        'crawler', 'spider', 'lighthouse', 'chrome-lighthouse', 'twitterbot', 
        'bingbot', 'yandexbot', 'semrushbot', 'ahrefsbot', 'pingdom', 'adcheck', 'bot'
      ];
      if (botPatterns.some(pattern => ua.includes(pattern))) {
        botType = "other";
        isBot = true;
      }
    }

    // 4. Aplicar regras de bloqueio de Bots
    if (isBot) {
      if (botType === "meta" && cloaker.block_meta !== false) {
        blockThisAccess = true;
        blockReason = "Bot Meta/Facebook Detectado";
      } else if (botType === "google" && cloaker.block_google !== false) {
        blockThisAccess = true;
        blockReason = "Bot Google Detectado";
      } else if (botType === "tiktok" && cloaker.block_tiktok !== false) {
        blockThisAccess = true;
        blockReason = "Bot TikTok Detectado";
      } else if (botType === "other") {
        blockThisAccess = true;
        blockReason = "Bot Genérico Detectado";
      }
    }

    // 5. Aplicar regras de bloqueio de Dispositivo
    if (!blockThisAccess) {
      if (isMobile && cloaker.block_mobile) {
        blockThisAccess = true;
        blockReason = "Dispositivo Móvel Bloqueado";
      } else if (!isMobile && cloaker.block_desktop) {
        blockThisAccess = true;
        blockReason = "Dispositivo Desktop Bloqueado";
      }
    }

    // 6. Aplicar blacklist de IPs
    if (!blockThisAccess && cloaker.blacklist_ips) {
      const blacklist = cloaker.blacklist_ips.split(/[\s,]+/).map(item => item.trim()).filter(item => item.length > 0);
      if (blacklist.includes(ip)) {
        blockThisAccess = true;
        blockReason = "IP em Blacklist Personalizada";
      }
    }

    // 7. Aplicar Geofiltro de país
    if (!blockThisAccess && cloaker.geofilter === "brazil") {
      const host = request.headers.get('host') || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      if (country && country !== 'BR' && !isLocalhost) {
        blockThisAccess = true;
        blockReason = `IP Estrangeiro Detectado (${country})`;
      }
    }

    // 8. Bloqueio de VPN / Hosting
    if (!blockThisAccess && cloaker.block_vpn === "yes") {
      // Chamada rápida com timeout curto para checar VPN
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 350);
      try {
        const ipRes = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          const org = (ipData.org || "").toLowerCase();
          const isHosting = org.includes("amazon") || org.includes("google") || org.includes("digitalocean") || 
                            org.includes("linode") || org.includes("ovh") || org.includes("hetzner") || 
                            org.includes("microsoft") || org.includes("m247") || org.includes("cloudflare") ||
                            org.includes("hosting") || org.includes("vps") || org.includes("servers");
          if (isHosting) {
            blockThisAccess = true;
            blockReason = `Hosting/VPN Detectado (ISP: ${ipData.org})`;
          }
        }
      } catch (err) {
        // Ignora timeout
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // 9. Tratar o bloqueio ou liberação
    if (blockThisAccess) {
      // Enviar log de bloqueio assincronamente para o Supabase
      const logId = Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      fetch(`${SUPABASE_URL}/rest/v1/creamy_cloaker_logs`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          id: logId,
          timestamp: new Date().toISOString(),
          allowed: false,
          reason: blockReason,
          ip: ip || "Desconhecido",
          location: country || "Desconhecido",
          user_agent: userAgent,
          redirect_url: cloaker.safe_url
        })
      }).catch(() => {});

      // Incrementar estatística de bot via RPC
      let columnName = "other";
      if (botType === "meta") columnName = "meta";
      else if (botType === "google") columnName = "google";
      else if (botType === "tiktok") columnName = "tiktok";
      
      fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_stat`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ column_name: columnName })
      }).catch(() => {});

      console.warn(`[Middleware] BLOQUEADO: ${blockReason}. Servindo Safe Page in-place.`);
      
      // Serve a Safe Page in-place
      const safePageUrl = new URL(cloaker.safe_url || '/artigo-skincare-cuidados.html', request.url);
      return fetch(safePageUrl);
    } else {
      // Incrementar estatística de real (somente se não for bot/vpn check)
      if (!isBot) {
        fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_stat`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ column_name: "real" })
        }).catch(() => {});
      }
    }
  }
}
