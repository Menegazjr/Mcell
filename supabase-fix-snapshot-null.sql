-- ═══════════════════════════════════════════════
-- MCELL — CORREÇÃO: meta_aparelhos pode ser NULL
-- (vendedores extras não têm meta)
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

ALTER TABLE metas_snapshot ALTER COLUMN meta_aparelhos DROP NOT NULL;
