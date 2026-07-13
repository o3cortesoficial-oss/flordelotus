const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nlawvbnenzyjknmsqlwa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYXd2Ym5lbnp5amtubXNxbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjg3NTcsImV4cCI6MjA5MTg0NDc1N30.gEr2isb_ibqpFQBXpPDcqai0_szbE3bucOt-oiqv0Uo';

function humanContext(request) {
  const ua = String(request?.headers?.['user-agent'] || '').toLowerCase();
  const isBot = /bot|crawler|spider|lighthouse|headless|facebookexternalhit|googlebot|adsbot|bingbot|tiktokbot/.test(ua);
  if (isBot) return null;
  const lat = Number(request?.headers?.['x-vercel-ip-latitude']);
  const lng = Number(request?.headers?.['x-vercel-ip-longitude']);
  return {
    human: true,
    ...(Number.isFinite(lat) && Number.isFinite(lng) && lat && lng ? {
      geo_lat: lat,
      geo_lng: lng,
      geo_city: decodeURIComponent(String(request.headers['x-vercel-ip-city'] || '')),
    } : {}),
  };
}

export async function recordFunnelStage({ request, stage, detail, value = 0 }) {
  const context = humanContext(request);
  if (!context) return false;
  const result = await fetch(`${SUPABASE_URL}/rest/v1/creamy_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: `funnel_${stage}`,
      detail,
      value,
      utm: context,
    }),
  });

  if (!result.ok) throw new Error(`Falha ao registrar checkout (${result.status})`);
  return true;
}

export async function recordCheckoutActivation({ request, quantity, total }) {
  return recordFunnelStage({ request, stage: 'cart', detail: `Sacola ativada - ${quantity}x Kit Firmador`, value: total / 100 });
}
import { randomUUID } from 'node:crypto';
