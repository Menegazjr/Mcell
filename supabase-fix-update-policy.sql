-- ═══════════════════════════════════════════════
-- MCELL — CORREÇÃO: Política de UPDATE em vendas
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Verificar se existe política de update
-- Se não existir, criar:
DROP POLICY IF EXISTS "vendas_update" ON vendas;

CREATE POLICY "vendas_update" ON vendas
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  );
