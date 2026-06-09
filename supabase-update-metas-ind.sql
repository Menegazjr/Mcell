-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Metas Individuais
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS metas_individuais (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano           INTEGER NOT NULL CHECK (ano > 2000),
  vendedora_id  UUID REFERENCES vendedoras(id) ON DELETE CASCADE,
  meta_aparelhos NUMERIC(8,2) NOT NULL,
  is_manual     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mes, ano, vendedora_id)
);

ALTER TABLE metas_individuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_ind_select" ON metas_individuais
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "metas_ind_insert" ON metas_individuais
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "metas_ind_update" ON metas_individuais
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "metas_ind_delete" ON metas_individuais
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
