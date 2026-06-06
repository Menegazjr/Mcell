-- ═══════════════════════════════════════════════
-- MCELL — ATUALIZAÇÃO: Admin Master
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Adiciona campo is_master na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;

-- Define SEU usuário como admin master
-- (substitua pelo seu UUID — veja em Authentication > Users)
-- UPDATE profiles SET is_master = TRUE WHERE id = 'SEU_UUID_AQUI';

-- Ou para definir o primeiro admin criado como master:
UPDATE profiles SET is_master = TRUE
WHERE role = 'admin'
AND created_at = (SELECT MIN(created_at) FROM profiles WHERE role = 'admin');
