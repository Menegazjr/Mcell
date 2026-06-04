// ═══════════════════════════════════════════════
// MCELL — MEU DESEMPENHO (visão da vendedora)
// ═══════════════════════════════════════════════

let chartDesempenho = null;

async function renderDesempenho() {
  const page = document.getElementById('page-desempenho');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    // Descobrir vendedora_id: se admin escolheu ver uma, usa ela; senão usa a do perfil
    const vendedoraId = isAdmin() ? null : getVendedoraId();

    if (!isAdmin() && !vendedoraId) {
      page.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚠</div>
          <p>Sua conta ainda não está vinculada a uma vendedora.<br>
          Peça ao administrador para vincular seu acesso.</p>
        </div>`;
      return;
    }

    // Admin pode escolher qual vendedora visualizar
    const todasVendedoras = isAdmin() ? await db.getVendedoras(true) : [];

    // Admin: usa a primeira vendedora da lista automaticamente no carregamento
    const vendedoraIdFinal = isAdmin()
      ? (_selectedVendedoraDesemp || (todasVendedoras[0]?.id || null))
      : vendedoraId;

    const [vendas, meta, vendedoras] = await Promise.all([
      db.getVendas({ mes: currentMes, ano: currentAno, vendedora_id: vendedoraIdFinal || undefined }),
      db.getMeta(currentMes, currentAno),
      isAdmin() ? Promise.resolve(todasVendedoras) : db.getVendedoras(true)
    ]);

    const ativas     = vendedoras.filter(v => v.status === 'ativa');
    const numAtivas  = ativas.length || 1;
    const metaFat    = meta?.meta_faturamento || 0;
    const metaApar   = meta?.meta_aparelhos   || 0;
    
    const metaIndApar= metaApar / numAtivas;

    // Totais
    const totalFat  = vendas.reduce((s, v) => s + (parseFloat(v.valor) * (v.quantidade || 1)), 0);
    const totalApar = vendas.reduce((s, v) => s + (v.quantidade || 1), 0);
    const faltaApar = Math.max(0, Math.ceil(metaIndApar - totalApar));
    const p1 = pct(totalApar, metaIndApar);
    const p2 = pct(totalApar, metaIndApar);
    const ticketMed = totalApar > 0 ? totalFat / totalApar : 0;

    // Evolução diária
    const byDay = {};
    vendas.forEach(v => {
      const d = v.data_venda;
      if (!byDay[d]) byDay[d] = { fat: 0, apar: 0 };
      byDay[d].fat  += parseFloat(v.valor) * (v.quantidade || 1);
      byDay[d].apar += (v.quantidade || 1);
    });
    const dias = Object.keys(byDay).sort();

    // Nome da vendedora
    let nomeVend = currentProfile?.nome || 'Você';
    if (isAdmin()) {
      const v = ativas.find(x => x.id === vendedoraIdFinal);
      if (v) nomeVend = v.nome;
    }

    // Seletor de vendedora (só admin) — pré-seleciona a vendedora atual
    const seletorAdmin = isAdmin() ? `
      <div class="desemp-selector">
        <label>Ver desempenho de:</label>
        <select id="sel-vend-desemp">
          ${ativas.map(v => `<option value="${v.id}" ${v.id === vendedoraIdFinal ? 'selected' : ''}>${v.nome}</option>`).join('')}
        </select>
      </div>` : '';

    page.innerHTML = `
      ${seletorAdmin}

      <!-- HEADER MOTIVACIONAL -->
      <div class="desemp-hero">
        <div class="desemp-avatar">${nomeVend.charAt(0).toUpperCase()}</div>
        <div>
          <div class="desemp-name">${nomeVend}</div>
          <div class="desemp-period">${mesToNomeCompleto(currentMes)} ${currentAno}</div>
        </div>
        <div class="desemp-badge ${p1 >= 100 ? 'badge-green' : p1 >= 70 ? 'badge-blue' : 'badge-yellow'}">
          ${p1 >= 100 ? '🏆 Meta batida!' : p1 >= 70 ? '🚀 No caminho!' : '⚡ Acelera!'}
        </div>
      </div>

      <!-- CARDS PRINCIPAIS -->
      <div class="cards-grid" style="margin-bottom:24px">
        ${cardDesemp('Aparelhos Vendidos', fmtNum(totalApar), `Meta: ${Math.ceil(metaIndApar)} un.`, p1, 'green')}
        ${cardDesemp('Meta Individual', Math.ceil(metaIndApar) + ' un.', `${p1}% atingido`, null, 'blue')}
        ${cardDesemp('Faltam', faltaApar > 0 ? faltaApar + ' un.' : '✓ Bateu!', 'Para a meta de aparelhos', null, faltaApar > 0 ? 'yellow' : 'green')}
      </div>

      <!-- BARRAS DE META -->
      <div class="panel" style="margin-bottom:24px">
        <div class="panel-title" style="margin-bottom:20px">📊 Progresso das Metas</div>

        <div class="meta-track-row">
          <div class="meta-track-label">
            <span>📱 Aparelhos vendidos</span>
            <span>${totalApar} de ${Math.ceil(metaIndApar)} un.</span>
          </div>
          <div class="meta-track-bg">
            <div class="meta-track-fill" style="width:${p1}%;background:${progressColor(p1)}">
              <span class="meta-track-pct">${p1}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- GRÁFICO + ÚLTIMAS VENDAS -->
      <div class="charts-grid" style="margin-bottom:24px">
        <div class="chart-panel">
          <div class="section-title">📈 Evolução Diária</div>
          <canvas id="chart-desemp"></canvas>
        </div>
        <div class="chart-panel">
          <div class="section-title">🕐 Últimas Vendas</div>
          ${renderUltimasVendas(vendas)}
        </div>
      </div>

      <!-- MENSAGEM MOTIVACIONAL -->
      ${renderMotivacao(p1, faltaApar)}
    `;

    // Gráfico
    if (chartDesempenho) { chartDesempenho.destroy(); chartDesempenho = null; }
    const ctxD = document.getElementById('chart-desemp')?.getContext('2d');
    if (ctxD && dias.length) {
      // Acumulado de aparelhos por dia
      let acum = 0;
      const vals = dias.map(d => { acum += byDay[d].apar; return acum; });
      chartDesempenho = new Chart(ctxD, {
        type: 'line',
        data: {
          labels: dias.map(d => fmtDate(d)),
          datasets: [
            {
              label: 'Aparelhos',
              data: vals,
              borderColor: '#3d7eff',
              backgroundColor: '#3d7eff18',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#3d7eff',
              pointRadius: 4
            },
            {
              label: 'Meta',
              data: dias.map(() => metaIndApar),
              borderColor: '#22c55e50',
              borderDash: [6, 4],
              borderWidth: 2,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: true,
              labels: { color: '#8888a0', font: { size: 11 }, boxWidth: 12 }
            },
            tooltip: {
              backgroundColor: '#18181f',
              borderColor: '#ffffff20',
              borderWidth: 1,
              callbacks: { label: ctx => ' ' + ctx.raw + ' un.' }
            }
          },
          scales: {
            x: { ticks: { color: '#55556a', font: { size: 10 } }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: '#55556a', font: { size: 10 } }, grid: { color: '#ffffff08' } }
          }
        }
      });
    }

    // Seletor admin
    if (isAdmin()) {
      document.getElementById('sel-vend-desemp')?.addEventListener('change', async (e) => {
        // Recarregar com a vendedora selecionada
        const vid = e.target.value;
        // Temporarily override getVendedoraId for this render
        _selectedVendedoraDesemp = vid;
        renderDesempenhoPara(vid);
      });
    }

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

// Admin pode ver qualquer vendedora
let _selectedVendedoraDesemp = null; // resetado ao trocar de mês via app.js
async function renderDesempenhoPara(vendedoraId) {
  const page = document.getElementById('page-desempenho');
  // Preserve selector
  const selectorHtml = document.querySelector('.desemp-selector')?.outerHTML || '';

  try {
    const [vendas, meta, vendedoras] = await Promise.all([
      db.getVendas({ mes: currentMes, ano: currentAno, vendedora_id: vendedoraId }),
      db.getMeta(currentMes, currentAno),
      db.getVendedoras(true)
    ]);

    const ativas      = vendedoras.filter(v => v.status === 'ativa');
    const numAtivas   = ativas.length || 1;
    const metaApar    = meta?.meta_aparelhos   || 0;
    const metaIndApar = metaApar / numAtivas;

    const totalFat  = vendas.reduce((s, v) => s + (parseFloat(v.valor) * (v.quantidade || 1)), 0);
    const totalApar = vendas.reduce((s, v) => s + (v.quantidade || 1), 0);
    const faltaApar = Math.max(0, Math.ceil(metaIndApar - totalApar));
    const p1 = pct(totalApar, metaIndApar);
    const p2 = pct(totalApar, metaIndApar);
    const ticketMed = totalApar > 0 ? totalFat / totalApar : 0;

    const vend = ativas.find(x => x.id === vendedoraId);
    const nomeVend = vend?.nome || 'Vendedora';

    const byDay = {};
    vendas.forEach(v => {
      const d = v.data_venda;
      if (!byDay[d]) byDay[d] = { fat: 0, apar: 0 };
      byDay[d].fat  += parseFloat(v.valor) * (v.quantidade || 1);
      byDay[d].apar += (v.quantidade || 1);
    });
    const dias = Object.keys(byDay).sort();

    page.innerHTML = `
      <div class="desemp-selector">
        <label>Ver desempenho de:</label>
        <select id="sel-vend-desemp">
          ${ativas.map(v => `<option value="${v.id}" ${v.id===vendedoraId?'selected':''}>${v.nome}</option>`).join('')}
        </select>
      </div>

      <div class="desemp-hero">
        <div class="desemp-avatar">${nomeVend.charAt(0).toUpperCase()}</div>
        <div>
          <div class="desemp-name">${nomeVend}</div>
          <div class="desemp-period">${mesToNomeCompleto(currentMes)} ${currentAno}</div>
        </div>
        <div class="desemp-badge ${p1>=100?'badge-green':p1>=70?'badge-blue':'badge-yellow'}">
          ${p1>=100?'🏆 Meta batida!':p1>=70?'🚀 No caminho!':'⚡ Acelera!'}
        </div>
      </div>

      <div class="cards-grid" style="margin-bottom:24px">
        ${cardDesemp('Faturado', fmt(totalFat), totalApar + ' vendas no mês', null, 'blue')}
        ${cardDesemp('Aparelhos', fmtNum(totalApar), fmtNum(Math.ceil(metaIndApar)), p2, 'green')}
        ${cardDesemp('Faltam', faltaApar>0?faltaApar+' un.':'✓ Bateu!', 'Para a meta', null, faltaApar>0?'yellow':'green')}
        ${cardDesemp('Faltam (Ap.)', faltaApar>0?faltaApar+' un.':'✓ Bateu!', 'Para a meta', null, faltaApar>0?'yellow':'green')}
        ${cardDesemp('Ticket Médio', fmt(ticketMed), totalApar+' vendas', null, 'blue')}
      </div>

      <div class="panel" style="margin-bottom:24px">
        <div class="panel-title" style="margin-bottom:20px">📊 Progresso das Metas</div>
        <div class="meta-track-row">
          <div class="meta-track-label"><span>📱 Aparelhos vendidos</span><span>${totalApar} de ${Math.ceil(metaIndApar)} un.</span></div>
          <div class="meta-track-bg"><div class="meta-track-fill" style="width:${p1}%;background:${progressColor(p1)}"><span class="meta-track-pct">${p1}%</span></div></div>
        </div>
        <div class="meta-track-row">
          <div class="meta-track-label"><span>📱 Aparelhos</span><span>${totalApar} de ${Math.ceil(metaIndApar)} un.</span></div>
          <div class="meta-track-bg"><div class="meta-track-fill" style="width:${p2}%;background:${progressColor(p2)}"><span class="meta-track-pct">${p2}%</span></div></div>
        </div>
      </div>

      <div class="charts-grid" style="margin-bottom:24px">
        <div class="chart-panel">
          <div class="section-title">📈 Evolução Diária</div>
          <canvas id="chart-desemp"></canvas>
        </div>
        <div class="chart-panel">
          <div class="section-title">🕐 Últimas Vendas</div>
          ${renderUltimasVendas(vendas)}
        </div>
      </div>

      ${renderMotivacao(p1, faltaApar)}
    `;

    if (chartDesempenho) { chartDesempenho.destroy(); chartDesempenho = null; }
    const ctxD = document.getElementById('chart-desemp')?.getContext('2d');
    if (ctxD && dias.length) {
      let acum = 0;
      const vals = dias.map(d => { acum += byDay[d].apar; return acum; });
      chartDesempenho = new Chart(ctxD, {
        type: 'line',
        data: {
          labels: dias.map(d => fmtDate(d)),
          datasets: [
            { label: 'Aparelhos', data: vals, borderColor: '#3d7eff', backgroundColor: '#3d7eff18', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3d7eff' },
            { label: 'Meta', data: dias.map(() => metaIndApar), borderColor: '#22c55e50', borderDash: [6,4], borderWidth: 2, pointRadius: 0, fill: false }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, labels: { color: '#8888a0', font: { size: 11 }, boxWidth: 12 } },
            tooltip: { backgroundColor: '#18181f', borderColor: '#ffffff20', borderWidth: 1, callbacks: { label: ctx => ' ' + ctx.raw + ' un.' } }
          },
          scales: {
            x: { ticks: { color: '#55556a', font: { size: 10 } }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: '#55556a', font: { size: 10 } }, grid: { color: '#ffffff08' } }
          }
        }
      });
    }

    document.getElementById('sel-vend-desemp')?.addEventListener('change', e => {
      renderDesempenhoPara(e.target.value);
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

// ── HELPERS ────────────────────────────────────
function cardDesemp(label, value, sub, progress, accent) {
  const bar = progress !== null ? `
    <div class="card-progress" style="margin-top:10px">
      <div class="card-progress-bar" style="width:${progress}%;background:${progressColor(progress)}"></div>
    </div>` : '';
  return `
    <div class="card">
      <div class="card-accent ${accent}"></div>
      <div class="card-label">${label}</div>
      <div class="card-value" style="font-size:1.3rem">${value}</div>
      <div class="card-sub">${sub}</div>
      ${bar}
    </div>`;
}

function renderUltimasVendas(vendas) {
  const ultimas = [...vendas].slice(0, 6);
  if (!ultimas.length) return `<div class="empty-state" style="padding:20px"><p>Nenhuma venda ainda.</p></div>`;
  return ultimas.map(v => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:0.85rem;font-weight:600">${v.modelo_iphone}</div>
        <div style="font-size:0.75rem;color:var(--text2)">${fmtDate(v.data_venda)} · ${v.quantidade||1} un.</div>
      </div>
      <div style="font-family:var(--font-head);font-weight:700;font-size:0.9rem;color:var(--blue)">
        ${fmt((v.valor||0)*(v.quantidade||1))}
      </div>
    </div>`).join('');
}

function renderMotivacao(p1, faltaApar) {
  let icon, titulo, msg;
  if (p1 >= 100) {
    icon = '🏆'; titulo = 'Meta batida!';
    msg = 'Parabéns! Você superou sua meta do mês. Continue assim!';
  } else if (p1 >= 70) {
    icon = '🚀'; titulo = 'Quase lá!';
    msg = `Faltam apenas ${faltaApar} aparelhos. Você consegue!`;
  } else if (p1 >= 40) {
    icon = '⚡'; titulo = 'Bora acelerar!';
    msg = `Você está em ${p1}% da meta. Foco nas vendas — ainda dá tempo!`;
  } else {
    icon = '💪'; titulo = 'Todo dia conta!';
    msg = `Cada venda te aproxima da meta. Faltam ${faltaApar} aparelhos — vamos lá!`;
  }
  return `
    <div class="desemp-motivacao">
      <div class="motiv-icon">${icon}</div>
      <div>
        <div class="motiv-titulo">${titulo}</div>
        <div class="motiv-msg">${msg}</div>
      </div>
    </div>`;
}
