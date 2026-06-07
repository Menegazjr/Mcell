// ═══════════════════════════════════════════════
// MCELL — RELATÓRIOS
// ═══════════════════════════════════════════════

async function renderRelatorios() {
  const page = document.getElementById('page-relatorios');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const vendedoras = await db.getVendedoras();
    const vendOpts = vendedoras.map(v =>
      `<option value="${v.id}">${v.nome}</option>`).join('');

    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth()+1).padStart(2,'0');
    const anoOpts = [2024,2025,2026,2027].map(a =>
      `<option value="${a}" ${a===parseInt(currentAno)?'selected':''}>${a}</option>`).join('');
    const mesOpts = [...Array(12)].map((_,i) =>
      `<option value="${i+1}" ${(i+1)===parseInt(currentMes)?'selected':''}>${mesToNomeCompleto(i+1)}</option>`).join('');

    page.innerHTML = `
      <!-- FILTERS -->
      <div class="panel">
        <div class="panel-title" style="margin-bottom:16px">🔍 Filtros</div>
        <div class="rel-filter-grid">
          <div class="form-group">
            <label>Tipo de filtro</label>
            <select id="r-tipo">
              <option value="mes">Por Mês/Ano</option>
              <option value="periodo">Período Personalizado</option>
            </select>
          </div>

          <!-- Mês/Ano -->
          <div class="form-group" id="filtro-mes-wrap">
            <label>Mês</label>
            <select id="r-mes">${mesOpts}</select>
          </div>
          <div class="form-group" id="filtro-ano-wrap">
            <label>Ano</label>
            <select id="r-ano">${anoOpts}</select>
          </div>

          <!-- Período personalizado -->
          <div class="form-group hidden" id="filtro-inicio-wrap">
            <label>De</label>
            <input type="date" id="r-inicio" value="${y}-${m}-01"/>
          </div>
          <div class="form-group hidden" id="filtro-fim-wrap">
            <label>Até</label>
            <input type="date" id="r-fim" value="${y}-${m}-${new Date(y,parseInt(m),0).getDate()}"/>
          </div>

          ${isAdmin() ? `
          <div class="form-group">
            <label>Usuário</label>
            <select id="r-vend">
              <option value="">Todos</option>
              ${vendOpts}
            </select>
          </div>` : ''}

          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn-primary btn-full" id="btn-gerar-rel">Gerar</button>
          </div>
        </div>
      </div>

      <!-- RESULTS -->
      <div id="rel-resultado"></div>
    `;

    // Toggle filtros
    document.getElementById('r-tipo').addEventListener('change', (e) => {
      const isMes = e.target.value === 'mes';
      document.getElementById('filtro-mes-wrap').classList.toggle('hidden', !isMes);
      document.getElementById('filtro-ano-wrap').classList.toggle('hidden', !isMes);
      document.getElementById('filtro-inicio-wrap').classList.toggle('hidden', isMes);
      document.getElementById('filtro-fim-wrap').classList.toggle('hidden', isMes);
    });

    document.getElementById('btn-gerar-rel').addEventListener('click', gerarRelatorio);

    // Auto-generate on load
    gerarRelatorio();

  } catch(err) {
    page.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

async function gerarRelatorio() {
  const div = document.getElementById('rel-resultado');
  if (!div) return;
  div.innerHTML = `<div class="spinner"></div>`;

  try {
    const tipo = document.getElementById('r-tipo').value;
    const filtro = {};

    if (tipo === 'mes') {
      filtro.mes = parseInt(document.getElementById('r-mes').value);
      filtro.ano = parseInt(document.getElementById('r-ano').value);
    } else {
      filtro.data_inicio = document.getElementById('r-inicio').value;
      filtro.data_fim    = document.getElementById('r-fim').value;
    }

    const vendId = isAdmin() ? document.getElementById('r-vend')?.value : getVendedoraId();
    if (vendId) filtro.vendedora_id = vendId;

    const vendas = await db.getVendas(filtro);

    // Aggregates
    const totalFat   = vendas.reduce((s,v) => s + (parseFloat(v.valor)*(v.quantidade||1)), 0);
    const totalApar  = vendas.reduce((s,v) => s + (v.quantidade||1), 0);
    const ticketMed  = totalApar > 0 ? totalFat/totalApar : 0;

    // By vendor
    const byVend = {};
    vendas.forEach(v => {
      const nome = v.vendedoras?.nome || '—';
      if (!byVend[nome]) byVend[nome] = { fat: 0, apar: 0 };
      byVend[nome].fat  += parseFloat(v.valor)*(v.quantidade||1);
      byVend[nome].apar += (v.quantidade||1);
    });
    const ranking = Object.entries(byVend).sort((a,b) => b[1].fat - a[1].fat);

    const periodo = tipo === 'mes'
      ? `${mesToNomeCompleto(filtro.mes)}/${filtro.ano}`
      : `${fmtDate(filtro.data_inicio)} a ${fmtDate(filtro.data_fim)}`;

    const adminBlocks = isAdmin() ? `
      <div class="cards-grid" style="margin-bottom:24px">
        ${cardR('Faturamento Total', fmt(totalFat))}
        ${cardR('Aparelhos Vendidos', fmtNum(totalApar))}
        ${cardR('Ticket Médio', fmt(ticketMed))}
        ${cardR('Registros', vendas.length)}
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🏆 Ranking — ${periodo}</div>
          <div style="display:flex;gap:8px">
            <button class="btn-ghost btn-sm" id="btn-pdf">⬇ PDF</button>
            <button class="btn-ghost btn-sm" id="btn-excel">⬇ Excel</button>
          </div>
        </div>
        ${ranking.map(([nome, d], i) => `
          <div class="rank-item">
            <div class="rank-num ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
            <div class="rank-info">
              <div class="rank-name">${nome}</div>
              <div class="rank-sub">${fmtNum(d.apar)} aparelhos · Ticket: ${fmt(d.apar?d.fat/d.apar:0)}</div>
            </div>
            <div class="rank-value">${fmt(d.fat)}</div>
          </div>`).join('') || `<div class="empty-state"><p>Sem dados no período.</p></div>`}
      </div>` : `
      <div class="cards-grid" style="margin-bottom:24px">
        ${cardR('Aparelhos Vendidos', fmtNum(totalApar))}
        ${cardR('Registros', vendas.length)}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn-ghost btn-sm" id="btn-pdf">⬇ PDF</button>
        <button class="btn-ghost btn-sm" id="btn-excel">⬇ Excel</button>
      </div>`;

    div.innerHTML = `
      ${adminBlocks}

      <!-- TABELA DETALHADA -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📋 Detalhamento das Vendas</div>
          <span class="badge badge-blue">${vendas.length} registros</span>
        </div>
        <div class="table-wrap">
          ${renderTabelaVendas(vendas)}
        </div>
      </div>
    `;

    // Exports
    document.getElementById('btn-pdf').addEventListener('click', () => exportarPDF(vendas, periodo, ranking, totalFat, totalApar, ticketMed));
    document.getElementById('btn-excel').addEventListener('click', () => exportarExcel(vendas, periodo));

    // Re-attach delete if admin
    document.querySelectorAll('.btn-del-venda').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta venda?')) return;
        await db.deleteVenda(btn.dataset.id);
        toast('Venda excluída.');
        gerarRelatorio();
      });
    });

  } catch(err) {
    div.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function cardR(label, value) {
  return `
    <div class="card">
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
    </div>`;
}

// ── EXPORTS ────────────────────────────────────
async function exportarPDF(vendas, periodo, ranking, totalFat, totalApar, ticketMed) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MCELL', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(136, 136, 160);
  doc.text('Relatório de Vendas — ' + periodo, 14, 28);
  doc.text('Gerado em: ' + new Date().toLocaleDateString('pt-BR'), 14, 35);

  // KPIs
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', 14, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Faturamento Total: ${fmt(totalFat)}`, 14, 62);
  doc.text(`Aparelhos Vendidos: ${fmtNum(totalApar)}`, 14, 70);
  doc.text(`Ticket Médio: ${fmt(ticketMed)}`, 14, 78);
  doc.text(`Total de Vendas: ${vendas.length}`, 14, 86);

  // Ranking
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Ranking de Vendedoras', 14, 100);
  let y = 110;
  ranking.forEach(([nome, d], i) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${i+1}. ${nome} — ${fmt(d.fat)} (${fmtNum(d.apar)} aparelhos)`, 14, y);
    y += 8;
  });

  // Table
  if (y < 200) {
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Vendas Detalhadas', 14, y);
    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Data', 14, y);
    doc.text('Vendedora', 38, y);
    doc.text('Modelo', 80, y);
    doc.text('Qtd', 140, y);
    doc.text('Valor', 155, y);
    doc.text('Total', 180, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    vendas.slice(0, 30).forEach(v => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(fmtDate(v.data_venda), 14, y);
      doc.text((v.vendedoras?.nome||'').slice(0,18), 38, y);
      doc.text((v.modelo_iphone||'').slice(0,20), 80, y);
      doc.text(String(v.quantidade||1), 140, y);
      doc.text(fmt(v.valor), 152, y);
      doc.text(fmt((v.valor||0)*(v.quantidade||1)), 178, y);
      y += 7;
    });
    if (vendas.length > 30) {
      doc.text(`... e mais ${vendas.length-30} vendas (use Excel para ver tudo)`, 14, y);
    }
  }

  doc.save(`mcell-relatorio-${periodo.replace('/','-')}.pdf`);
  toast('PDF gerado!');
}

function exportarExcel(vendas, periodo) {
  const rows = vendas.map(v => ({
    'Data': fmtDate(v.data_venda),
    'Vendedora': v.vendedoras?.nome || '—',
    'Modelo': v.modelo_iphone || '—',
    'Quantidade': v.quantidade || 1,
    'Valor Unitário': parseFloat(v.valor) || 0,
    'Total': (parseFloat(v.valor)||0) * (v.quantidade||1),
    'Observações': v.observacoes || ''
  }));

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
  XLSX.writeFile(wb, `mcell-vendas-${periodo.replace('/','-')}.xlsx`);
  toast('Excel gerado!');
}
