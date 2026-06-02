// ═══════════════════════════════════════════════
// MCELL — VENDAS
// ═══════════════════════════════════════════════

const MODELOS_IPHONE = [
  'iPhone 15 Pro Max','iPhone 15 Pro','iPhone 15 Plus','iPhone 15',
  'iPhone 14 Pro Max','iPhone 14 Pro','iPhone 14 Plus','iPhone 14',
  'iPhone 13 Pro Max','iPhone 13 Pro','iPhone 13','iPhone 13 Mini',
  'iPhone 12 Pro Max','iPhone 12 Pro','iPhone 12','iPhone 12 Mini',
  'iPhone SE (3ª Geração)','iPhone SE (2ª Geração)',
  'iPhone 11 Pro Max','iPhone 11 Pro','iPhone 11',
  'iPhone XS Max','iPhone XS','iPhone XR','iPhone X',
  'Outro'
];

async function renderVendas() {
  const page = document.getElementById('page-vendas');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const [vendedoras, vendas] = await Promise.all([
      db.getVendedoras(true),
      db.getVendas({ mes: currentMes, ano: currentAno })
    ]);

    // Se vendedora (não admin), filtra apenas suas vendas
    let vendasFiltradas = vendas;
    let vendedorasOpts  = vendedoras;
    if (!isAdmin()) {
      const vid = getVendedoraId();
      vendasFiltradas = vendas.filter(v => v.vendedora_id === vid);
      vendedorasOpts  = vendedoras.filter(v => v.id === vid);
    }

    const modelOptions = MODELOS_IPHONE.map(m =>
      `<option value="${m}">${m}</option>`).join('');

    const vendOpts = vendedorasOpts.map(v =>
      `<option value="${v.id}">${v.nome}</option>`).join('');

    page.innerHTML = `
      <!-- FORM -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">➕ Nova Venda</div>
        </div>
        <form id="form-venda" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label>Vendedora *</label>
              <select id="v-vendedora" required>
                <option value="">Selecionar…</option>
                ${vendOpts}
              </select>
            </div>
            <div class="form-group">
              <label>Data da Venda *</label>
              <input type="date" id="v-data" required value="${new Date().toISOString().split('T')[0]}"/>
            </div>
            <div class="form-group">
              <label>Modelo do iPhone *</label>
              <select id="v-modelo" required>
                <option value="">Selecionar…</option>
                ${modelOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Valor da Venda (R$) *</label>
              <input type="number" id="v-valor" step="0.01" min="0" placeholder="0,00" required/>
            </div>
            <div class="form-group">
              <label>Quantidade</label>
              <input type="number" id="v-qtd" min="1" value="1"/>
            </div>
            <div class="form-group">
              <label>Observações</label>
              <input type="text" id="v-obs" placeholder="Opcional…"/>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Registrar Venda</button>
          </div>
        </form>
      </div>

      <!-- TABLE -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📋 Vendas — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
          <span class="badge badge-blue">${vendasFiltradas.length} registros</span>
        </div>
        <div class="table-wrap">
          ${renderTabelaVendas(vendasFiltradas)}
        </div>
      </div>
    `;

    // ── FORM SUBMIT ─────────────────────────────
    document.getElementById('form-venda').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.textContent = 'Salvando…';
      btn.disabled = true;

      try {
        await db.insertVenda({
          vendedora_id: document.getElementById('v-vendedora').value,
          data_venda:   document.getElementById('v-data').value,
          modelo_iphone:document.getElementById('v-modelo').value,
          valor:        parseFloat(document.getElementById('v-valor').value),
          quantidade:   parseInt(document.getElementById('v-qtd').value) || 1,
          observacoes:  document.getElementById('v-obs').value || null
        });
        toast('Venda registrada com sucesso!');
        renderVendas();
      } catch (err) {
        toast('Erro: ' + err.message, 'error');
        btn.textContent = 'Registrar Venda';
        btn.disabled = false;
      }
    });

    // Auto-fill vendedora for non-admin
    if (!isAdmin() && vendedorasOpts.length === 1) {
      document.getElementById('v-vendedora').value = vendedorasOpts[0].id;
    }

    // Delete buttons
    document.querySelectorAll('.btn-del-venda').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta venda?')) return;
        await db.deleteVenda(btn.dataset.id);
        toast('Venda excluída.');
        renderVendas();
      });
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

function renderTabelaVendas(vendas) {
  if (!vendas.length) return `<div class="empty-state"><div class="icon">◫</div><p>Nenhuma venda no período.</p></div>`;
  const rows = vendas.map(v => `
    <tr>
      <td>${fmtDate(v.data_venda)}</td>
      <td>${v.vendedoras?.nome || '—'}</td>
      <td>${v.modelo_iphone || '—'}</td>
      <td>${v.quantidade || 1}</td>
      <td class="td-mono">${fmt(v.valor)}</td>
      <td class="td-mono" style="color:var(--blue)">${fmt((v.valor||0)*(v.quantidade||1))}</td>
      <td style="color:var(--text2);font-size:0.8rem">${v.observacoes || '—'}</td>
      ${isAdmin() ? `<td><button class="btn-danger btn-sm btn-del-venda" data-id="${v.id}">Excluir</button></td>` : ''}
    </tr>`).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Vendedora</th>
          <th>Modelo</th>
          <th>Qtd</th>
          <th>Valor Unit.</th>
          <th>Total</th>
          <th>Obs.</th>
          ${isAdmin() ? '<th></th>' : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
