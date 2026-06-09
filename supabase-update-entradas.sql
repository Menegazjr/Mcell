-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Múltiplas entradas
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Nova coluna para múltiplas entradas (JSON array)
-- Formato: [{"modelo":"iPhone 13","valor":1200}, ...]
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS entradas JSONB DEFAULT '[]'::jsonb;

-- Migrar dados antigos para o novo formato
UPDATE vendas
SET entradas = jsonb_build_array(
  jsonb_build_object('modelo', aparelho_entrada, 'valor', COALESCE(valor_entrada, 0))
)
WHERE aparelho_entrada IS NOT NULL AND aparelho_entrada != '';
