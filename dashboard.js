// ═══════════════════════════════════════════════
// MCELL — DASHBOARD
// ═══════════════════════════════════════════════

let chartVendedoras = null;
let chartDiario = null;

async function renderDashboard() {
  const page = document.getElementById('page-dashboard');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const [vendas, vendedoras, meta] = await Promise.all([
      db.getVendas({ mes: currentMes, ano: currentAno }),
      db.getVendedoras(),
      db.getMeta(currentMes, currentAno)
    ]);

    const ativas = vendedoras.filter(v => v.status === 'ativa');
    const numAtivas = ativas.length || 1;

    const totalFat = vendas.reduce((s, v) => s + (parseFloat(v.valor) * (v.quantidade || 1)), 0);
    const totalApar = vendas.reduce((s, v) => s + (v.quantidade || 1), 0);
    const metaFat   = meta?.meta_faturamento || 0;
    const metaApar  = meta?.meta_aparelhos || 0;
    const pctFat    = pct(totalFat, metaFat);
    const pctApar   = pct(totalApar, metaApar);
    const ticketMedio = totalApar > 0 ? (totalFat / totalApar) : 0;

    // Metas individuais
    const metaIndFat  = metaFat  / numAtivas;
    const metaIndApar = metaApar / numAtivas;

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

    // ── RENDER ─────────────────────────────────
    const vendedoraSection = isAdmin() ? renderVendedoraCards(ativas, byVend, metaIndFat, metaIndApar) : '';

    page.innerHTML = `
      <!-- CARDS -->
      <div class="cards-grid">
        ${card('Total Faturado', fmt(totalFat), `Meta: ${fmt(metaFat)}`, 'blue', pctFat)}
        ${card('Aparelhos Vendidos', fmtNum(totalApar), `Meta: ${fmtNum(metaApar)} aparelhos`, 'green', pctApar)}
        ${card('Meta Financeira', `${pctFat}%`, `${fmt(metaFat - totalFat)} restam`, 'yellow', pctFat)}
        ${card('Ticket Médio', fmt(ticketMedio), `${totalApar} vendas no mês`, 'blue', null)}
        ${card('Vendedoras Ativas', numAtivas, `Meta ind.: ${fmt(metaIndFat)}`, 'green', null)}
      </div>

      <!-- CHARTS -->
      <div class="charts-grid">
        <div class="chart-panel">
          <div class="section-title">Faturamento por Vendedora</div>
          <canvas id="chart-vendedoras"></canvas>
        </div>
        <div class="chart-panel">
          <div class="section-title">Evolução Diária <span>${mesToNomeCompleto(currentMes)}</span></div>
          <canvas id="chart-diario"></canvas>
        </div>
      </div>

      <!-- RANKING -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🏆 Ranking de Vendas — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
        </div>
        ${renderRanking(byVend)}
      </div>

      <!-- VENDEDORA CARDS -->
      ${vendedoraSection}
    `;

    // ── CHARTS ─────────────────────────────────
    const vendNomes = Object.keys(byVend);
    const vendFats  = vendNomes.map(n => byVend[n].fat);
    const palette   = ['#3d7eff','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4'];

    // Destroy old charts
    if (chartVendedoras) { chartVendedoras.destroy(); chartVendedoras = null; }
    if (chartDiario)     { chartDiario.destroy(); chartDiario = null; }

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
  const sorted = Object.entries(byVend).sort((a,b) => b[1].fat - a[1].fat);
  if (!sorted.length) return `<div class="empty-state"><p>Nenhuma venda no período.</p></div>`;
  return sorted.map(([nome, d], i) => `
    <div class="rank-item">
      <div class="rank-num ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${nome}</div>
        <div class="rank-sub">${fmtNum(d.apar)} aparelhos</div>
      </div>
      <div class="rank-value">${fmt(d.fat)}<small>Ticket: ${fmt(d.apar?d.fat/d.apar:0)}</small></div>
    </div>`).join('');
}

function renderVendedoraCards(ativas, byVend, metaIndFat, metaIndApar) {
  if (!ativas.length) return '';
  const cards = ativas.map(v => {
    const d = byVend[v.nome] || { fat: 0, apar: 0 };
    const p1 = pct(d.fat, metaIndFat);
    const p2 = pct(d.apar, metaIndApar);
    const faltaFat = Math.max(0, metaIndFat - d.fat);
    const faltaAp  = Math.max(0, Math.ceil(metaIndApar - d.apar));
    return `
      <div class="vendor-card">
        <div class="vendor-card-header">
          <div class="vendor-name">${v.nome}</div>
          <span class="badge badge-${p1>=100?'green':'blue'}">${p1}%</span>
        </div>
        <div class="vendor-stats">
          <div class="vstat">
            <div class="vstat-label">Faturado</div>
            <div class="vstat-val">${fmt(d.fat)}</div>
          </div>
          <div class="vstat">
            <div class="vstat-label">Meta Individual</div>
            <div class="vstat-val">${fmt(metaIndFat)}</div>
          </div>
          <div class="vstat">
            <div class="vstat-label">Aparelhos</div>
            <div class="vstat-val">${fmtNum(d.apar)}</div>
          </div>
          <div class="vstat">
            <div class="vstat-label">Faltam</div>
            <div class="vstat-val" style="color:${faltaFat>0?'var(--yellow)':'var(--green)'}">${faltaFat>0?fmt(faltaFat):'✓ Meta!'}</div>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${p1}%;background:${progressColor(p1)}"></div>
        </div>
        <div class="pct-label">${p1}% da meta financeira · Faltam ${faltaAp} aparelhos</div>
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
          label: ctx => prefix === 'R$'
            ? ' ' + fmt(ctx.raw)
            : ' ' + fmtNum(ctx.raw)
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#55556a', font: { size: 11 } },
        grid:  { color: '#ffffff08' }
      },
      y: {
        ticks: {
          color: '#55556a', font: { size: 11 },
          callback: v => prefix === 'R$'
            ? 'R$' + (v/1000).toFixed(0) + 'k'
            : v
        },
        grid: { color: '#ffffff08' }
      }
    }
  };
}
