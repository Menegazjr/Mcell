// ═══════════════════════════════════════════════
// MCELL — VENDAS
// ═══════════════════════════════════════════════

const MODELOS_IPHONE = [
  'iPhone 17 Pro Max','iPhone 17 Pro','iPhone 17 Plus','iPhone 17',
  'iPhone 16 Pro Max','iPhone 16 Pro','iPhone 16 Plus','iPhone 16',
  'iPhone 15 Pro Max','iPhone 15 Pro','iPhone 15 Plus','iPhone 15',
  'iPhone 14 Pro Max','iPhone 14 Pro','iPhone 14 Plus','iPhone 14',
  'iPhone 13 Pro Max','iPhone 13 Pro','iPhone 13','iPhone 13 Mini',
  'iPhone 12 Pro Max','iPhone 12 Pro','iPhone 12','iPhone 12 Mini',
  'iPhone SE (3ª Geração)','iPhone SE (2ª Geração)',
  'iPhone 11 Pro Max','iPhone 11 Pro','iPhone 11',
  'Outro'
];

const MODELOS_ENTRADA = [
  'iPhone 17 Pro Max','iPhone 17 Pro','iPhone 17 Plus','iPhone 17',
  'iPhone 16 Pro Max','iPhone 16 Pro','iPhone 16 Plus','iPhone 16',
  'iPhone 15 Pro Max','iPhone 15 Pro','iPhone 15 Plus','iPhone 15',
  'iPhone 14 Pro Max','iPhone 14 Pro','iPhone 14 Plus','iPhone 14',
  'iPhone 13 Pro Max','iPhone 13 Pro','iPhone 13','iPhone 13 Mini',
  'iPhone 12 Pro Max','iPhone 12 Pro','iPhone 12','iPhone 12 Mini',
  'iPhone SE (3ª Geração)','iPhone SE (2ª Geração)',
  'iPhone 11 Pro Max','iPhone 11 Pro','iPhone 11',
  'Outro'
];

const modelSelectOptions = MODELOS_IPHONE.map(m => `<option value="${m}">${m}</option>`).join('');
const entradaSelectOptions = MODELOS_ENTRADA.map(m => `<option value="${m}">${m}</option>`).join('');

// Retorna array de entradas normalizado
function getEntradas(v) {
  if (v.entradas && Array.isArray(v.entradas) && v.entradas.length > 0) return v.entradas;
  if (v.aparelho_entrada) return [{ modelo: v.aparelho_entrada, valor: parseFloat(v.valor_entrada||0) }];
  return [];
}

// Total da venda: valor pago + soma das entradas
function calcTotal(v) {
  const pago    = parseFloat(v.valor || 0);
  const entradas = getEntradas(v);
  const totalEntradas = entradas.reduce((s, e) => s + parseFloat(e.valor || 0), 0);
  const qtd   = parseInt(v.quantidade || 1);
  return (pago + totalEntradas) * qtd;
}

// Total só das entradas
function calcTotalEntradas(v) {
  return getEntradas(v).reduce((s, e) => s + parseFloat(e.valor || 0), 0);
}

// ── LISTA DINÂMICA DE ENTRADAS ─────────────────
let _entradas = []; // estado local durante o form

function renderLinhasEntrada() {
  const container = document.getElementById('lista-entradas');
  if (!container) return;

  if (_entradas.length === 0) {
    container.innerHTML = '';
    atualizarResumoEntrada();
    return;
  }

  container.innerHTML = _entradas.map((e, i) => `
    <div class="entrada-linha" data-i="${i}">
      <select class="entrada-modelo-sel" data-i="${i}">
        <option value="">Modelo…</option>
        ${MODELOS_ENTRADA.map(m => `<option value="${m}" ${e.modelo===m?'selected':''}>${m}</option>`).join('')}
      </select>
      <input type="number" class="entrada-valor-inp" data-i="${i}"
        value="${e.valor||''}" step="0.01" min="0" placeholder="R$ valor"/>
      <button type="button" class="btn-danger btn-sm entrada-rem-btn" data-i="${i}">✕</button>
    </div>
  `).join('');

  // Listeners
  container.querySelectorAll('.entrada-modelo-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      _entradas[parseInt(sel.dataset.i)].modelo = sel.value;
      atualizarResumoEntrada();
    });
  });
  container.querySelectorAll('.entrada-valor-inp').forEach(inp => {
    inp.addEventListener('input', () => {
      _entradas[parseInt(inp.dataset.i)].valor = parseFloat(inp.value) || 0;
      atualizarResumoEntrada();
    });
  });
  container.querySelectorAll('.entrada-rem-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _entradas.splice(parseInt(btn.dataset.i), 1);
      renderLinhasEntrada();
    });
  });

  atualizarResumoEntrada();
}

