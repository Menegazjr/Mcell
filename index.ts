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

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_master')
      .eq('id', user.id)
      .single();

    const isAdminCaller = callerProfile?.role === 'admin';
    const isMaster      = callerProfile?.is_master === true;

    const body = await req.json();
    const { action } = body;

    // ── CRIAR USUÁRIO ──────────────────────────
    if (!action || action === 'create') {
      if (!isAdminCaller) throw new Error('Apenas admins podem criar usuários.');
      const { email, password, nome, role, vendedora_id } = body;
      if (!email || !password) throw new Error('E-mail e senha são obrigatórios.');

      // Verificar se e-mail já existe (mesmo deletado — Supabase mantém em soft delete)
      const { data: { users: existing } } = await supabaseAdmin.auth.admin.listUsers();
      const emailJaExiste = existing?.find(u =>
        u.email?.toLowerCase() === email.toLowerCase()
      );

      if (emailJaExiste) {
        // Se existe mas foi deletado (sem confirmed_at recente), reutiliza o ID
        // Atualiza senha e reativa
        await supabaseAdmin.auth.admin.updateUserById(emailJaExiste.id, {
          password,
          email_confirm: true,
          ban_duration: 'none' // remove qualquer ban
        });
        await supabaseAdmin.from('profiles').upsert({
          id:          emailJaExiste.id,
          nome,
          role:        role || 'vendedora',
          vendedora_id: vendedora_id || null,
          is_master:   false
        });
        return new Response(
          JSON.stringify({ success: true, userId: emailJaExiste.id, reactivated: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar novo usuário
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { nome, role: role || 'vendedora' }
      });
      if (createErr) throw createErr;

      await supabaseAdmin.from('profiles').upsert({
        id:          newUser.user.id,
        nome,
        role:        role || 'vendedora',
        vendedora_id: vendedora_id || null,
        is_master:   false
      });

      return new Response(
        JSON.stringify({ success: true, userId: newUser.user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── LISTAR USUÁRIOS ────────────────────────
    if (action === 'list_users') {
      if (!isAdminCaller) throw new Error('Apenas admins podem listar usuários.');

      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;

      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');

      const result = users.map(u => {
        const p = profiles?.find(p => p.id === u.id);
        return {
          id:           u.id,
          email:        u.email,
          nome:         p?.nome || '',
          role:         p?.role || 'vendedora',
          is_master:    p?.is_master || false,
          vendedora_id: p?.vendedora_id || null,
          created_at:   u.created_at,
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

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('is_master, role').eq('id', userId).single();

      if (targetProfile?.is_master && !isMaster)
        throw new Error('Apenas o admin master pode alterar esses dados.');
      if (targetProfile?.role === 'admin' && !isMaster && userId !== user.id)
        throw new Error('Apenas o admin master pode alterar dados de outros admins.');

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ALTERAR SENHA ──────────────────────────
    if (action === 'update_password') {
      const { userId, password } = body;
      if (!password || password.length < 6) throw new Error('Senha inválida.');

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('is_master, role').eq('id', userId).single();

      if (targetProfile?.is_master && !isMaster)
        throw new Error('Apenas o admin master pode alterar essa senha.');
      if (targetProfile?.role === 'admin' && !isMaster && userId !== user.id)
        throw new Error('Apenas o admin master pode alterar senha de outros admins.');

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── DELETAR USUÁRIO ────────────────────────
    if (action === 'delete') {
      if (!isAdminCaller) throw new Error('Apenas admins podem remover usuários.');
      const { userId } = body;

      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('is_master, role').eq('id', userId).single();

      if (targetProfile?.is_master)
        throw new Error('O admin master não pode ser removido.');
      if (targetProfile?.role === 'admin' && !isMaster)
        throw new Error('Apenas o admin master pode remover outros admins.');

      // 1. Remove o profile primeiro (evita orphan)
      await supabaseAdmin.from('profiles').delete().eq('id', userId);

      // 2. Remove o usuário do auth
      // shouldSoftDelete: false garante remoção definitiva e libera o e-mail
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
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
