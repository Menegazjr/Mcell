-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Snapshot de Distribuição
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Guarda o resultado do cálculo de distribuição "congelado"
-- Só é atualizado quando o admin clica em "Recalcular"
CREATE TABLE IF NOT EXISTS metas_snapshot (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano           INTEGER NOT NULL CHECK (ano > 2000),
  vendedora_id  UUID REFERENCES vendedoras(id) ON DELETE CASCADE,
  meta_aparelhos NUMERIC(8,2) NOT NULL,
  is_manual     BOOLEAN DEFAULT FALSE,
  is_extra      BOOLEAN DEFAULT FALSE,
  calculado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mes, ano, vendedora_id)
);

ALTER TABLE metas_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_snap_select" ON metas_snapshot
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "metas_snap_insert" ON metas_snapshot
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "metas_snap_update" ON metas_snapshot
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "metas_snap_delete" ON metas_snapshot
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