function atualizarResumoEntrada() {
  const pago         = parseFloat(document.getElementById('v-valor')?.value) || 0;
  const totalEntradas = _entradas.reduce((s, e) => s + (parseFloat(e.valor)||0), 0);
  const total        = pago + totalEntradas;
  const temEntrada   = document.getElementById('v-tem-entrada')?.checked;

  const resumo = document.getElementById('entrada-resumo');
  if (!resumo) return;

  if (temEntrada && _entradas.length > 0) {
    resumo.classList.remove('hidden');
    document.getElementById('res-pago').textContent    = fmt(pago);
    document.getElementById('res-entrada').textContent = fmt(totalEntradas);
    document.getElementById('res-total').textContent   = fmt(total);
    const qtdEl = document.getElementById('res-qtd-ent');
    if (qtdEl) qtdEl.textContent = _entradas.length > 1 ? `(${_entradas.length} aparelhos)` : '';
  } else {
    resumo.classList.add('hidden');
  }
}

// ── RENDER PRINCIPAL ───────────────────────────
async function renderVendas() {
  const page = document.getElementById('page-vendas');
  page.innerHTML = `<div class="spinner"></div>`;
  _entradas = [];

  try {
    const [vendedoras, vendas] = await Promise.all([
      db.getVendedoras(true),
      db.getVendas({ mes: currentMes, ano: currentAno })
    ]);

    let vendasFiltradas = vendas;
    let vendedorasOpts  = vendedoras;
    if (!isAdmin()) {
      const vid = getVendedoraId();
      vendasFiltradas = vendas.filter(v => v.vendedora_id === vid);
      vendedorasOpts  = vendedoras.filter(v => v.id === vid);
    }

    const vendOpts = vendedorasOpts.map(v =>
      `<option value="${v.id}">${v.nome}</option>`).join('');

    page.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">➕ Nova Venda</div>
        </div>
        <form id="form-venda" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label>Usuário *</label>
              <select id="v-vendedora" required>
                <option value="">Selecionar…</option>${vendOpts}
              </select>
            </div>
            <div class="form-group">
              <label>Data da Venda *</label>
              <input type="date" id="v-data" required value="${new Date().toISOString().split('T')[0]}"/>
            </div>
            <div class="form-group">
              <label>Modelo do iPhone *</label>
              <select id="v-modelo" required>
                <option value="">Selecionar…</option>${modelSelectOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Valor Pago pelo Cliente (R$) *</label>
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

          <!-- APARELHOS DE ENTRADA -->
          <div class="entrada-toggle">
            <label class="entrada-check-label">
              <input type="checkbox" id="v-tem-entrada"/>
              <span>Cliente tem aparelho(s) de entrada</span>
            </label>
          </div>

          <div id="entrada-fields" class="entrada-fields hidden">
            <div id="lista-entradas"></div>
            <button type="button" class="btn-ghost btn-sm" id="btn-add-entrada"
              style="margin-top:8px;width:100%">
              + Adicionar aparelho de entrada
            </button>
            <div class="entrada-resumo hidden" id="entrada-resumo">
              <span>Valor pago: <strong id="res-pago">—</strong></span>
              <span>+</span>
              <span>Entradas: <strong id="res-entrada">—</strong> <small id="res-qtd-ent"></small></span>
              <span>=</span>
              <span>Total: <strong id="res-total" style="color:var(--blue)">—</strong></span>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary">Registrar Venda</button>
          </div>
        </form>
      </div>

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

    // Toggle entrada
    document.getElementById('v-tem-entrada').addEventListener('change', (e) => {
      document.getElementById('entrada-fields').classList.toggle('hidden', !e.target.checked);
      if (!e.target.checked) { _entradas = []; renderLinhasEntrada(); }
      else if (_entradas.length === 0) {
        _entradas.push({ modelo: '', valor: 0 });
        renderLinhasEntrada();
      }
    });

    // Adicionar linha de entrada
    document.getElementById('btn-add-entrada').addEventListener('click', () => {
      _entradas.push({ modelo: '', valor: 0 });
      renderLinhasEntrada();
    });

    // Atualizar resumo quando valor pago muda
    document.getElementById('v-valor').addEventListener('input', atualizarResumoEntrada);

    // Submit
    document.getElementById('form-venda').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.textContent = 'Salvando…'; btn.disabled = true;

      const temEntrada = document.getElementById('v-tem-entrada').checked;

      if (temEntrada) {
        if (_entradas.length === 0) {
          toast('Adicione pelo menos um aparelho de entrada.', 'error');
          btn.textContent = 'Registrar Venda'; btn.disabled = false; return;
        }
        const invalido = _entradas.find(e => !e.modelo || e.valor <= 0);
        if (invalido) {
          toast('Preencha o modelo e valor de todos os aparelhos de entrada.', 'error');
          btn.textContent = 'Registrar Venda'; btn.disabled = false; return;
        }
      }

      const entradas = temEntrada ? _entradas : [];
      const totalEntradas = entradas.reduce((s,e) => s + e.valor, 0);

      try {
        await db.insertVenda({
          vendedora_id:     document.getElementById('v-vendedora').value,
          data_venda:       document.getElementById('v-data').value,
          modelo_iphone:    document.getElementById('v-modelo').value,
          valor:            parseFloat(document.getElementById('v-valor').value),
          quantidade:       parseInt(document.getElementById('v-qtd').value) || 1,
          observacoes:      document.getElementById('v-obs').value || null,
          // Compatibilidade retroativa
          aparelho_entrada: entradas.length === 1 ? entradas[0].modelo : (entradas.length > 1 ? `${entradas.length} aparelhos` : null),
          valor_entrada:    totalEntradas || 0,
          entradas:         entradas.length > 0 ? entradas : []
        });
        toast('Venda registrada!');
        _entradas = [];
        renderVendas();
      } catch (err) {
        toast('Erro: ' + err.message, 'error');
        btn.textContent = 'Registrar Venda'; btn.disabled = false;
      }
    });

    // Auto-fill vendedora
    if (!isAdmin() && vendedorasOpts.length === 1) {
      document.getElementById('v-vendedora').value = vendedorasOpts[0].id;
    }

    // Editar e excluir
    document.querySelectorAll('.btn-edit-venda').forEach(btn => {
      btn.addEventListener('click', () => {
        const venda = vendasFiltradas.find(v => v.id === btn.dataset.id);
        if (venda) abrirFormEditarVenda(venda, vendedorasOpts);
      });
    });
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

// ── TABELA ─────────────────────────────────────
function renderTabelaVendas(vendas) {
  if (!vendas.length) return `<div class="empty-state"><div class="icon">◫</div><p>Nenhuma venda no período.</p></div>`;

  const rows = vendas.map(v => {
    const entradas       = getEntradas(v);
    const totalEnt       = calcTotalEntradas(v);
    const total          = calcTotal(v);
    const entradaCell    = entradas.length === 0
      ? '<span style="color:var(--text3)">—</span>'
      : entradas.length === 1
        ? `<div style="font-size:0.82rem">${entradas[0].modelo}</div>`
        : `<div style="font-size:0.82rem">${entradas.length} aparelhos</div>
           <div style="font-size:0.72rem;color:var(--text2)">${entradas.map(e=>e.modelo).join(', ')}</div>`;

    return `
    <tr>
      <td>${fmtDate(v.data_venda)}</td>
      <td>${v.vendedoras?.nome || '—'}</td>
      <td>${v.modelo_iphone || '—'}</td>
      <td>${entradaCell}</td>
      <td class="td-mono">${entradas.length > 0 ? `<span style="color:var(--text2)">${fmt(totalEnt)}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
      <td class="td-mono">${fmt(v.valor)}</td>
      <td class="td-mono" style="color:var(--blue);font-weight:600">${fmt(total)}</td>
      <td style="color:var(--text2);font-size:0.8rem">${v.observacoes || '—'}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:nowrap">
          <button class="btn-ghost btn-sm btn-edit-venda" data-id="${v.id}">Editar</button>
          ${isAdmin() ? `<button class="btn-danger btn-sm btn-del-venda" data-id="${v.id}">Excluir</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Data</th><th>Usuário</th><th>Modelo</th>
          <th>Entrada(s)</th><th>Vlr Entradas</th>
          <th>Vlr Pago</th><th>Total</th><th>Obs.</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── EDITAR VENDA ──────────────────────────────
function abrirFormEditarVenda(v, vendedorasOpts) {
  const entradasEdit = getEntradas(v).map(e => ({ ...e })); // cópia
  let _editEntradas  = entradasEdit;

  const vendOpts = vendedorasOpts.map(vd =>
    `<option value="${vd.id}" ${v.vendedora_id===vd.id?'selected':''}>${vd.nome}</option>`).join('');
  const modelOptions = MODELOS_IPHONE.map(m =>
    `<option value="${m}" ${v.modelo_iphone===m?'selected':''}>${m}</option>`).join('');
  const temEntr = _editEntradas.length > 0;

  openModal(`
    <div class="modal-title">✏️ Editar Venda</div>
    <div class="modal-subtitle">${fmtDate(v.data_venda)} — ${v.modelo_iphone}</div>
    <form id="form-edit-venda">
      <div class="form-grid">
        <div class="form-group">
          <label>Usuário *</label>
          <select id="ev-vendedora" ${!isAdmin()?'disabled':''}>${vendOpts}</select>
        </div>
        <div class="form-group">
          <label>Data *</label>
          <input type="date" id="ev-data" value="${v.data_venda}" required/>
        </div>
        <div class="form-group">
          <label>Modelo *</label>
          <select id="ev-modelo" required>${modelOptions}</select>
        </div>
        <div class="form-group">
          <label>Valor Pago (R$) *</label>
          <input type="number" id="ev-valor" step="0.01" min="0" value="${v.valor}" required/>
        </div>
        <div class="form-group">
          <label>Quantidade</label>
          <input type="number" id="ev-qtd" min="1" value="${v.quantidade||1}"/>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <input type="text" id="ev-obs" value="${v.observacoes||''}"/>
        </div>
      </div>

      <div class="entrada-toggle" style="margin-top:12px">
        <label class="entrada-check-label">
          <input type="checkbox" id="ev-tem-entrada" ${temEntr?'checked':''}/>
          <span>Cliente tem aparelho(s) de entrada</span>
        </label>
      </div>
      <div id="ev-entrada-fields" class="entrada-fields ${temEntr?'':'hidden'}">
        <div id="ev-lista-entradas"></div>
        <button type="button" class="btn-ghost btn-sm" id="ev-btn-add"
          style="margin-top:8px;width:100%">+ Adicionar aparelho de entrada</button>
        <div class="entrada-resumo hidden" id="ev-resumo">
          <span>Valor pago: <strong id="ev-res-pago">—</strong></span>
          <span>+</span>
          <span>Entradas: <strong id="ev-res-ent">—</strong></span>
          <span>=</span>
          <span>Total: <strong id="ev-res-total" style="color:var(--blue)">—</strong></span>
        </div>
      </div>

      <div id="ev-error" class="login-error hidden"></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-ev">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Alterações</button>
      </div>
    </form>
  `);

  function renderEditEntradas() {
    const cont = document.getElementById('ev-lista-entradas');
    if (!cont) return;
    cont.innerHTML = _editEntradas.map((e, i) => `
      <div class="entrada-linha" data-i="${i}">
        <select class="ev-modelo-sel" data-i="${i}">
          <option value="">Modelo…</option>
          ${MODELOS_ENTRADA.map(m => `<option value="${m}" ${e.modelo===m?'selected':''}>${m}</option>`).join('')}
        </select>
        <input type="number" class="ev-valor-inp" data-i="${i}"
          value="${e.valor||''}" step="0.01" min="0" placeholder="R$ valor"/>
        <button type="button" class="btn-danger btn-sm ev-rem-btn" data-i="${i}">✕</button>
      </div>`).join('');

    cont.querySelectorAll('.ev-modelo-sel').forEach(sel => sel.addEventListener('change', () => {
      _editEntradas[parseInt(sel.dataset.i)].modelo = sel.value; updateEditResumo();
    }));
    cont.querySelectorAll('.ev-valor-inp').forEach(inp => inp.addEventListener('input', () => {
      _editEntradas[parseInt(inp.dataset.i)].valor = parseFloat(inp.value)||0; updateEditResumo();
    }));
    cont.querySelectorAll('.ev-rem-btn').forEach(btn => btn.addEventListener('click', () => {
      _editEntradas.splice(parseInt(btn.dataset.i), 1); renderEditEntradas();
    }));
    updateEditResumo();
  }

  function updateEditResumo() {
    const pago = parseFloat(document.getElementById('ev-valor')?.value)||0;
    const totEnt = _editEntradas.reduce((s,e)=>s+(parseFloat(e.valor)||0),0);
    const resumo = document.getElementById('ev-resumo');
    if (document.getElementById('ev-tem-entrada')?.checked && _editEntradas.length > 0) {
      resumo?.classList.remove('hidden');
      document.getElementById('ev-res-pago').textContent  = fmt(pago);
      document.getElementById('ev-res-ent').textContent   = fmt(totEnt);
      document.getElementById('ev-res-total').textContent = fmt(pago + totEnt);
    } else resumo?.classList.add('hidden');
  }

  renderEditEntradas();
  document.getElementById('ev-valor').addEventListener('input', updateEditResumo);
  document.getElementById('ev-tem-entrada').addEventListener('change', (e) => {
    document.getElementById('ev-entrada-fields').classList.toggle('hidden', !e.target.checked);
    if (!e.target.checked) { _editEntradas = []; renderEditEntradas(); }
    else if (_editEntradas.length === 0) { _editEntradas.push({modelo:'',valor:0}); renderEditEntradas(); }
  });
  document.getElementById('ev-btn-add').addEventListener('click', () => {
    _editEntradas.push({modelo:'',valor:0}); renderEditEntradas();
  });
  document.getElementById('btn-cancel-ev').addEventListener('click', closeModal);

  document.getElementById('form-edit-venda').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('ev-error');
    const temEntr = document.getElementById('ev-tem-entrada').checked;

    errEl.classList.add('hidden');
    if (temEntr) {
      if (_editEntradas.length === 0) { errEl.textContent='Adicione pelo menos um aparelho de entrada.'; errEl.classList.remove('hidden'); return; }
      const inv = _editEntradas.find(e=>!e.modelo||e.valor<=0);
      if (inv) { errEl.textContent='Preencha modelo e valor de todos os aparelhos.'; errEl.classList.remove('hidden'); return; }
    }

    btn.textContent = 'Salvando…'; btn.disabled = true;
    const entradas = temEntr ? _editEntradas : [];
    const totEnt   = entradas.reduce((s,e)=>s+e.valor,0);

    try {
      const { error } = await _supabase.from('vendas').update({
        vendedora_id:     isAdmin() ? document.getElementById('ev-vendedora').value : v.vendedora_id,
        data_venda:       document.getElementById('ev-data').value,
        modelo_iphone:    document.getElementById('ev-modelo').value,
        valor:            parseFloat(document.getElementById('ev-valor').value),
        quantidade:       parseInt(document.getElementById('ev-qtd').value)||1,
        observacoes:      document.getElementById('ev-obs').value||null,
        aparelho_entrada: entradas.length===1 ? entradas[0].modelo : entradas.length>1 ? `${entradas.length} aparelhos` : null,
        valor_entrada:    totEnt||0,
        entradas:         entradas
      }).eq('id', v.id);
      if (error) throw error;
      toast('Venda atualizada!');
      closeModal();
      renderVendas();
    } catch (err) {
      errEl.textContent = 'Erro: ' + err.message;
      errEl.classList.remove('hidden');
      btn.textContent = 'Salvar Alterações'; btn.disabled = false;
    }
  });
}
