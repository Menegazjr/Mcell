// ═══════════════════════════════════════════════
// MCELL — DASHBOARD
// ═══════════════════════════════════════════════

let chartVendedoras = null;
let chartDiario = null;

async function renderDashboard() {
  const page = document.getElementById('page-dashboard');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const [vendas, vendedoras, meta, metasInd] = await Promise.all([
      db.getVendas({ mes: currentMes, ano: currentAno }),
      db.getVendedoras(),
      db.getMeta(currentMes, currentAno),
      db.getMetasIndividuais(currentMes, currentAno)
    ]);

    const ativas    = vendedoras.filter(v => v.status === 'ativa');
    const numAtivas = ativas.length || 1;

    const totalFat  = vendas.reduce((s, v) => s + (parseFloat(v.valor) * (v.quantidade || 1)), 0);
    const totalApar = vendas.reduce((s, v) => s + (v.quantidade || 1), 0);
    const metaApar  = meta?.meta_aparelhos || 0;
    const pctApar   = pct(totalApar, metaApar);
    const ticketMedio = totalApar > 0 ? (totalFat / totalApar) : 0;

    // Distribuição real (manual ou automática)
    const distrib     = typeof calcDistribuicao === 'function'
      ? calcDistribuicao(metaApar, ativas, metasInd)
      : { lista: [], metaAuto: metaApar / numAtivas };
    const metaIndApar = distrib.metaAuto;

    // Vendas por vendedora
    const byVend = {};
    vendas.forEach(v => {
      const nome = v.vendedoras?.nome || 'Desconhecida';
      if (!byVend[nome]) byVend[nome] = { fat: 0, apar: 0 };
      byVend[nome].fat  += parseFloat(v.valor) * (v.quantidade || 1);
      byVend[nome].apar += (v.quantidade || 1);
    });

    // Evolução diária
    const byDay = {};
    vendas.forEach(v => {
      const d = v.data_venda;
      if (!byDay[d]) byDay[d] = 0;
      byDay[d] += parseFloat(v.valor) * (v.quantidade || 1);
    });
    const sortedDays = Object.keys(byDay).sort();

    const vendedoraSection = isAdmin() ? renderVendedoraCards(ativas, byVend, metaIndApar, distrib) : '';

    // Aviso de meta não definida (admin only)
    const avisoMeta = isAdmin() && !meta ? `
      <div class="meta-aviso" id="meta-aviso">
        <div class="meta-aviso-icon">◎</div>
        <div class="meta-aviso-content">
          <div class="meta-aviso-title">Nenhuma meta definida para ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
          <div class="meta-aviso-sub">Defina a meta do mês para acompanhar o desempenho das vendedoras.</div>
        </div>
        <button class="btn-primary btn-sm" id="btn-ir-metas">Definir Meta</button>
      </div>` : '';

    if (isAdmin()) {
      page.innerHTML = `
        ${avisoMeta}
        <div class="cards-grid">
          ${card('Total Faturado',     fmt(totalFat),       `${totalApar} aparelhos vendidos`, 'blue',   null)}
          ${card('Aparelhos Vendidos', fmtNum(totalApar),   `Meta: ${fmtNum(metaApar)} un.`,   'green',  pctApar)}
          ${card('Meta Aparelhos',     `${pctApar}%`,       `Faltam ${Math.max(0, metaApar - totalApar)} un.`, 'yellow', pctApar)}
          ${card('Ticket Médio',       fmt(ticketMedio),    `${totalApar} vendas no mês`,      'blue',   null)}
          ${card('Usuários Ativos',    numAtivas,           `Meta ind.: ${metaIndApar.toFixed(1)} un.`, 'green', null)}
        </div>
        <div class="charts-grid">
          <div class="chart-panel">
            <div class="section-title">Faturamento por Usuário</div>
            <canvas id="chart-vendedoras"></canvas>
          </div>
          <div class="chart-panel">
            <div class="section-title">Evolução Diária <span>${mesToNomeCompleto(currentMes)}</span></div>
            <canvas id="chart-diario"></canvas>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🏆 Ranking — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
          </div>
          ${renderRanking(byVend)}
        </div>
        ${vendedoraSection}
      `;
    } else {
      // Vendedor: só aparelhos, sem faturamento, sem ranking
      const meuId = getVendedoraId();
      const minhasVendas = vendas.filter(v => v.vendedora_id === meuId);
      const meuApar = minhasVendas.reduce((s,v) => s + (v.quantidade||1), 0);
      const meuFat  = minhasVendas.reduce((s,v) => s + parseFloat(v.valor||0)*(v.quantidade||1), 0);
      const meuPct  = pct(meuApar, metaIndApar);
      const faltam  = Math.max(0, Math.ceil(metaIndApar - meuApar));
      page.innerHTML = `
        <div class="cards-grid">
          ${card('Aparelhos Vendidos', fmtNum(meuApar),  `Meta: ${Math.ceil(metaIndApar)} un.`,    'green',  meuPct)}
          ${card('Meta Individual',    `${meuPct}%`,     `Faltam ${faltam} un.`,                   'yellow', meuPct)}
          ${card('Faltam',             faltam + ' un.',  'Para bater a meta',                      faltam===0?'green':'yellow', null)}
        </div>
      `;
    }

    // Botão ir para metas
    document.getElementById('btn-ir-metas')?.addEventListener('click', () => {
      navigateTo('metas');
    });

    // Charts
    if (chartVendedoras) { chartVendedoras.destroy(); chartVendedoras = null; }
    if (chartDiario)     { chartDiario.destroy();     chartDiario = null; }

    const vendNomes = Object.keys(byVend);
    const vendFats  = vendNomes.map(n => byVend[n].fat);
    const palette   = ['#3d7eff','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4'];

    const ctxV = document.getElementById('chart-vendedoras')?.getContext('2d');
    if (ctxV && vendNomes.length) {
      chartVendedoras = new Chart(ctxV, {
        type: 'bar',
        data: {
          labels: vendNomes,
          datasets: [{
            label: 'Faturamento',
            data: vendFats,
            backgroundColor: palette.slice(0, vendNomes.length),
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: chartOptions('R$')
      });
    }

    const ctxD = document.getElementById('chart-diario')?.getContext('2d');
    if (ctxD && sortedDays.length) {
      chartDiario = new Chart(ctxD, {
        type: 'line',
        data: {
          labels: sortedDays.map(d => fmtDate(d)),
          datasets: [{
            label: 'Faturamento',
            data: sortedDays.map(d => byDay[d]),
            borderColor: '#3d7eff',
            backgroundColor: '#3d7eff22',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3d7eff',
            pointRadius: 4
          }]
        },
        options: chartOptions('R$')
      });
    }

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${err.message}</p></div>`;
  }
}

function card(label, value, sub, accent, progress) {
  const bar = progress !== null ? `
    <div class="card-progress">
      <div class="card-progress-bar" style="width:${progress}%;background:${progressColor(progress)}"></div>
    </div>` : '';
  return `
    <div class="card">
      <div class="card-accent ${accent}"></div>
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
      <div class="card-sub">${sub}</div>
      ${bar}
    </div>`;
}

function renderRanking(byVend) {
  const sorted = Object.entries(byVend).sort((a,b) => b[1].apar - a[1].apar);
  if (!sorted.length) return `<div class="empty-state"><p>Nenhuma venda no período.</p></div>`;
  return sorted.map(([nome, d], i) => `
    <div class="rank-item">
      <div class="rank-num ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${nome}</div>
        <div class="rank-sub">${fmtNum(d.apar)} aparelhos vendidos</div>
      </div>
      <div class="rank-value">${fmtNum(d.apar)} un.</div>
    </div>`).join('');
}

function renderVendedoraCards(ativas, byVend, metaIndApar, distrib) {
  if (!ativas.length) return '';
  const cards = ativas.map(v => {
    const d = byVend[v.nome] || { fat: 0, apar: 0 };
    // Usa meta individual real se disponível
    const metaInd = distrib?.lista?.find(x => x.vendedora_id === v.id)?.meta || metaIndApar;
    const p = pct(d.apar, metaInd);
    const faltaAp = Math.max(0, Math.ceil(metaInd - d.apar));
    return `
      <div class="vendor-card">
        <div class="vendor-card-header">
          <div class="vendor-name">${v.nome}</div>
          <span class="badge badge-${p>=100?'green':'blue'}">${p}%</span>
        </div>
        <div class="vendor-stats">
          <div class="vstat">
            <div class="vstat-label">Aparelhos</div>
            <div class="vstat-val">${fmtNum(d.apar)}</div>
          </div>
          <div class="vstat">
            <div class="vstat-label">Meta Individual</div>
            <div class="vstat-val">${metaInd.toFixed(1)} un.</div>
          </div>
          <div class="vstat">
            <div class="vstat-label">Faltam</div>
            <div class="vstat-val" style="color:${faltaAp>0?'var(--yellow)':'var(--green)'}">
              ${faltaAp>0 ? faltaAp + ' un.' : '✓ Meta!'}
            </div>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${p}%;background:${progressColor(p)}"></div>
        </div>
        <div class="pct-label">${p}% da meta · Faltam ${faltaAp} aparelhos${distrib?.lista?.find(x=>x.vendedora_id===v.id)?.isManual?' · <span class="badge badge-yellow" style="font-size:0.68rem">Manual</span>':''}</div>
      </div>`;
  });

  return `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">📊 Desempenho Individual — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
      </div>
      ${cards.join('')}
    </div>`;
}

function chartOptions(prefix = '') {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181f',
        borderColor: '#ffffff20',
        borderWidth: 1,
        titleColor: '#f0f0f5',
        bodyColor: '#8888a0',
        callbacks: {
          label: ctx => prefix === 'R$' ? ' ' + fmt(ctx.raw) : ' ' + fmtNum(ctx.raw)
        }
      }
    },
    scales: {
      x: { ticks: { color: '#55556a', font: { size: 11 } }, grid: { color: '#ffffff08' } },
      y: {
        ticks: {
          color: '#55556a', font: { size: 11 },
          callback: v => prefix === 'R$' ? 'R$' + (v/1000).toFixed(0) + 'k' : v
        },
        grid: { color: '#ffffff08' }
      }
    }
  };
}
