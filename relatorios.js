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
    // Anos: de 2026 até o próximo ano, cresce automaticamente
    const anoAtual = new Date().getFullYear();
    const anos = [];
    for (let a = 2026; a <= anoAtual + 1; a++) anos.push(a);
    const anoOpts = anos.map(a =>
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
        ${renderTabelaVendas(vendas, { showEdit: false, maxHeight: '480px' })}
      </div>
    `;

    // Exports
    document.getElementById('btn-pdf').addEventListener('click', () => exportarPDF(vendas, periodo, ranking, totalFat, totalApar, ticketMed));
    document.getElementById('btn-excel').addEventListener('click', () => exportarExcel(vendas, periodo));

    // Clique na linha abre detalhes (sem editar em relatórios)
    document.querySelectorAll('.venda-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const venda = vendas.find(v => v.id === row.dataset.id);
        if (venda && typeof abrirDetalhesVenda === 'function') abrirDetalhesVenda(venda);
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
  const doc = new jsPDF({ orientation: 'landscape' }); // paisagem para caber mais colunas
  const PW = 297; // largura A4 paisagem

  // ── HEADER ──────────────────────────────────
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, PW, 22, 'F');
  doc.setFillColor(252, 76, 4);
  doc.rect(0, 22, PW, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MCELL', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 180, 160);
  doc.text('Relatorio de Vendas — ' + periodo, 60, 10);
  doc.text('Gerado em: ' + new Date().toLocaleDateString('pt-BR'), 60, 17);

  let y = 34;

  // ── RESUMO ───────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', 14, y); y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (isAdmin()) {
    doc.text(`Faturamento Total: ${fmt(totalFat)}`, 14, y);
    doc.text(`Aparelhos Vendidos: ${fmtNum(totalApar)}`, 80, y);
    doc.text(`Ticket Medio: ${fmt(ticketMed)}`, 150, y);
    doc.text(`Total de Registros: ${vendas.length}`, 220, y);
    y += 8;

    // ── RANKING ─────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Ranking', 14, y); y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    ranking.forEach(([nome, d], i) => {
      doc.text(`${i+1}. ${nome} — ${fmt(d.fat)} | ${fmtNum(d.apar)} aparelhos`, 14, y);
      y += 6;
    });
    y += 4;
  } else {
    doc.text(`Aparelhos Vendidos: ${fmtNum(totalApar)}`, 14, y);
    doc.text(`Total de Registros: ${vendas.length}`, 80, y);
    y += 10;
  }

  // ── TABELA ───────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Vendas Detalhadas', 14, y); y += 6;

  // Linha separadora laranja
  doc.setDrawColor(252, 76, 4);
  doc.setLineWidth(0.5);
  doc.line(14, y, PW - 14, y); y += 4;

  // Cabeçalho da tabela
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);

  // Colunas: Data | Vendedora | Modelo Vendido | Ap. Entrada | Vlr Entrada | Vlr Pago | Qtd | Total | Obs
  const cols = [
    { label: 'Data',         x: 14  },
    { label: 'Vendedora',    x: 34  },
    { label: 'Modelo Vendido', x: 66 },
    { label: 'Ap. Entrada',  x: 116 },
    { label: 'Vlr Entrada',  x: 158 },
    { label: 'Vlr Pago',     x: 184 },
    { label: 'Qtd',          x: 210 },
    { label: 'Total',        x: 220 },
    { label: 'Obs.',         x: 248 },
  ];
  cols.forEach(col => doc.text(col.label, col.x, y));
  y += 5;

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, y, PW - 14, y); y += 3;

  // Linhas de dados
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let bgToggle = false;

  vendas.forEach(v => {
    if (y > 190) {
      doc.addPage();
      // Recriar cabeçalho na nova página
      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, PW, 12, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(8);
      doc.setFont('helvetica','bold');
      doc.text('MCELL — ' + periodo, 14, 8);
      y = 20;
      doc.setFontSize(7.5);
      doc.setFont('helvetica','bold');
      doc.setTextColor(80,80,80);
      cols.forEach(col => doc.text(col.label, col.x, y));
      y += 5;
      doc.setDrawColor(200,200,200);
      doc.line(14, y, PW-14, y); y += 3;
      doc.setFont('helvetica','normal');
    }

    // Fundo alternado
    if (bgToggle) {
      doc.setFillColor(248, 248, 250);
      doc.rect(14, y - 4, PW - 28, 7, 'F');
    }
    bgToggle = !bgToggle;

    const temEntrada = !!v.aparelho_entrada;
    const total = (parseFloat(v.valor||0) + parseFloat(v.valor_entrada||0)) * (v.quantidade||1);

    doc.setTextColor(30, 30, 30);
    doc.text(fmtDate(v.data_venda),                          cols[0].x, y);
    doc.text((v.vendedoras?.nome||'').slice(0,14),           cols[1].x, y);
    doc.text((v.modelo_iphone||'').slice(0,20),              cols[2].x, y);
    doc.text(temEntrada ? (v.aparelho_entrada||'').slice(0,16) : '—', cols[3].x, y);
    doc.text(temEntrada ? fmt(v.valor_entrada) : '—',        cols[4].x, y);
    doc.text(fmt(v.valor),                                   cols[5].x, y);
    doc.text(String(v.quantidade||1),                        cols[6].x, y);

    // Total em laranja
    doc.setTextColor(252, 76, 4);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(total),                                     cols[7].x, y);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');

    doc.text((v.observacoes||'').slice(0,20),                cols[8].x, y);
    y += 7;
  });

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Mcell Assistencia Tecnica e Acessorios  |  ' + new Date().toLocaleString('pt-BR'), 14, 200);

  doc.save(`mcell-relatorio-${periodo.replace('/','-')}.pdf`);
  toast('PDF gerado!');
}

function exportarExcel(vendas, periodo) {
  const rows = vendas.map(v => {
    const entradas    = (v.entradas && v.entradas.length > 0) ? v.entradas
                      : v.aparelho_entrada ? [{modelo: v.aparelho_entrada, valor: parseFloat(v.valor_entrada||0)}]
                      : [];
    const totEnt  = entradas.reduce((s,e) => s + parseFloat(e.valor||0), 0);
    const total   = (parseFloat(v.valor||0) + totEnt) * (v.quantidade||1);
    return {
      'Data':               fmtDate(v.data_venda),
      'Vendedora':          v.vendedoras?.nome || '—',
      'Modelo Vendido':     v.modelo_iphone || '—',
      'Aparelhos Entrada':  entradas.length > 0 ? entradas.map(e=>e.modelo).join(' | ') : '—',
      'Vlr Entradas (R$)':  totEnt,
      'Valor Pago (R$)':    parseFloat(v.valor || 0),
      'Quantidade':         v.quantidade || 1,
      'Total (R$)':         total,
      'Observações':        v.observacoes || ''
    };
  });

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
  XLSX.writeFile(wb, `mcell-vendas-${periodo.replace('/','-')}.xlsx`);
  toast('Excel gerado!');
}
