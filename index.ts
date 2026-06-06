// supabase/functions/create-user/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) throw new Error('Token inválido.');

    // Busca perfil completo do chamador
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_master')
      .eq('id', user.id)
      .single();

    const isAdmin  = callerProfile?.role === 'admin';
    const isMaster = callerProfile?.is_master === true;

    const body   = await req.json();
    const { action } = body;

    // ── CRIAR USUÁRIO (admin only) ─────────────
    if (!action || action === 'create') {
      if (!isAdmin) throw new Error('Apenas admins podem criar usuários.');
      const { email, password, nome, role, vendedora_id } = body;
      if (!email || !password) throw new Error('E-mail e senha são obrigatórios.');

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { nome, role: role || 'vendedora' }
      });
      if (createErr) throw createErr;

      const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
        id: newUser.user.id,
        nome,
        role: role || 'vendedora',
        vendedora_id: vendedora_id || null,
        is_master: false
      });
      if (profErr) throw profErr;

      return new Response(
        JSON.stringify({ success: true, userId: newUser.user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── LISTAR USUÁRIOS COM E-MAIL (admin only) ─
    if (action === 'list_users') {
      if (!isAdmin) throw new Error('Apenas admins podem listar usuários.');

      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;

      // Busca todos os profiles
      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');

      // Mescla auth users + profiles
      const result = users.map(u => {
        const p = profiles?.find(p => p.id === u.id);
        return {
          id:          u.id,
          email:       u.email,
          nome:        p?.nome || '',
          role:        p?.role || 'vendedora',
          is_master:   p?.is_master || false,
          created_at:  u.created_at,
          last_sign_in: u.last_sign_in_at
        };
      });

      return new Response(
        JSON.stringify({ success: true, users: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ALTERAR E-MAIL ─────────────────────────
    if (action === 'update_email') {
      const { userId, email } = body;
      if (!email) throw new Error('E-mail obrigatório.');

      // Verificar se alvo é master — só master pode alterar master
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('is_master, role').eq('id', userId).single();

      if (targetProfile?.is_master && !isMaster)
        throw new Error('Apenas o admin master pode alterar seus próprios dados.');

      if (targetProfile?.role === 'admin' && !isMaster && userId !== user.id)
        throw new Error('Apenas o admin master pode alterar dados de outros admins.');

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ALTERAR SENHA (admin altera de qualquer user) ─
    if (action === 'update_password') {
      const { userId, password } = body;
      if (!password || password.length < 6) throw new Error('Senha inválida.');

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('is_master, role').eq('id', userId).single();

      if (targetProfile?.is_master && !isMaster)
        throw new Error('Apenas o admin master pode alterar sua própria senha.');

      if (targetProfile?.role === 'admin' && !isMaster && userId !== user.id)
        throw new Error('Apenas o admin master pode alterar senha de outros admins.');

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── DELETAR USUÁRIO (master only para admins) ─
    if (action === 'delete') {
      if (!isAdmin) throw new Error('Apenas admins podem remover usuários.');
      const { userId } = body;

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('is_master, role').eq('id', userId).single();

      if (targetProfile?.is_master)
        throw new Error('O admin master não pode ser removido.');

      if (targetProfile?.role === 'admin' && !isMaster)
        throw new Error('Apenas o admin master pode remover outros admins.');

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Ação inválida.');

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
