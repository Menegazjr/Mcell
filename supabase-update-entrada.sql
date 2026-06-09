-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Aparelho de Entrada + Valor
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS aparelho_entrada TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_entrada NUMERIC(12,2) DEFAULT 0;
