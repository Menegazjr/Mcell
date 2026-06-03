// supabase/functions/create-user/index.ts
// Edge Function para criar usuários sem expor a service_key no frontend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verifica que quem chamou é um admin autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado.');

    // Cliente com a service_role key (disponível automaticamente no Edge)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Valida o token do usuário chamador
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) throw new Error('Token inválido.');

    // Verifica se o chamador é admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') throw new Error('Apenas admins podem criar usuários.');

    // Lê os dados do body
    const { email, password, nome, role, vendedora_id } = await req.json();
    if (!email || !password) throw new Error('E-mail e senha são obrigatórios.');

    // Cria o usuário
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // já confirma automaticamente
      user_metadata: { nome, role: role || 'vendedora' }
    });
    if (createErr) throw createErr;

    // Cria/atualiza o profile
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      nome,
      role: role || 'vendedora',
      vendedora_id: vendedora_id || null
    });
    if (profErr) throw profErr;

    return new Response(
      JSON.stringify({ success: true, userId: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
