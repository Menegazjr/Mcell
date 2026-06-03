// ═══════════════════════════════════════════════
// MCELL — SUPABASE CONFIG
// Substitua com suas credenciais do Supabase!
// ═══════════════════════════════════════════════

const SUPABASE_URL = 'https://myflalkmbhdfgailoejc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ImmEaR63chN5SrpvFeuXUw_VIybjhjt';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── HELPERS ───────────────────────────────────
const db = {
  // Vendedoras
  async getVendedoras(apenasAtivas = false) {
    let q = _supabase.from('vendedoras').select('*').order('nome');
    if (apenasAtivas) q = q.eq('status', 'ativa');
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async upsertVendedora(v) {
    const { data, error } = await _supabase.from('vendedoras').upsert(v).select().single();
    if (error) throw error;
    return data;
  },
  async deleteVendedora(id) {
    const { error } = await _supabase.from('vendedoras').delete().eq('id', id);
    if (error) throw error;
  },

  // Vendas
  async getVendas({ mes, ano, vendedora_id, data_inicio, data_fim } = {}) {
    let q = _supabase
      .from('vendas')
      .select('*, vendedoras(nome)')
      .order('data_venda', { ascending: false });

    if (vendedora_id) q = q.eq('vendedora_id', vendedora_id);

    if (data_inicio && data_fim) {
      q = q.gte('data_venda', data_inicio).lte('data_venda', data_fim);
    } else if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2,'0')}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const end   = `${ano}-${String(mes).padStart(2,'0')}-${lastDay}`;
      q = q.gte('data_venda', start).lte('data_venda', end);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async insertVenda(v) {
    const { data, error } = await _supabase.from('vendas').insert(v).select().single();
    if (error) throw error;
    return data;
  },
  async deleteVenda(id) {
    const { error } = await _supabase.from('vendas').delete().eq('id', id);
    if (error) throw error;
  },

  // Metas
  async getMeta(mes, ano) {
    const { data, error } = await _supabase
      .from('metas')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async upsertMeta(m) {
    const { data, error } = await _supabase.from('metas').upsert(m, { onConflict: 'mes,ano' }).select().single();
    if (error) throw error;
    return data;
  },
  async getAllMetas() {
    const { data, error } = await _supabase.from('metas').select('*').order('ano').order('mes');
    if (error) throw error;
    return data || [];
  },

  // Profiles
  async getProfile(userId) {
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async getAllProfiles() {
    const { data, error } = await _supabase.from('profiles').select('*');
    if (error) throw error;
    return data || [];
  }
};

// ── UTILS ─────────────────────────────────────
function fmt(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}
function fmtNum(n) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}
function mesToNome(mes) {
  return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes-1];
}
function mesToNomeCompleto(mes) {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
          'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][mes-1];
}
function pct(valor, meta) {
  if (!meta || meta === 0) return 0;
  return Math.min(Math.round((valor / meta) * 100), 100);
}
function progressColor(p) {
  if (p >= 100) return '#22c55e';
  if (p >= 70)  return '#3d7eff';
  if (p >= 40)  return '#f59e0b';
  return '#ef4444';
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Current period (global)
let currentMes = new Date().getMonth() + 1;
let currentAno = new Date().getFullYear();
