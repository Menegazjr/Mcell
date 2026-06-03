// ═══════════════════════════════════════════════
// MCELL — USO DO BANCO (Admin only)
// Plano Free Supabase: 500 MB banco + 1 GB storage
// ═══════════════════════════════════════════════

async function renderBanco() {
  if (!isAdmin()) {
    document.getElementById('page-banco').innerHTML =
      `<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito.</p></div>`;
    return;
  }

  const page = document.getElementById('page-banco');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    // Contar registros de cada tabela
    const [
      { count: totalVendas },
      { count: totalVendedoras },
      { count: totalMetas },
      { count: totalProfiles }
    ] = await Promise.all([
      _supabase.from('vendas').select('*', { count: 'exact', head: true }),
      _supabase.from('vendedoras').select('*', { count: 'exact', head: true }),
      _supabase.from('metas').select('*', { count: 'exact', head: true }),
      _supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    // Estimar tamanho: cada venda ~300 bytes, vendedora ~200 bytes, meta ~150 bytes
    const bytesVendas     = (totalVendas     || 0) * 300;
    const bytesVendedoras = (totalVendedoras || 0) * 200;
    const bytesMetas      = (totalMetas      || 0) * 150;
    const bytesProfiles   = (totalProfiles   || 0) * 150;
    const totalBytes      = bytesVendas + bytesVendedoras + bytesMetas + bytesProfiles;

    // Limite free: 500 MB = 524288000 bytes
    const LIMITE_MB  = 500;
    const LIMITE_B   = LIMITE_MB * 1024 * 1024;
    const usadoMB    = totalBytes / (1024 * 1024);
    const pctUsado   = Math.min((totalBytes / LIMITE_B) * 100, 100);
    const livreMB    = LIMITE_MB - usadoMB;

    // Projeção: quantos meses até lotar baseado no crescimento atual
    const bytesPerVenda = 300;
    // Pega vendas dos últimos 30 dias para estimar ritmo
    const hoje = new Date();
    const ha30 = new Date(hoje); ha30.setDate(ha30.getDate() - 30);
    const { count: vendasRecentes } = await _supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', ha30.toISOString());

    const crescMensalBytes = (vendasRecentes || 0) * bytesPerVenda;
    const mesesRestantes = crescMensalBytes > 0
      ? Math.floor((LIMITE_B - totalBytes) / crescMensalBytes)
      : null;

    // Cor do alerta
    const cor = pctUsado >= 80 ? 'var(--red)' : pctUsado >= 50 ? 'var(--yellow)' : 'var(--green)';
    const statusLabel = pctUsado >= 80 ? '⚠️ Atenção!' : pctUsado >= 50 ? '📊 Moderado' : '✅ Tranquilo';

    page.innerHTML = `
      <!-- HEADER -->
      <div class="panel" style="margin-bottom:20px;border-color:${cor}40">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div>
            <div class="panel-title" style="font-size:1rem">◧ Uso do Banco de Dados</div>
            <div style="font-size:0.8rem;color:var(--text2);margin-top:2px">Plano Free Supabase · Limite: 500 MB</div>
          </div>
          <span class="badge" style="background:${cor}20;color:${cor};border:1px solid ${cor}40;font-size:0.82rem;padding:6px 14px">
            ${statusLabel}
          </span>
        </div>

        <!-- BARRA PRINCIPAL -->
        <div style="margin-bottom:8px;display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text2)">
          <span>Espaço utilizado</span>
          <span style="color:var(--text);font-weight:600">${fmtMB(usadoMB)} de ${LIMITE_MB} MB</span>
        </div>
        <div style="height:24px;background:var(--bg3);border-radius:99px;overflow:hidden;border:1px solid var(--border);margin-bottom:8px">
          <div style="height:100%;width:${pctUsado.toFixed(2)}%;background:${cor};border-radius:99px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;min-width:40px;transition:width 1.2s ease">
            <span style="font-size:0.72rem;font-weight:700;color:#fff">${pctUsado.toFixed(1)}%</span>
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--text2)">
          ${fmtMB(livreMB)} livres
          ${mesesRestantes !== null ? ` · Projeção: <strong style="color:${cor}">${mesesRestantes > 24 ? '+24 meses' : mesesRestantes + ' meses'}</strong> até atingir o limite no ritmo atual` : ''}
        </div>
      </div>

      <!-- CARDS POR TABELA -->
      <div class="cards-grid" style="margin-bottom:24px">
        ${cardBanco('Vendas', totalVendas, bytesVendas, totalBytes, '#3d7eff')}
        ${cardBanco('Vendedoras', totalVendedoras, bytesVendedoras, totalBytes, '#22c55e')}
        ${cardBanco('Metas', totalMetas, bytesMetas, totalBytes, '#f59e0b')}
        ${cardBanco('Usuários', totalProfiles, bytesProfiles, totalBytes, '#a855f7')}
      </div>

      <!-- DETALHAMENTO -->
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title" style="margin-bottom:16px">📋 Detalhamento por Tabela</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tabela</th>
                <th>Registros</th>
                <th>Tamanho Est.</th>
                <th>% do total usado</th>
              </tr>
            </thead>
            <tbody>
              ${linhaTabela('vendas',      totalVendas,     bytesVendas,     totalBytes)}
              ${linhaTabela('vendedoras',  totalVendedoras, bytesVendedoras, totalBytes)}
              ${linhaTabela('metas',       totalMetas,      bytesMetas,      totalBytes)}
              ${linhaTabela('profiles',    totalProfiles,   bytesProfiles,   totalBytes)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ALERTAS E DICAS -->
      <div class="panel">
        <div class="panel-title" style="margin-bottom:14px">💡 Informações</div>
        <div class="banco-dicas">
          <div class="banco-dica">
            <span class="dica-icon">📦</span>
            <div>
              <strong>Limite do plano Free</strong>
              <p>500 MB de banco de dados e 1 GB de storage. Sem cobrança automática — o Supabase pausa o projeto se exceder.</p>
            </div>
          </div>
          <div class="banco-dica">
            <span class="dica-icon">📈</span>
            <div>
              <strong>Crescimento estimado</strong>
              <p>Cada venda registrada ocupa aproximadamente 300 bytes. Com ${vendasRecentes || 0} vendas nos últimos 30 dias, o crescimento mensal é de ~${fmtKB(crescMensalBytes)}.</p>
            </div>
          </div>
          <div class="banco-dica">
            <span class="dica-icon">🔗</span>
            <div>
              <strong>Verificar no Supabase</strong>
              <p>Para o uso real e preciso, acesse <a href="https://supabase.com/dashboard/project/myflalkmbhdfgailoejc/settings/billing" target="_blank" style="color:var(--blue)">Settings → Billing</a> no painel do seu projeto.</p>
            </div>
          </div>
          ${pctUsado >= 70 ? `
          <div class="banco-dica" style="border-color:var(--yellow)40;background:var(--yellow)08">
            <span class="dica-icon">⚠️</span>
            <div>
              <strong style="color:var(--yellow)">Uso elevado detectado</strong>
              <p>Considere fazer backup e limpar vendas antigas, ou fazer upgrade para o plano Pro ($25/mês com 8 GB de banco).</p>
            </div>
          </div>` : ''}
        </div>
      </div>

      <div style="text-align:center;color:var(--text3);font-size:0.75rem;padding:16px 0">
        * Valores estimados com base na contagem de registros. O tamanho real pode variar.<br>
        Atualizado em ${new Date().toLocaleString('pt-BR')}
      </div>
    `;

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${err.message}</p></div>`;
  }
}

function fmtMB(mb) {
  if (mb < 0.01) return '< 0,01 MB';
  if (mb < 1)    return mb.toFixed(3) + ' MB';
  return mb.toFixed(2) + ' MB';
}
function fmtKB(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024*1024)).toFixed(2) + ' MB';
}

function cardBanco(nome, registros, bytes, totalBytes, cor) {
  const pctDo = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : 0;
  return `
    <div class="card">
      <div class="card-accent" style="background:${cor}"></div>
      <div class="card-label">${nome}</div>
      <div class="card-value" style="font-size:1.4rem">${fmtNum(registros || 0)}</div>
      <div class="card-sub">~${fmtKB(bytes)} · ${pctDo}% do uso</div>
      <div class="card-progress" style="margin-top:10px">
        <div class="card-progress-bar" style="width:${pctDo}%;background:${cor}"></div>
      </div>
    </div>`;
}

function linhaTabela(nome, registros, bytes, totalBytes) {
  const pct = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : 0;
  return `
    <tr>
      <td><strong>${nome}</strong></td>
      <td>${fmtNum(registros || 0)}</td>
      <td class="td-mono">~${fmtKB(bytes)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:var(--border);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:99px"></div>
          </div>
          <span style="font-size:0.78rem;color:var(--text2);min-width:36px">${pct}%</span>
        </div>
      </td>
    </tr>`;
}
