// ═══════════════════════════════════════════════
// MCELL — METAS (com distribuição manual)
// ═══════════════════════════════════════════════

async function renderMetas() {
  if (!isAdmin()) {
    document.getElementById('page-metas').innerHTML =
      `<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito.</p></div>`;
    return;
  }

  const page = document.getElementById('page-metas');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const [todas, vendedorasAtivas, metaAtual, metasInd] = await Promise.all([
      db.getAllMetas(),
      db.getVendedoras(true),
      db.getMeta(currentMes, currentAno),
      db.getMetasIndividuais(currentMes, currentAno)
    ]);

    const metaApar  = metaAtual?.meta_aparelhos || 0;
    const distrib   = await getDistribuicao(metaApar, vendedorasAtivas, metasInd, currentMes, currentAno);

    const statusDistrib = distrib.isFrozen
      ? `<span class="badge badge-yellow" title="Calculado em ${distrib.calculadoEm ? new Date(distrib.calculadoEm).toLocaleString('pt-BR') : ''}">🔒 Fixo</span>`
      : `<span class="badge badge-blue">🔄 Automático</span>`;

    page.innerHTML = `
      <!-- META DO MÊS -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">◎ Meta — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
          <button class="btn-primary btn-sm" id="btn-editar-meta">
            ${metaAtual ? 'Editar Meta' : '+ Definir Meta'}
          </button>
        </div>

        ${metaAtual ? `
          <div class="cards-grid" style="margin-bottom:20px">
            ${cardMeta('Meta Total', fmtNum(metaApar) + ' un.', 'green')}
            ${cardMeta('Vendedores Ativos', vendedorasAtivas.length, 'blue')}
            ${cardMeta('Com meta manual', metasInd.filter(m=>m.is_manual).length, 'yellow')}
            ${cardMeta('Meta auto (cada)', fmtNum(distrib.metaAuto) + ' un.', 'blue')}
          </div>

          <!-- DISTRIBUIÇÃO INDIVIDUAL -->
          <div class="panel-header" style="margin-bottom:0">
            <div class="section-title" style="margin-bottom:0">
              Distribuição Individual ${statusDistrib}
            </div>
            <button class="btn-ghost btn-sm" id="btn-recalcular-meta" title="Recalcula a distribuição com os vendedores ativos atuais">
              🔄 Recalcular
            </button>
          </div>
          <p style="color:var(--text2);font-size:0.78rem;margin:8px 0 16px">
            ${distrib.isFrozen
              ? 'A distribuição está <strong>fixa</strong>. Mudanças no número de vendedores não afetam o cálculo até você clicar em Recalcular.'
              : 'A distribuição ainda não foi fixada — calculando automaticamente. Clique em Recalcular para fixar o resultado atual.'}
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Meta</th>
                  <th>Tipo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${distrib.lista.map(d => `
                  <tr>
                    <td><strong>${d.nome}</strong></td>
                    <td>
                      ${d.isExtra ? `
                        <span style="color:var(--text3);font-size:0.85rem">— sem meta —</span>
                      ` : `
                        <span style="font-family:var(--font-head);font-size:1rem;font-weight:700">
                          ${fmtNum(d.meta)}
                        </span>
                        <span style="color:var(--text2);font-size:0.78rem"> un.</span>
                      `}
                    </td>
                    <td>
                      ${d.isExtra
                        ? '<span class="badge badge-yellow">⭐ Extra</span>'
                        : d.isManual
                          ? '<span class="badge badge-yellow">Manual</span>'
                          : '<span class="badge badge-blue">Automático</span>'}
                    </td>
                    <td>
                      ${d.isExtra ? `
                        <span style="color:var(--text3);font-size:0.8rem">Não participa da meta</span>
                      ` : `
                        <div style="display:flex;gap:6px">
                          <button class="btn-ghost btn-sm btn-meta-manual"
                            data-id="${d.vendedora_id}"
                            data-nome="${d.nome}"
                            data-meta="${d.meta}"
                            data-manual="${d.isManual}">
                            ${d.isManual ? 'Editar' : 'Definir manual'}
                          </button>
                          ${d.isManual ? `
                            <button class="btn-danger btn-sm btn-meta-reset"
                              data-id="${d.vendedora_id}">
                              Resetar
                            </button>` : ''}
                        </div>
                      `}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <p style="color:var(--text2);font-size:0.78rem;margin-top:10px">
            💡 Meta automática = (${fmtNum(metaApar)} total − ${fmtNum(distrib.totalManual)} manuais) ÷ ${distrib.numAuto} vendedoras = ${fmtNum(distrib.metaAuto)} cada
          </p>
        ` : `
          <div class="empty-state">
            <div class="icon">◎</div>
            <p>Nenhuma meta definida para ${mesToNomeCompleto(currentMes)}/${currentAno}.</p>
          </div>
        `}
      </div>

      <!-- HISTÓRICO -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📅 Histórico de Metas</div>
        </div>
        <div class="table-wrap">
          ${renderHistoricoMetas(todas)}
        </div>
      </div>
    `;

    // Editar meta total
    document.getElementById('btn-editar-meta').addEventListener('click', () => {
      abrirFormMeta(metaAtual);
    });

    // Recalcular distribuição (fixa o resultado atual)
    document.getElementById('btn-recalcular-meta')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-recalcular-meta');
      const confirmMsg = distrib.isFrozen
        ? 'Recalcular vai substituir a distribuição fixa atual pelos vendedores ativos agora. Continuar?'
        : 'Fixar a distribuição atual? Ela não mudará mais até você recalcular novamente.';
      if (!confirm(confirmMsg)) return;

      btn.textContent = 'Calculando…';
      btn.disabled = true;
      try {
        const liveCalc = calcDistribuicaoLive(metaApar, vendedorasAtivas, metasInd);
        await db.salvarSnapshot(currentMes, currentAno, liveCalc.lista);
        toast('Distribuição recalculada e fixada!');
        renderMetas();
      } catch (err) {
        toast('Erro: ' + err.message, 'error');
        btn.textContent = '🔄 Recalcular';
        btn.disabled = false;
      }
    });

    // Definir meta manual
    document.querySelectorAll('.btn-meta-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirFormMetaManual(
          btn.dataset.id,
          btn.dataset.nome,
          parseFloat(btn.dataset.meta),
          btn.dataset.manual === 'true'
        );
      });
    });

    // Resetar para automático (também limpa o snapshot fixo dessa pessoa)
    document.querySelectorAll('.btn-meta-reset').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Resetar para distribuição automática? Isso vai recalcular tudo.')) return;
        await db.deleteMetaIndividual(currentMes, currentAno, btn.dataset.id);
        await db.limparSnapshot(currentMes, currentAno);
        toast('Meta resetada — recalculando automaticamente.');
        renderMetas();
      });
    });

    // Histórico editar
    document.querySelectorAll('.btn-edit-meta').forEach(btn => {
      const m = todas.find(x => x.id === btn.dataset.id);
      btn.addEventListener('click', () => abrirFormMeta(m));
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

// ── CÁLCULO DE DISTRIBUIÇÃO (tempo real) ───────
function calcDistribuicaoLive(metaTotal, vendedoras, metasInd) {
  // Proteção contra dados inválidos
  vendedoras = Array.isArray(vendedoras) ? vendedoras : [];
  metasInd   = Array.isArray(metasInd) ? metasInd : [];
  metaTotal  = parseFloat(metaTotal) || 0;

  // Vendedores "extra" não entram no cálculo da meta de forma alguma
  const vendedoresMeta  = vendedoras.filter(v => !v.is_extra);
  const vendedoresExtra = vendedoras.filter(v => v.is_extra);

  // Considera apenas metas manuais de vendedores que estão na lista ativa (não extra)
  const idsAtivos  = new Set(vendedoresMeta.map(v => v.id));
  const manuais    = metasInd.filter(m => m.is_manual && idsAtivos.has(m.vendedora_id));

  const totalManual = manuais.reduce((s, m) => s + parseFloat(m.meta_aparelhos), 0);
  const numAuto      = Math.max(0, vendedoresMeta.length - manuais.length);
  const restante     = Math.max(0, metaTotal - totalManual);
  const metaAuto     = numAuto > 0 ? restante / numAuto : 0;

  const lista = vendedoresMeta.map(v => {
    const ind = manuais.find(m => m.vendedora_id === v.id);
    return {
      vendedora_id: v.id,
      nome:         v.nome,
      meta:         ind ? parseFloat(ind.meta_aparelhos) : metaAuto,
      isManual:     !!ind,
      isExtra:      false
    };
  });

  // Vendedores extra entram na lista mas sem meta nenhuma (null = sem meta aplicável)
  vendedoresExtra.forEach(v => {
    lista.push({
      vendedora_id: v.id,
      nome:         v.nome,
      meta:         null,
      isManual:     false,
      isExtra:      true
    });
  });

  return { lista, totalManual, numAuto, metaAuto: parseFloat(metaAuto.toFixed(2)) };
}

// ── DISTRIBUIÇÃO PRINCIPAL (congelada até recalcular) ──
// Verifica se existe snapshot salvo; se sim, usa ele (fixo).
// Se não existir, calcula em tempo real (live) automaticamente.
async function getDistribuicao(metaTotal, vendedoras, metasInd, mes, ano) {
  try {
    const snapshot = await db.getMetasSnapshot(mes, ano);
    if (snapshot && snapshot.length > 0) {
      // Usa o snapshot congelado — não recalcula mesmo se vendedores mudarem
      const lista = snapshot.map(s => ({
        vendedora_id: s.vendedora_id,
        nome:         s.vendedoras?.nome || vendedoras.find(v=>v.id===s.vendedora_id)?.nome || '—',
        meta:         s.is_extra ? null : parseFloat(s.meta_aparelhos),
        isManual:     s.is_manual,
        isExtra:      s.is_extra
      }));
      const totalManual = lista.filter(l=>l.isManual).reduce((s,l)=>s+l.meta,0);
      const numAuto      = lista.filter(l=>!l.isManual && !l.isExtra).length;
      const metaAuto     = lista.find(l=>!l.isManual && !l.isExtra)?.meta || 0;
      return { lista, totalManual, numAuto, metaAuto, isFrozen: true, calculadoEm: snapshot[0]?.calculado_em };
    }
  } catch (e) {
    console.warn('Snapshot indisponível, usando cálculo live:', e.message);
  }
  // Sem snapshot: calcula em tempo real
  return { ...calcDistribuicaoLive(metaTotal, vendedoras, metasInd), isFrozen: false };
}

// Mantém compatibilidade: calcDistribuicao = versão live (usada como fallback)
function calcDistribuicao(metaTotal, vendedoras, metasInd) {
  return calcDistribuicaoLive(metaTotal, vendedoras, metasInd);
}

// ── HELPERS VISUAIS ────────────────────────────
function cardMeta(label, value, accent) {
  return `
    <div class="card">
      <div class="card-accent ${accent}"></div>
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
    </div>`;
}

function renderHistoricoMetas(metas) {
  if (!metas.length) return `<div class="empty-state"><p>Nenhuma meta cadastrada.</p></div>`;
  const rows = [...metas].reverse().map(m => `
    <tr>
      <td><strong>${mesToNomeCompleto(m.mes)}</strong></td>
      <td>${m.ano}</td>
      <td>${fmtNum(m.meta_aparelhos)} un.</td>
      <td><button class="btn-ghost btn-sm btn-edit-meta" data-id="${m.id}">Editar</button></td>
    </tr>`).join('');

  return `
    <table>
      <thead><tr><th>Mês</th><th>Ano</th><th>Meta Aparelhos</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── FORM META TOTAL ────────────────────────────
function abrirFormMeta(meta) {
  const isEdit = !!meta;
  openModal(`
    <div class="modal-title">${isEdit ? 'Editar' : 'Definir'} Meta</div>
    <div class="modal-subtitle">${mesToNomeCompleto(currentMes)}/${currentAno}</div>
    <form id="form-meta">
      <div class="form-grid">
        <div class="form-group">
          <label>Mês *</label>
          <select id="fm-mes">
            ${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${(meta?.mes||currentMes)===(i+1)?'selected':''}>${mesToNomeCompleto(i+1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Ano *</label>
          <select id="fm-ano">
            ${(() => {
              const anoAtual = new Date().getFullYear();
              const opts = [];
              for (let a = 2026; a <= anoAtual + 1; a++) {
                opts.push(`<option value="${a}" ${(meta?.ano||currentAno)===a?'selected':''}>${a}</option>`);
              }
              return opts.join('');
            })()}
          </select>
        </div>
        <div class="form-group form-full">
          <label>Meta Total de Aparelhos *</label>
          <input type="number" id="fm-apar" min="0" value="${meta?.meta_aparelhos || ''}" placeholder="Ex: 100"/>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-meta">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit ? 'Salvar' : 'Definir Meta'}</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-meta').addEventListener('click', closeModal);
  document.getElementById('form-meta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.textContent = 'Salvando…'; btn.disabled = true;
    try {
      const mesForm = parseInt(document.getElementById('fm-mes').value);
      const anoForm = parseInt(document.getElementById('fm-ano').value);
      await db.upsertMeta({
        ...(isEdit ? { id: meta.id } : {}),
        mes:            mesForm,
        ano:            anoForm,
        meta_aparelhos: parseInt(document.getElementById('fm-apar').value)
      });
      // Mudou a meta total — limpa o snapshot fixo para forçar novo cálculo
      await db.limparSnapshot(mesForm, anoForm);
      toast('Meta salva! Distribuição voltou a ser automática.');
      closeModal();
      renderMetas();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
      btn.textContent = isEdit ? 'Salvar' : 'Definir Meta';
      btn.disabled = false;
    }
  });
}

// ── FORM META MANUAL ───────────────────────────
function abrirFormMetaManual(vendedoraId, nome, metaAtual, isManual) {
  openModal(`
    <div class="modal-title">🎯 Meta Manual</div>
    <div class="modal-subtitle">${nome} — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
    <div class="acesso-info">
      <p>Defina uma meta específica para esta vendedora. O restante será dividido automaticamente entre as demais.</p>
    </div>
    <form id="form-meta-manual">
      <div class="form-group">
        <label>Meta de Aparelhos *</label>
        <input type="number" id="fmm-meta" min="0" step="0.5"
          value="${isManual ? metaAtual : ''}"
          placeholder="Ex: 25"/>
      </div>
      <div id="fmm-error" class="login-error hidden"></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-fmm">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Meta</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-fmm').addEventListener('click', closeModal);
  document.getElementById('form-meta-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('fmm-error');
    const val  = parseFloat(document.getElementById('fmm-meta').value);

    if (isNaN(val) || val < 0) {
      errEl.textContent = 'Informe um valor válido (0 ou maior).';
      errEl.classList.remove('hidden'); return;
    }

    btn.textContent = 'Salvando…'; btn.disabled = true;
    try {
      await db.upsertMetaIndividual({
        mes:            currentMes,
        ano:            currentAno,
        vendedora_id:   vendedoraId,
        meta_aparelhos: val,
        is_manual:      true
      });
      // Meta manual mudou — limpa o snapshot para recalcular automaticamente
      await db.limparSnapshot(currentMes, currentAno);
      toast(`Meta de ${nome} definida: ${fmtNum(val)} aparelhos`);
      closeModal();
      renderMetas();
    } catch (err) {
      errEl.textContent = 'Erro: ' + err.message;
      errEl.classList.remove('hidden');
      btn.textContent = 'Salvar Meta';
      btn.disabled = false;
    }
  });
}

// Exportar função para uso no dashboard e desempenho
async function getMetaIndividual(vendedoraId, mes, ano) {
  try {
    const [meta, vendedoras, metasInd] = await Promise.all([
      db.getMeta(mes, ano),
      db.getVendedoras(true),
      db.getMetasIndividuais(mes, ano)
    ]);
    const metaTotal = meta?.meta_aparelhos || 0;
    const distrib   = calcDistribuicao(metaTotal, vendedoras, metasInd);
    const ind       = distrib.lista.find(d => d.vendedora_id === vendedoraId);
    return ind?.meta || distrib.metaAuto;
  } catch {
    return 0;
  }
}
