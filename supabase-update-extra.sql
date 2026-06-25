-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Vendedor Extra
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Marca um vendedor como "extra" — não entra no cálculo de metas
ALTER TABLE vendedoras ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE;
