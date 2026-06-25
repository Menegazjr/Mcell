// ═══════════════════════════════════════════════
// MCELL — MEU DESEMPENHO
// Uma única função de renderização para admin e vendedora
// ═══════════════════════════════════════════════

let chartDesempenho = null;
let _selectedVendedoraDesemp = null;

// ── ENTRY POINT ────────────────────────────────
async function renderDesempenho() {
  const page = document.getElementById('page-desempenho');

  if (!isAdmin() && !getVendedoraId()) {
    page.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠</div>
        <p>Sua conta não está vinculada a uma vendedora.<br>
        Peça ao administrador para vincular seu acesso.</p>
      </div>`;
    return;
  }

  // Admin: carrega lista de vendedoras primeiro
  let ativas = [];
  if (isAdmin()) {
    ativas = await db.getVendedoras(true);
    if (!_selectedVendedoraDesemp && ativas.length > 0) {
      _selectedVendedoraDesemp = ativas[0].id;
    }
  }

  const vendedoraId = isAdmin() ? _selectedVendedoraDesemp : getVendedoraId();
  await _renderDesemp(page, vendedoraId, ativas);
}

// ── RENDERIZAÇÃO ÚNICA ─────────────────────────
async function _renderDesemp(page, vendedoraId, ativasPreload = []) {
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const [vendas, meta, vendedoras, metasInd] = await Promise.all([
      db.getVendas({ mes: currentMes, ano: currentAno, vendedora_id: vendedoraId || undefined }),
      db.getMeta(currentMes, currentAno),
      isAdmin() ? Promise.resolve(ativasPreload.length ? ativasPreload : await db.getVendedoras(true)) : db.getVendedoras(true),
      db.getMetasIndividuais(currentMes, currentAno)
    ]);

    const ativas = vendedoras.filter(v => v.status === 'ativa');

    // Meta individual
    const metaApar   = meta?.meta_aparelhos || 0;
    const distrib    = typeof calcDistribuicao === 'function'
      ? calcDistribuicao(metaApar, ativas, metasInd)
      : { lista: [], metaAuto: metaApar / (ativas.length || 1) };
    const metaInd     = distrib.lista.find(d => d.vendedora_id === vendedoraId);
    const isExtra     = metaInd?.isExtra || false;
    const metaIndApar = isExtra ? null : (metaInd?.meta ?? distrib.metaAuto);

    // Totais
    const totalFat  = vendas.reduce((s, v) => s + parseFloat(v.valor||0) * (v.quantidade||1), 0);
    const totalApar = vendas.reduce((s, v) => s + (v.quantidade||1), 0);
    const faltaApar = isExtra ? 0 : Math.max(0, Math.ceil(metaIndApar - totalApar));
    const p1        = isExtra ? 0 : pct(totalApar, metaIndApar);
    const ticketMed = totalApar > 0 ? totalFat / totalApar : 0;

    // Evolução diária
    const byDay = {};
    vendas.forEach(v => {
      if (!byDay[v.data_venda]) byDay[v.data_venda] = { fat: 0, apar: 0 };
      byDay[v.data_venda].fat  += parseFloat(v.valor||0) * (v.quantidade||1);
      byDay[v.data_venda].apar += (v.quantidade||1);
    });
    const dias = Object.keys(byDay).sort();

    // Nome
    const nomeVend = isAdmin()
      ? (ativas.find(x => x.id === vendedoraId)?.nome || 'Vendedor')
      : (currentProfile?.nome || 'Você');

    // Seletor (admin only)
    const seletor = isAdmin() ? `
      <div class="desemp-selector">
        <label>Ver desempenho de:</label>
        <select id="sel-vend-desemp">
          ${ativas.map(v => `<option value="${v.id}" ${v.id===vendedoraId?'selected':''}>${v.nome}</option>`).join('')}
        </select>
      </div>` : '';

    // ── HTML ────────────────────────────────────
    page.innerHTML = `
      ${seletor}

      <div class="desemp-hero">
        <div class="desemp-avatar">${nomeVend.charAt(0).toUpperCase()}</div>
        <div>
          <div class="desemp-name">${nomeVend}</div>
          <div class="desemp-period">${mesToNomeCompleto(currentMes)} ${currentAno}</div>
        </div>
        <div class="desemp-badge ${isExtra ? 'badge-yellow' : p1>=100?'badge-green':p1>=70?'badge-blue':'badge-yellow'}">
          ${isExtra ? '⭐ Extra — sem meta' : p1>=100?'🏆 Meta batida!':p1>=70?'🚀 No caminho!':'⚡ Acelera!'}
        </div>
      </div>

      <div class="cards-grid" style="margin-bottom:24px">
        ${isExtra ? `
          ${cardDesemp('Aparelhos Vendidos', fmtNum(totalApar), 'Sem meta atribuída', null, 'blue')}
          ${cardDesemp('Faturado', fmt(totalFat), `${totalApar} vendas no mês`, null, 'green')}
          ${cardDesemp('Ticket Médio', fmt(ticketMed), 'Não entra no cálculo da meta', null, 'yellow')}
        ` : `
          ${cardDesemp('Aparelhos Vendidos', fmtNum(totalApar), `Meta: ${Math.ceil(metaIndApar)} un.`, p1, 'green')}
          ${cardDesemp('Meta Individual', Math.ceil(metaIndApar) + ' un.', `${p1}% atingido`, null, 'blue')}
          ${cardDesemp('Faltam', faltaApar>0 ? faltaApar+' un.' : '✓ Bateu!', 'Para a meta', null, faltaApar>0?'yellow':'green')}
        `}
      </div>

      ${!isExtra ? `
      <div class="panel" style="margin-bottom:24px">
        <div class="panel-title" style="margin-bottom:20px">📊 Progresso da Meta</div>
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
      </div>` : `
      <div class="panel" style="margin-bottom:24px;border-color:var(--yellow)50">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:1.5rem">⭐</span>
          <div>
            <div style="font-weight:700;margin-bottom:2px">Vendedor Extra</div>
            <div style="font-size:0.85rem;color:var(--text2)">
              Este vendedor não participa do cálculo de metas mensais.
              As vendas continuam sendo registradas e contabilizadas no faturamento total da loja.
            </div>
          </div>
        </div>
      </div>`}

      <div class="charts-grid" style="margin-bottom:24px">
        <div class="chart-panel">
          <div class="section-title">📈 Evolução Diária — Aparelhos</div>
          <canvas id="chart-desemp"></canvas>
        </div>
        <div class="chart-panel">
          <div class="section-title">🕐 Últimas Vendas</div>
          ${renderUltimasVendas(vendas)}
        </div>
      </div>

      ${!isExtra ? renderMotivacao(p1, faltaApar) : ''}
    `;

    // Seletor listener
    document.getElementById('sel-vend-desemp')?.addEventListener('change', async (e) => {
      _selectedVendedoraDesemp = e.target.value;
      await _renderDesemp(page, e.target.value, ativas);
    });

    // Gráfico
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
            {
              label: 'Aparelhos',
              data: vals,
              borderColor: '#FC4C04',
              backgroundColor: '#FC4C0418',
              fill: true, tension: 0.4,
              pointBackgroundColor: '#FC4C04', pointRadius: 4
            },
            ...(isExtra ? [] : [{
              label: 'Meta',
              data: dias.map(() => metaIndApar),
              borderColor: '#22c55e60',
              borderDash: [6,4], borderWidth: 2,
              pointRadius: 0, fill: false
            }])
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, labels: { color: '#8888a0', font: { size: 11 }, boxWidth: 12 } },
            tooltip: { backgroundColor: '#18181f', borderColor: '#ffffff20', borderWidth: 1,
              callbacks: { label: ctx => ' ' + ctx.raw + ' un.' } }
          },
          scales: {
            x: { ticks: { color: '#55556a', font: { size: 10 } }, grid: { color: '#ffffff08' } },
            y: { ticks: { color: '#55556a', font: { size: 10 } }, grid: { color: '#ffffff08' } }
          }
        }
      });
    }

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

// ── HELPERS ────────────────────────────────────
function cardDesemp(label, value, sub, progress, accent) {
  const bar = progress !== null && progress !== undefined ? `
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
