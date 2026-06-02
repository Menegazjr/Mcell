-- ═══════════════════════════════════════════════
-- MCELL — SUPABASE DATABASE SETUP
-- Execute no SQL Editor do seu projeto Supabase
-- ═══════════════════════════════════════════════

-- 1. HABILITAR RLS (Row Level Security)
-- (ativado por padrão no Supabase)

-- ═══════════════════════════════════════════════
-- TABELA: vendedoras
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendedoras (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT NOT NULL,
  telefone      TEXT,
  data_admissao DATE,
  status        TEXT DEFAULT 'ativa' CHECK (status IN ('ativa','inativa')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- TABELA: vendas
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendas (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedora_id   UUID REFERENCES vendedoras(id) ON DELETE SET NULL,
  data_venda     DATE NOT NULL DEFAULT CURRENT_DATE,
  modelo_iphone  TEXT NOT NULL,
  valor          NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  quantidade     INTEGER DEFAULT 1 CHECK (quantidade > 0),
  observacoes    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- TABELA: metas
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS metas (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes               INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano               INTEGER NOT NULL CHECK (ano > 2000),
  meta_faturamento  NUMERIC(14,2) DEFAULT 0,
  meta_aparelhos    INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mes, ano)
);

-- ═══════════════════════════════════════════════
-- TABELA: profiles (vincula auth.users a roles)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome           TEXT,
  role           TEXT DEFAULT 'vendedora' CHECK (role IN ('admin','vendedora')),
  vendedora_id   UUID REFERENCES vendedoras(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_vendas_data       ON vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedora  ON vendas(vendedora_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data_vend  ON vendas(data_venda, vendedora_id);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════

ALTER TABLE vendedoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper to get current user's vendedora_id
CREATE OR REPLACE FUNCTION get_my_vendedora_id()
RETURNS UUID AS $$
  SELECT vendedora_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── VENDEDORAS POLICIES ──────────────────────────
-- Todos autenticados podem ler
CREATE POLICY "vendedoras_select" ON vendedoras
  FOR SELECT TO authenticated USING (true);

-- Apenas admin pode inserir/atualizar/excluir
CREATE POLICY "vendedoras_insert" ON vendedoras
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "vendedoras_update" ON vendedoras
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "vendedoras_delete" ON vendedoras
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── VENDAS POLICIES ──────────────────────────────
-- Admin vê tudo; vendedora vê apenas as suas
CREATE POLICY "vendas_select" ON vendas
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  );

-- Vendedora pode inserir suas próprias vendas; admin pode tudo
CREATE POLICY "vendas_insert" ON vendas
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  );

-- Apenas admin pode excluir
CREATE POLICY "vendas_delete" ON vendas
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── METAS POLICIES ───────────────────────────────
CREATE POLICY "metas_select" ON metas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "metas_insert" ON metas
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "metas_update" ON metas
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "metas_delete" ON metas
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── PROFILES POLICIES ────────────────────────────
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'admin');

-- ═══════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGN UP
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedora')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════
-- DADOS DE EXEMPLO (opcional — remova se quiser)
-- ═══════════════════════════════════════════════

-- Descomente para inserir dados de teste:
/*
INSERT INTO vendedoras (nome, telefone, data_admissao, status) VALUES
  ('Ana Lima',    '(11) 91234-5678', '2024-01-15', 'ativa'),
  ('Bruna Silva', '(11) 98765-4321', '2024-03-01', 'ativa'),
  ('Carol Souza', '(11) 93333-2222', '2023-07-10', 'ativa');

INSERT INTO metas (mes, ano, meta_faturamento, meta_aparelhos) VALUES
  (6, 2026, 140000.00, 140),
  (5, 2026, 130000.00, 130),
  (4, 2026, 120000.00, 120);
*/

-- ═══════════════════════════════════════════════
-- PARA CRIAR PRIMEIRO ADMIN:
-- 1. Cadastre-se normalmente pelo sistema
-- 2. Execute:
--
-- UPDATE profiles SET role = 'admin'
-- WHERE id = 'SEU_USER_ID_AQUI';
--
-- O user ID aparece em Authentication > Users no Supabase
-- ═══════════════════════════════════════════════

-- ═══════════════════════════════════════════════
-- CONFIGURAÇÃO PARA PRIMEIRO ACESSO
-- ═══════════════════════════════════════════════

-- Permitir que qualquer usuário autenticado LEIA
-- a contagem de admins (necessário para detectar primeiro acesso)
-- A policy "profiles_select" já cobre isso.

-- Permitir que o próprio usuário insira seu profile
-- (necessário quando o trigger não é suficiente no signup imediato)
CREATE POLICY IF NOT EXISTS "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- IMPORTANTE: No Supabase, desative a confirmação de e-mail
-- para o primeiro acesso funcionar sem verificação:
-- Authentication → Settings → "Enable email confirmations" = OFF
-- (Pode reativar depois se quiser)
