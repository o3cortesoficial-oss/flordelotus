const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nlawvbnenzyjknmsqlwa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5sYXd2Ym5lbnp5amtubXNxbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjg3NTcsImV4cCI6MjA5MTg0NDc1N30.gEr2isb_ibqpFQBXpPDcqai0_szbE3bucOt-oiqv0Uo';

export async function recordCheckoutActivation({ quantity, total }) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/creamy_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'checkout',
      detail: `Checkout ativado - ${quantity}x Kit Firmador`,
      value: total / 100,
    }),
  });

  if (!result.ok) throw new Error(`Falha ao registrar checkout (${result.status})`);
}
