const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nlawvbnenzyjknmsqlwa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYXd2Ym5lbnp5amtubXNxbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjg3NTcsImV4cCI6MjA5MTg0NDc1N30.gEr2isb_ibqpFQBXpPDcqai0_szbE3bucOt-oiqv0Uo';

async function credentials() {
  if (process.env.WESTPAY_API_KEY && process.env.WESTPAY_PUBLIC_KEY) {
    return { apiKey: process.env.WESTPAY_API_KEY, publicKey: process.env.WESTPAY_PUBLIC_KEY };
  }
  const result = await fetch(`${SUPABASE_URL}/rest/v1/creamy_gateway_config?id=eq.1&provider=eq.westpay&select=client_id,client_secret`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!result.ok) return null;
  const row = (await result.json())[0];
  return row?.client_id && row?.client_secret ? { apiKey: row.client_id, publicKey: row.client_secret } : null;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método não permitido' });
  try {
    const config = await credentials();
    if (!config) return response.status(200).json({ provider: 'westpay', status: 'missing' });
    const auth = Buffer.from(`${config.apiKey}:${config.publicKey}`).toString('base64');
    const validation = await fetch('https://api.gw.westpay.com.br/api/v1/balance', {
      headers: { Authorization: `Basic ${auth}`, 'User-Agent': 'OfertaCreamy/1.0' },
    });
    return response.status(200).json({ provider: 'westpay', status: validation.ok ? 'connected' : 'invalid' });
  } catch (error) {
    console.error('Erro ao validar gateway:', error);
    return response.status(200).json({ provider: 'westpay', status: 'unavailable' });
  }
}
