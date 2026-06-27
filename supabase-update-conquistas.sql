-- ═══════════════════════════════════════════════
-- MCELL — SISTEMA DE CONQUISTAS
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Catálogo fixo de conquistas (não muda por usuário)
CREATE TABLE IF NOT EXISTS conquistas (
  id          TEXT PRIMARY KEY,        -- ex: 'primeira_venda'
  nome        TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  icone       TEXT NOT NULL,           -- emoji
  pontos      INTEGER NOT NULL DEFAULT 0,
  categoria   TEXT NOT NULL,           -- 'volume', 'meta', 'recorde'
  criterio    JSONB NOT NULL,          -- regra de desbloqueio
  ordem       INTEGER DEFAULT 0
);

-- Quem desbloqueou o quê
CREATE TABLE IF NOT EXISTS conquistas_usuario (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedora_id  UUID REFERENCES vendedoras(id) ON DELETE CASCADE,
  conquista_id  TEXT REFERENCES conquistas(id) ON DELETE CASCADE,
  desbloqueado_em TIMESTAMPTZ DEFAULT NOW(),
  visto         BOOLEAN DEFAULT FALSE,  -- se já viu a animação
  UNIQUE(vendedora_id, conquista_id)
);

ALTER TABLE conquistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conquistas_usuario ENABLE ROW LEVEL SECURITY;

-- Catálogo: todos podem ler
CREATE POLICY "conquistas_select" ON conquistas
  FOR SELECT TO authenticated USING (true);

-- Conquistas do usuário: admin vê tudo, vendedora vê só as suas
CREATE POLICY "conquistas_usuario_select" ON conquistas_usuario
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  );

-- Inserção: sistema insere via authenticated (qualquer usuário logado pode desbloquear pra si)
CREATE POLICY "conquistas_usuario_insert" ON conquistas_usuario
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  );

CREATE POLICY "conquistas_usuario_update" ON conquistas_usuario
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR vendedora_id = get_my_vendedora_id()
  );

-- ═══════════════════════════════════════════════
-- CATÁLOGO DE CONQUISTAS (10 conquistas)
-- ═══════════════════════════════════════════════
INSERT INTO conquistas (id, nome, descricao, icone, pontos, categoria, criterio, ordem) VALUES
('primeira_venda', 'Primeira Venda', 'Registrou sua primeira venda', '🥉', 10, 'volume',
  '{"tipo":"total_aparelhos","valor":1}', 1),

('veterano_50', 'Veterano', 'Vendeu 50 aparelhos no total', '🥈', 30, 'volume',
  '{"tipo":"total_aparelhos","valor":50}', 2),

('centenario_200', 'Centenário', 'Vendeu 200 aparelhos no total', '🥇', 60, 'volume',
  '{"tipo":"total_aparelhos","valor":200}', 3),

('mestre_500', 'Mestre das Vendas', 'Vendeu 500 aparelhos no total', '💎', 120, 'volume',
  '{"tipo":"total_aparelhos","valor":500}', 4),

('lenda_1000', 'Lenda Mcell', 'Vendeu 1.000 aparelhos no total', '👑', 250, 'volume',
  '{"tipo":"total_aparelhos","valor":1000}', 5),

('primeira_meta', 'Primeira Meta', 'Bateu a meta mensal pela primeira vez', '🎯', 20, 'meta',
  '{"tipo":"metas_batidas","valor":1}', 6),

('tripla_coroa', 'Tripla Coroa', 'Bateu a meta mensal em 3 meses', '🎯', 50, 'meta',
  '{"tipo":"metas_batidas","valor":3}', 7),

('veterana_metas', 'Veterana de Metas', 'Bateu a meta mensal em 6 meses', '🏆', 100, 'meta',
  '{"tipo":"metas_batidas","valor":6}', 8),

('dia_insano', 'Dia Insano', 'Vendeu 6 ou mais aparelhos em um único dia', '🔥', 40, 'recorde',
  '{"tipo":"max_dia","valor":6}', 9),

('acima_da_meta', 'Acima da Meta', 'Bateu uma meta mensal com 150% ou mais', '⭐', 40, 'recorde',
  '{"tipo":"pct_meta","valor":150}', 10)

ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  pontos = EXCLUDED.pontos,
  categoria = EXCLUDED.categoria,
  criterio = EXCLUDED.criterio,
  ordem = EXCLUDED.ordem;
