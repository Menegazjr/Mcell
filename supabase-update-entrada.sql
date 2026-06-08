-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Aparelho de Entrada
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS aparelho_entrada TEXT;
