/* ==========================================================================
   ACQUISTI.JS
   Logica del modulo "Gestione Acquisti": Richieste (RdO) -> RFQ -> Ordine
   confermato -> Registro & Scadenzario. Tutte le viste lavorano sulla stessa
   pratica (vedi store.js): nessun dato viene duplicato o reinserito a mano
   tra una fase e l'altra.
   ========================================================================== */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initAcquisti() {
  loadPratiche();
  resetRichiestaForm();
  switchAcquistiTab('richieste');
}

function switchAcquistiTab(tab) {
  document.querySelectorAll('#view-acquisti .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-acquisti .subview').forEach(v => v.classList.remove('active'));
  document.getElementById('acq-tab-' + tab).classList.add('active');
  document.getElementById('acq-' + tab).classList.add('active');

  if (tab === 'richieste') renderRichiesteTable();
  if (tab === 'rfq') renderRfqSelect();
  if (tab === 'registro') renderOrdiniTable();
  if (tab === 'scadenzario') renderScadenzarioTable();
}

/* --------------------------------------------------------------------------
   TAB 1: RICHIESTE (RdO)
   -------------------------------------------------------------------------- */

const FASE_INFO = {
  richiesta: { label: 'In attesa RFQ', cls: 'badge-neutral' },
  rfq_inviata: { label: 'RFQ inviata', cls: 'badge-info' },
  offerta_ricevuta: { label: 'Offerta ricevuta', cls: 'badge-warning' },
  ordine_confermato: { label: 'Ordine confermato', cls: 'badge-success' }
};

function addArticoloRow(desc = '', qty = 1) {
  const container = document.getElementById('richiesta-articoli-container');
  const rowId = 'art-row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'article-row';
  row.innerHTML = `
    <input type="text" class="art-desc" placeholder="Descrizione articolo / servizio" value="${escapeHtml(desc)}" required>
    <input type="number" min="1" class="art-qty qty-input" placeholder="Qtà" value="${qty}" required>
    <button type="button" class="icon-btn delete" onclick="removeArticoloRow('${rowId}')" title="Rimuovi articolo">✕</button>
  `;
  container.appendChild(row);
}

function removeArticoloRow(rowId) {
  const container = document.getElementById('richiesta-articoli-container');
  if (container.children.length <= 1) {
    alert('La richiesta deve contenere almeno un articolo.');
    return;
  }
  const el = document.getElementById(rowId);
  if (el) el.remove();
}

function handleRichiestaSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('richiesta-edit-id').value;
  const reparto = document.getElementById('richiesta-reparto').value.trim();
  const richiedente = document.getElementById('richiesta-richiedente').value.trim();
  const dataConsegnaRichiesta = document.getElementById('richiesta-consegna').value;

  const articoli = [];
  document.querySelectorAll('#richiesta-articoli-container .article-row').forEach(row => {
    const desc = row.querySelector('.art-desc').value.trim();
    const qty = parseInt(row.querySelector('.art-qty').value) || 1;
    if (desc) articoli.push({ descrizione: desc, quantita: qty });
  });

  if (articoli.length === 0) {
    alert('Inserisci la descrizione di almeno un articolo.');
    return;
  }

  if (editId) {
    updatePratica(editId, { reparto, richiedente, dataConsegnaRichiesta, articoli });
  } else {
    createPratica({ reparto, richiedente, dataConsegnaRichiesta, articoli });
  }

  resetRichiestaForm();
  renderRichiesteTable();
  renderRfqSelect();
}

function resetRichiestaForm() {
  document.getElementById('form-richiesta').reset();
  document.getElementById('richiesta-edit-id').value = '';
  document.getElementById('richiesta-form-title').textContent = "Nuova richiesta d'acquisto";
  const container = document.getElementById('richiesta-articoli-container');
  container.innerHTML = '';
  addArticoloRow();
}

function editRichiesta(id) {
  const p = getPratica(id);
  if (!p) return;
  document.getElementById('richiesta-edit-id').value = p.id;
  document.getElementById('richiesta-reparto').value = p.reparto || '';
  document.getElementById('richiesta-richiedente').value = p.richiedente || '';
  document.getElementById('richiesta-consegna').value = p.dataConsegnaRichiesta || '';
  document.getElementById('richiesta-form-title').textContent = `Modifica ${p.id}`;

  const container = document.getElementById('richiesta-articoli-container');
  container.innerHTML = '';
  if (p.articoli && p.articoli.length) {
    p.articoli.forEach(a => addArticoloRow(a.descrizione, a.quantita));
  } else {
    addArticoloRow();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteRichiesta(id) {
  if (confirm(`Eliminare definitivamente la richiesta ${id}?`)) {
    deletePratica(id);
    renderRichiesteTable();
    renderRfqSelect();
  }
}

function renderRichiesteTable() {
  const tbody = document.getElementById('richieste-table-body');
  const searchTerm = (document.getElementById('richieste-search').value || '').toLowerCase().trim();
  const mostraTutte = document.getElementById('richieste-mostra-tutte').checked;

  const rows = pratiche
    .filter(p => mostraTutte || p.fase !== FASE.ORDINE_CONFERMATO)
    .filter(p => {
      if (!searchTerm) return true;
      const haystack = [p.id, p.reparto, p.richiedente, articoliDescrizione(p.articoli)].join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });

  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Nessuna richiesta trovata.</td></tr>`;
    return;
  }

  rows.forEach(p => {
    const fi = FASE_INFO[p.fase] || FASE_INFO.richiesta;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700; color: var(--accent);">${p.id}</td>
      <td>${p.reparto || '-'} ${p.richiedente ? `<span class="sub-info">${p.richiedente}</span>` : ''}</td>
      <td>${articoliDescrizione(p.articoli)}</td>
      <td class="text-center">${p.dataConsegnaRichiesta || '-'}</td>
      <td class="text-center"><span class="badge ${fi.cls}">${fi.label}</span></td>
      <td class="text-center">
        ${p.fase !== FASE.ORDINE_CONFERMATO ? `<button class="icon-btn" title="Vai a RFQ" onclick="goToRfq('${p.id}')">→ RFQ</button>` : ''}
        ${p.offertaRicevuta && p.fase !== FASE.ORDINE_CONFERMATO ? `<button class="icon-btn" title="Conferma Ordine" onclick="openConfermaOrdineModal('${p.id}')">✓ Ordine</button>` : ''}
        <button class="icon-btn edit" title="Modifica" onclick="editRichiesta('${p.id}')">✏️</button>
        <button class="icon-btn delete" title="Elimina" onclick="deleteRichiesta('${p.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* Excel: template, export, import (Richieste) */

function downloadRichiesteTemplate() {
  const templateData = [{
    'Rif. Richiesta (raggruppa più articoli)': '1',
    'Reparto': 'Produzione',
    'Richiedente': 'M. Rossi',
    'Data Consegna Desiderata (AAAA-MM-GG)': '2026-09-30',
    'Descrizione Articolo': 'Materiale di prova',
    'Quantità': 10
  }];
  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Richieste');
  XLSX.writeFile(wb, 'Template_Richieste_Acquisto.xlsx');
}

function exportRichiesteToExcel() {
  const rows = [];
  pratiche.forEach(p => {
    const fi = FASE_INFO[p.fase] || FASE_INFO.richiesta;
    (p.articoli || []).forEach(a => {
      rows.push({
        'ID Richiesta': p.id, 'Reparto': p.reparto || '', 'Richiedente': p.richiedente || '',
        'Data Consegna Desiderata': p.dataConsegnaRichiesta || '',
        'Descrizione Articolo': a.descrizione, 'Quantità': a.quantita, 'Stato': fi.label
      });
    });
  });
  if (rows.length === 0) {
    alert('Nessuna richiesta presente da esportare.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Richieste');
  XLSX.writeFile(wb, `Archivio_Richieste_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function openRichiesteImportModal() {
  document.getElementById('richieste-import-summary').textContent = '';
  document.getElementById('richieste-import-file-input').value = '';
  document.getElementById('modal-import-richieste').classList.add('active');
}

function closeRichiesteImportModal() {
  document.getElementById('modal-import-richieste').classList.remove('active');
}

function handleRichiesteImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        alert('Il file Excel caricato è vuoto.');
        return;
      }

      const groups = new Map();
      rows.forEach((row, idx) => {
        const desc = row['Descrizione Articolo'] || '';
        if (!desc) return;

        let rif = String(row['Rif. Richiesta (raggruppa più articoli)'] || row['Rif. Richiesta'] || row['ID Richiesta'] || '').trim();
        if (!rif) rif = '__riga_' + idx;

        if (!groups.has(rif)) {
          let dataConsegna = row['Data Consegna Desiderata (AAAA-MM-GG)'] || row['Data Consegna Desiderata'] || '';
          if (dataConsegna instanceof Date) dataConsegna = dataConsegna.toISOString().slice(0, 10);
          groups.set(rif, {
            reparto: String(row['Reparto'] || ''),
            richiedente: String(row['Richiedente'] || ''),
            dataConsegnaRichiesta: String(dataConsegna),
            articoli: []
          });
        }
        groups.get(rif).articoli.push({ descrizione: String(desc), quantita: parseInt(row['Quantità'] || 1) || 1 });
      });

      let added = 0;
      groups.forEach(g => { if (g.articoli.length) { createPratica(g); added++; } });

      renderRichiesteTable();
      renderRfqSelect();
      document.getElementById('richieste-import-summary').innerHTML =
        `<span style="color:var(--success);">Importazione completata: ${added} richieste aggiunte.</span>`;
      setTimeout(closeRichiesteImportModal, 1500);
    } catch (err) {
      console.error(err);
      alert('Errore durante la lettura del file Excel. Verifica che sia un .xlsx valido.');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* --------------------------------------------------------------------------
   TAB 2: RFQ
   -------------------------------------------------------------------------- */

function renderRfqSelect() {
  const select = document.getElementById('rfq-select');
  const openPratiche = pratiche.filter(p => p.fase !== FASE.ORDINE_CONFERMATO);
  const prevValue = select.value;

  select.innerHTML = openPratiche.length
    ? openPratiche.map(p => `<option value="${p.id}">${p.id} — ${escapeHtml(articoliDescrizione(p.articoli))}</option>`).join('')
    : '<option value="">Nessuna richiesta disponibile</option>';

  if (openPratiche.some(p => p.id === prevValue)) select.value = prevValue;
  onRfqSelectChange();
  renderRfqTable();
}

function renderRfqTable() {
  const tbody = document.getElementById('rfq-registry-table-body');
  const searchTerm = (document.getElementById('rfq-table-search').value || '').toLowerCase().trim();

  const rows = pratiche
    .filter(p => p.fase !== FASE.ORDINE_CONFERMATO)
    .filter(p => {
      if (!searchTerm) return true;
      const haystack = [p.id, p.fornitore, p.fornitoreEmail, articoliDescrizione(p.articoli)].join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });

  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Nessuna RFQ in sospeso.</td></tr>`;
    return;
  }

  const rfqFaseInfo = {
    richiesta: { label: 'In attesa di invio RFQ', cls: 'badge-neutral' },
    rfq_inviata: { label: 'RFQ inviata', cls: 'badge-info' },
    offerta_ricevuta: { label: 'Offerta ricevuta', cls: 'badge-warning' }
  };

  rows.forEach(p => {
    const fi = rfqFaseInfo[p.fase] || rfqFaseInfo.richiesta;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700; color: var(--accent);">${p.id}</td>
      <td>${p.fornitore || '-'} ${p.fornitoreEmail ? `<span class="sub-info">${p.fornitoreEmail}</span>` : ''}</td>
      <td>${articoliDescrizione(p.articoli)}</td>
      <td class="text-center"><span class="badge ${fi.cls}">${fi.label}</span></td>
      <td class="text-center"><button class="icon-btn" title="Seleziona nel modulo sopra" onclick="selectRfqRow('${p.id}')">Seleziona</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function selectRfqRow(id) {
  document.getElementById('rfq-select').value = id;
  onRfqSelectChange();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onRfqSelectChange() {
  const id = document.getElementById('rfq-select').value;
  const p = getPratica(id);
  const badge = document.getElementById('rfq-status-badge');

  if (!p) {
    document.getElementById('rfq-fornitore').value = '';
    document.getElementById('rfq-email').value = '';
    document.getElementById('rfq-note').value = '';
    badge.innerHTML = '';
    renderRfqPreview();
    return;
  }

  document.getElementById('rfq-fornitore').value = p.fornitore || '';
  document.getElementById('rfq-email').value = p.fornitoreEmail || '';
  document.getElementById('rfq-note').value = p.rfqNote || '';

  const rfqFaseInfo = {
    richiesta: { label: 'In attesa di invio RFQ', cls: 'badge-neutral' },
    rfq_inviata: { label: 'RFQ inviata, in attesa di offerta', cls: 'badge-info' },
    offerta_ricevuta: { label: 'Offerta ricevuta', cls: 'badge-warning' },
    ordine_confermato: { label: 'Ordine confermato', cls: 'badge-success' }
  };
  const fi = rfqFaseInfo[p.fase] || rfqFaseInfo.richiesta;
  badge.innerHTML = `<span class="badge ${fi.cls}">${fi.label}</span>`;

  renderRfqPreview();
}

function saveRfqFieldsAndPreview() {
  const id = document.getElementById('rfq-select').value;
  if (!id) return;
  updatePratica(id, {
    fornitore: document.getElementById('rfq-fornitore').value,
    fornitoreEmail: document.getElementById('rfq-email').value,
    rfqNote: document.getElementById('rfq-note').value
  });
  renderRfqPreview();
}

function renderRfqPreview() {
  const id = document.getElementById('rfq-select').value;
  const box = document.getElementById('rfq-preview-content');
  const p = getPratica(id);

  if (!p) {
    box.textContent = "Seleziona una richiesta per generare l'anteprima.";
    return;
  }

  const vendor = p.fornitore || '[Nome Fornitore]';
  const email = p.fornitoreEmail || '[Email Fornitore]';
  const notes = p.rfqNote || 'Nessuna nota aggiuntiva.';
  const articoliText = p.articoli.map((a, i) => `${i + 1}. ${a.descrizione} - Quantità: ${a.quantita}`).join('\n');

  box.textContent =
`A: ${vendor} <${email}>
Oggetto: Richiesta Preventivo - Rif. ${p.id}

Spett.le ${vendor},

Vi chiediamo di inviarci la Vostra migliore offerta per i seguenti articoli:

--------------------------------------------------
Rif. Richiesta: ${p.id}
Data Consegna Desiderata: ${p.dataConsegnaRichiesta || 'da definire'}

ARTICOLI:
${articoliText}
--------------------------------------------------

Note / Condizioni:
${notes}

Cordiali Saluti,
Ufficio Acquisti`;
}

function copyRfqEmail() {
  const text = document.getElementById('rfq-preview-content').textContent;
  navigator.clipboard.writeText(text);
  alert('Testo copiato negli appunti!');
}

function markRfqInviata() {
  const id = document.getElementById('rfq-select').value;
  if (!id) return;
  const p = getPratica(id);
  updatePratica(id, { rfqInviata: true, fase: p.fase === FASE.RICHIESTA ? FASE.RFQ_INVIATA : p.fase });
  renderRichiesteTable();
  renderRfqSelect();
}

function markOffertaRicevuta() {
  const id = document.getElementById('rfq-select').value;
  if (!id) return;
  updatePratica(id, { offertaRicevuta: true, fase: FASE.OFFERTA_RICEVUTA });
  renderRichiesteTable();
  renderRfqSelect();
  switchAcquistiTab('registro');
  openConfermaOrdineModal(id);
}

function goToRfq(id) {
  switchAcquistiTab('rfq');
  const select = document.getElementById('rfq-select');
  select.value = id;
  onRfqSelectChange();
}

/* Excel: template, export, import (RFQ) */

function buildRfqExportRows() {
  return pratiche.filter(p => p.fase !== FASE.ORDINE_CONFERMATO).map(p => ({
    'ID Richiesta': p.id, 'Fornitore': p.fornitore || '', 'Email Fornitore': p.fornitoreEmail || '',
    'Note': p.rfqNote || '', 'RFQ Inviata (SI/NO)': p.rfqInviata ? 'SI' : 'NO',
    'Offerta Ricevuta (SI/NO)': p.offertaRicevuta ? 'SI' : 'NO'
  }));
}

function downloadRfqTemplate() {
  const rows = buildRfqExportRows();
  if (rows.length === 0) {
    rows.push({ 'ID Richiesta': 'PA-2026-001', 'Fornitore': 'Fornitore Esempio S.p.A.', 'Email Fornitore': 'ordini@fornitore.it', 'Note': '', 'RFQ Inviata (SI/NO)': 'NO', 'Offerta Ricevuta (SI/NO)': 'NO' });
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template RFQ');
  XLSX.writeFile(wb, 'Template_RFQ_da_compilare.xlsx');
}

function exportRfqToExcel() {
  const rows = buildRfqExportRows();
  if (rows.length === 0) {
    alert('Nessuna RFQ in sospeso da esportare.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RFQ in sospeso');
  XLSX.writeFile(wb, `Archivio_RFQ_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function openRfqImportModal() {
  document.getElementById('rfq-import-summary').textContent = '';
  document.getElementById('rfq-import-file-input').value = '';
  document.getElementById('modal-import-rfq').classList.add('active');
}

function closeRfqImportModal() {
  document.getElementById('modal-import-rfq').classList.remove('active');
}

function handleRfqImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        alert('Il file Excel caricato è vuoto.');
        return;
      }

      let updated = 0, notFound = 0;
      rows.forEach(row => {
        const id = String(row['ID Richiesta'] || '').trim();
        if (!id) return;
        const p = getPratica(id);
        if (!p || p.fase === FASE.ORDINE_CONFERMATO) { notFound++; return; }

        const rfqInviata = String(row['RFQ Inviata (SI/NO)'] || '').toUpperCase().startsWith('S');
        const offertaRicevuta = String(row['Offerta Ricevuta (SI/NO)'] || '').toUpperCase().startsWith('S');

        let fase = p.fase;
        if (offertaRicevuta) fase = FASE.OFFERTA_RICEVUTA;
        else if (rfqInviata && fase === FASE.RICHIESTA) fase = FASE.RFQ_INVIATA;

        updatePratica(id, {
          fornitore: String(row['Fornitore'] || p.fornitore || ''),
          fornitoreEmail: String(row['Email Fornitore'] || p.fornitoreEmail || ''),
          rfqNote: String(row['Note'] || p.rfqNote || ''),
          rfqInviata: rfqInviata || p.rfqInviata,
          offertaRicevuta: offertaRicevuta || p.offertaRicevuta,
          fase
        });
        updated++;
      });

      renderRichiesteTable();
      renderRfqSelect();
      document.getElementById('rfq-import-summary').innerHTML =
        `<span style="color:var(--success);">Aggiornate ${updated} RFQ.</span>` +
        (notFound ? ` <span style="color:var(--warning);">${notFound} righe ignorate (ID non trovato o già ordine confermato).</span>` : '');
      setTimeout(closeRfqImportModal, 2000);
    } catch (err) {
      console.error(err);
      alert('Errore durante la lettura del file Excel. Verifica che sia un .xlsx valido.');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* --------------------------------------------------------------------------
   Conferma Ordine (passaggio da pratica a ordine tracciato)
   -------------------------------------------------------------------------- */

function openConfermaOrdineModal(id) {
  const p = getPratica(id);
  if (!p) return;
  document.getElementById('conferma-pratica-id').value = id;
  document.getElementById('conferma-riepilogo').textContent =
    `${p.id} — ${p.fornitore || 'fornitore non specificato'} — ${articoliDescrizione(p.articoli)}`;
  document.getElementById('conferma-rda').value = '';
  document.getElementById('conferma-oda').value = '';
  document.getElementById('conferma-ddt').value = '';
  document.getElementById('conferma-data-ordine').value = new Date().toISOString().split('T')[0];
  document.getElementById('conferma-data-consegna').value = p.dataConsegnaRichiesta || '';
  document.getElementById('conferma-max-ritardo').value = 0;
  document.getElementById('conferma-qty').value = sommaQuantitaArticoli(p.articoli) || 1;
  document.getElementById('conferma-price').value = '';
  document.getElementById('conferma-transport').value = '0.00';
  document.getElementById('modal-conferma-ordine').classList.add('active');
}

function closeConfermaOrdineModal() {
  document.getElementById('modal-conferma-ordine').classList.remove('active');
}

function handleConfermaOrdineSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('conferma-pratica-id').value;
  updatePratica(id, {
    fase: FASE.ORDINE_CONFERMATO,
    codeRDA: document.getElementById('conferma-rda').value.trim(),
    codeODA: document.getElementById('conferma-oda').value.trim(),
    codeDDT: document.getElementById('conferma-ddt').value.trim(),
    dataOrdine: document.getElementById('conferma-data-ordine').value,
    dataConsegnaPrevista: document.getElementById('conferma-data-consegna').value,
    maxDelayDays: parseInt(document.getElementById('conferma-max-ritardo').value) || 0,
    qty: parseInt(document.getElementById('conferma-qty').value) || 0,
    price: parseFloat(document.getElementById('conferma-price').value) || 0,
    transport: parseFloat(document.getElementById('conferma-transport').value) || 0,
    stages: { inviato: true, confermato: true, spedito: false, consegnato: false }
  });
  closeConfermaOrdineModal();
  renderRichiesteTable();
  renderRfqSelect();
  switchAcquistiTab('registro');
}

/* --------------------------------------------------------------------------
   TAB 3: REGISTRO ORDINI
   -------------------------------------------------------------------------- */

function handleManualOrderSubmit(e) {
  e.preventDefault();

  const fornitore = document.getElementById('manual-fornitore').value.trim();
  const descrizione = document.getElementById('manual-descrizione').value.trim();
  const dataConsegna = document.getElementById('manual-data-consegna').value;
  const qty = parseInt(document.getElementById('manual-qty').value) || 1;

  const pratica = {
    id: nextPraticaId(),
    createdAt: new Date().toISOString().split('T')[0],
    fase: FASE.ORDINE_CONFERMATO,
    reparto: document.getElementById('manual-reparto').value.trim(),
    richiedente: document.getElementById('manual-referente').value.trim(),
    dataConsegnaRichiesta: dataConsegna,
    articoli: [{ descrizione, quantita: qty }],
    fornitore, fornitoreEmail: '', rfqNote: '',
    codeRDA: document.getElementById('manual-rda').value.trim(),
    codeODA: document.getElementById('manual-oda').value.trim(),
    codeDDT: document.getElementById('manual-ddt').value.trim(),
    dataOrdine: document.getElementById('manual-data-ordine').value,
    dataConsegnaPrevista: dataConsegna,
    maxDelayDays: parseInt(document.getElementById('manual-max-ritardo').value) || 0,
    qty,
    price: parseFloat(document.getElementById('manual-price').value) || 0,
    transport: parseFloat(document.getElementById('manual-transport').value) || 0,
    archived: false,
    stages: { inviato: true, confermato: false, spedito: false, consegnato: false }
  };

  pratiche.unshift(pratica);
  savePratiche();
  renderOrdiniTable();
  renderScadenzarioTable();

  document.getElementById('form-manual-ordine').reset();
  document.getElementById('manual-qty').value = '1';
  document.getElementById('manual-transport').value = '0.00';
  document.getElementById('manual-max-ritardo').value = '0';
}

function toggleStage(id, key) {
  const p = getPratica(id);
  if (!p) return;
  p.stages[key] = !p.stages[key];

  if (key === 'consegnato') {
    if (p.stages.consegnato) {
      p.stages.inviato = true; p.stages.confermato = true; p.stages.spedito = true;
      p.archived = true;
    } else {
      p.archived = false;
    }
  }
  if (key === 'spedito' && p.stages.spedito) { p.stages.inviato = true; p.stages.confermato = true; }
  if (key === 'confermato' && p.stages.confermato) { p.stages.inviato = true; }

  savePratiche();
  renderOrdiniTable();
  renderScadenzarioTable();
}

function renderOrdiniTable() {
  const tbody = document.getElementById('ordini-table-body');
  const searchTerm = (document.getElementById('ordini-search').value || '').toLowerCase().trim();
  const archiveFilter = document.getElementById('ordini-archive-filter').value;

  let totalQty = 0, totalItems = 0, totalTransport = 0, delayedCount = 0;

  const ordini = pratiche
    .filter(p => p.fase === FASE.ORDINE_CONFERMATO)
    .map(p => { p.archived = !!p.stages.consegnato; return p; })
    .filter(p => {
      if (archiveFilter === 'active' && p.archived) return false;
      if (archiveFilter === 'archived' && !p.archived) return false;
      if (!searchTerm) return true;
      const haystack = [p.codeRDA, p.codeODA, p.codeDDT, p.fornitore, p.reparto, p.richiedente,
        articoliDescrizione(p.articoli), p.dataOrdine, p.dataConsegnaPrevista].join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });

  tbody.innerHTML = '';
  if (ordini.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="13">Nessun ordine trovato.</td></tr>`;
  } else {
    ordini.forEach(p => {
      const subtotal = (p.qty || 0) * (p.price || 0);
      const total = subtotal + (p.transport || 0);
      totalQty += parseInt(p.qty || 0);
      totalItems += subtotal;
      totalTransport += parseFloat(p.transport || 0);
      const status = checkDelayStatus(p);
      if (status.isDelayed) delayedCount++;

      const tr = document.createElement('tr');
      if (p.archived) tr.classList.add('row-archived');
      tr.innerHTML = `
        <td class="text-center">
          ${p.codeRDA ? `<span class="sub-info">RDA: <strong>${p.codeRDA}</strong></span>` : ''}
          ${p.codeODA ? `<span class="sub-info">ODA: <strong>${p.codeODA}</strong></span>` : ''}
          ${p.codeDDT ? `<span class="sub-info">DDT: <strong>${p.codeDDT}</strong></span>` : ''}
          ${!p.codeRDA && !p.codeODA && !p.codeDDT ? '-' : ''}
        </td>
        <td style="font-weight:600; color: var(--ink);">${p.fornitore || '-'}</td>
        <td>${p.reparto || '-'} ${p.richiedente ? `<span class="sub-info">Ref: ${p.richiedente}</span>` : ''}</td>
        <td>${articoliDescrizione(p.articoli)}</td>
        <td class="text-center">${p.dataOrdine || '-'}<span class="sub-info">Cons: <strong>${p.dataConsegnaPrevista || '-'}</strong></span></td>
        <td class="text-center">${p.maxDelayDays || 0} gg</td>
        <td class="text-right">${p.qty}</td>
        <td class="text-right">${formatCurrency(p.price)}</td>
        <td class="text-right">${formatCurrency(p.transport)}</td>
        <td class="text-right" style="font-weight:700; color: var(--accent);">${formatCurrency(total)}</td>
        <td>
          <div class="stage-checklist">
            <label class="stage-chip ${p.stages.inviato ? 'completed' : ''}"><input type="checkbox" ${p.stages.inviato ? 'checked' : ''} onchange="toggleStage('${p.id}','inviato')"> Inv.</label>
            <label class="stage-chip ${p.stages.confermato ? 'completed' : ''}"><input type="checkbox" ${p.stages.confermato ? 'checked' : ''} onchange="toggleStage('${p.id}','confermato')"> Conf.</label>
            <label class="stage-chip ${p.stages.spedito ? 'completed' : ''}"><input type="checkbox" ${p.stages.spedito ? 'checked' : ''} onchange="toggleStage('${p.id}','spedito')"> Sped.</label>
            <label class="stage-chip ${p.stages.consegnato ? 'completed' : ''}"><input type="checkbox" ${p.stages.consegnato ? 'checked' : ''} onchange="toggleStage('${p.id}','consegnato')"> Cons.</label>
          </div>
        </td>
        <td class="text-center"><span class="badge ${status.class}">${status.label}</span></td>
        <td class="text-center">
          <button class="icon-btn edit" title="Modifica ordine" onclick="openEditOrdineModal('${p.id}')">✏️</button>
          <button class="icon-btn delete" title="Elimina ordine" onclick="deleteOrdine('${p.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const grandTotal = totalItems + totalTransport;
  document.getElementById('ordini-total-qty').textContent = totalQty;
  document.getElementById('ordini-total-items').textContent = formatCurrency(totalItems);
  document.getElementById('ordini-total-transport').textContent = formatCurrency(totalTransport);
  document.getElementById('ordini-grand-total').textContent = formatCurrency(grandTotal);

  document.getElementById('stat-ordini-count').textContent = ordini.length;
  document.getElementById('stat-ordini-delayed').textContent = delayedCount;
  document.getElementById('stat-ordini-subtotal').textContent = formatCurrency(totalItems);
  document.getElementById('stat-ordini-transport').textContent = formatCurrency(totalTransport);
  document.getElementById('stat-ordini-total').textContent = formatCurrency(grandTotal);
}

function resetOrdiniFilters() {
  document.getElementById('ordini-search').value = '';
  document.getElementById('ordini-archive-filter').value = 'active';
  renderOrdiniTable();
}

function openEditOrdineModal(id) {
  const p = getPratica(id);
  if (!p) return;
  document.getElementById('edit-ordine-id').value = p.id;
  document.getElementById('edit-fornitore').value = p.fornitore || '';
  document.getElementById('edit-reparto').value = p.reparto || '';
  document.getElementById('edit-referente').value = p.richiedente || '';
  document.getElementById('edit-rda').value = p.codeRDA || '';
  document.getElementById('edit-oda').value = p.codeODA || '';
  document.getElementById('edit-ddt').value = p.codeDDT || '';
  document.getElementById('edit-descrizione').value = articoliDescrizione(p.articoli);
  document.getElementById('edit-data-ordine').value = p.dataOrdine || '';
  document.getElementById('edit-data-consegna').value = p.dataConsegnaPrevista || '';
  document.getElementById('edit-max-ritardo').value = p.maxDelayDays || 0;
  document.getElementById('edit-qty').value = p.qty || 1;
  document.getElementById('edit-price').value = p.price || 0;
  document.getElementById('edit-transport').value = p.transport || 0;
  document.getElementById('modal-edit-ordine').classList.add('active');
}

function closeEditOrdineModal() {
  document.getElementById('modal-edit-ordine').classList.remove('active');
}

function handleEditOrdineSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-ordine-id').value;
  updatePratica(id, {
    fornitore: document.getElementById('edit-fornitore').value.trim(),
    reparto: document.getElementById('edit-reparto').value.trim(),
    richiedente: document.getElementById('edit-referente').value.trim(),
    codeRDA: document.getElementById('edit-rda').value.trim(),
    codeODA: document.getElementById('edit-oda').value.trim(),
    codeDDT: document.getElementById('edit-ddt').value.trim(),
    dataOrdine: document.getElementById('edit-data-ordine').value,
    dataConsegnaPrevista: document.getElementById('edit-data-consegna').value,
    maxDelayDays: parseInt(document.getElementById('edit-max-ritardo').value) || 0,
    qty: parseInt(document.getElementById('edit-qty').value) || 0,
    price: parseFloat(document.getElementById('edit-price').value) || 0,
    transport: parseFloat(document.getElementById('edit-transport').value) || 0
  });
  closeEditOrdineModal();
  renderOrdiniTable();
  renderScadenzarioTable();
}

function deleteOrdine(id) {
  if (confirm('Sei sicuro di voler eliminare questo ordine? La pratica verrà rimossa definitivamente.')) {
    deletePratica(id);
    renderOrdiniTable();
    renderScadenzarioTable();
  }
}

/* Excel: template, export, import (Registro Ordini) */

function downloadOrderTemplate() {
  const templateData = [{
    'RDA': '3Z-99001', 'ODA': '3A-88001', 'DDT': '4A-77001',
    'Fornitore': 'Fornitore Esempio S.p.A.', 'Reparto': 'Produzione', 'Referente': 'Ing. Bianchi',
    'Descrizione Articolo': 'Materiale di prova', 'Data Ordine (AAAA-MM-GG)': '2026-03-01',
    'Data Consegna Prevista (AAAA-MM-GG)': '2026-03-15', 'GG Max Ritardo Tollerati': 3,
    'Quantità': 10, 'Prezzo Unitario (€)': 150.00, 'Costo Trasporto (€)': 25.00
  }];
  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Ordini');
  XLSX.writeFile(wb, 'Template_Caricamento_Ordini.xlsx');
}

function exportOrdersToExcel() {
  const ordini = pratiche.filter(p => p.fase === FASE.ORDINE_CONFERMATO);
  if (ordini.length === 0) {
    alert('Nessun ordine presente nel registro da esportare.');
    return;
  }
  const data = ordini.map(p => {
    const subtotal = (p.qty || 0) * (p.price || 0);
    const total = subtotal + (p.transport || 0);
    const status = checkDelayStatus(p);
    return {
      'ID Pratica': p.id, 'RDA': p.codeRDA || '', 'ODA': p.codeODA || '', 'DDT': p.codeDDT || '',
      'Fornitore': p.fornitore || '', 'Reparto': p.reparto || '', 'Referente': p.richiedente || '',
      'Descrizione Articoli': articoliDescrizione(p.articoli),
      'Data Ordine': p.dataOrdine || '', 'Data Consegna Prevista': p.dataConsegnaPrevista || '',
      'GG Max Ritardo': p.maxDelayDays || 0, 'Quantità': p.qty, 'Prezzo Unitario (€)': p.price,
      'Subtotale Merci (€)': subtotal, 'Costo Trasporto (€)': p.transport, 'Totale Ordine (€)': total,
      'Inviato': p.stages.inviato ? 'SÌ' : 'NO', 'Confermato': p.stages.confermato ? 'SÌ' : 'NO',
      'Spedito': p.stages.spedito ? 'SÌ' : 'NO', 'Consegnato': p.stages.consegnato ? 'SÌ' : 'NO',
      'Archiviato': p.archived ? 'SÌ' : 'NO', 'Stato': status.label
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Archivio Ordini');
  XLSX.writeFile(wb, `Archivio_Ordini_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function openImportModal() {
  document.getElementById('import-summary').textContent = '';
  document.getElementById('import-file-input').value = '';
  document.getElementById('modal-import').classList.add('active');
}

function closeImportModal() {
  document.getElementById('modal-import').classList.remove('active');
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        alert('Il file Excel caricato è vuoto.');
        return;
      }

      let added = 0;
      rows.forEach(row => {
        const fornitore = row['Fornitore'] || '';
        const desc = row['Descrizione Articolo'] || row['Descrizione Articoli'] || '';
        if (!fornitore || !desc) return;

        let dataOrdine = row['Data Ordine (AAAA-MM-GG)'] || row['Data Ordine'] || new Date().toISOString().slice(0, 10);
        let dataConsegna = row['Data Consegna Prevista (AAAA-MM-GG)'] || row['Data Consegna Prevista'] || new Date().toISOString().slice(0, 10);
        if (dataOrdine instanceof Date) dataOrdine = dataOrdine.toISOString().slice(0, 10);
        if (dataConsegna instanceof Date) dataConsegna = dataConsegna.toISOString().slice(0, 10);

        const isDelivered = String(row['Consegnato'] || '').toUpperCase().startsWith('S');
        const qty = parseInt(row['Quantità'] || 1) || 1;

        const pratica = {
          id: nextPraticaId(),
          createdAt: new Date().toISOString().split('T')[0],
          fase: FASE.ORDINE_CONFERMATO,
          reparto: String(row['Reparto'] || ''),
          richiedente: String(row['Referente'] || ''),
          dataConsegnaRichiesta: String(dataConsegna),
          articoli: [{ descrizione: String(desc), quantita: qty }],
          fornitore: String(fornitore), fornitoreEmail: '', rfqNote: '',
          codeRDA: String(row['RDA'] || ''), codeODA: String(row['ODA'] || ''), codeDDT: String(row['DDT'] || ''),
          dataOrdine: String(dataOrdine), dataConsegnaPrevista: String(dataConsegna),
          maxDelayDays: parseInt(row['GG Max Ritardo'] || 0) || 0,
          qty, price: parseFloat(row['Prezzo Unitario (€)'] || 0) || 0,
          transport: parseFloat(row['Costo Trasporto (€)'] || 0) || 0,
          archived: isDelivered,
          stages: { inviato: true, confermato: isDelivered, spedito: isDelivered, consegnato: isDelivered }
        };
        pratiche.unshift(pratica);
        added++;
      });

      savePratiche();
      renderOrdiniTable();
      renderScadenzarioTable();
      document.getElementById('import-summary').innerHTML =
        `<span style="color:var(--success);">Importazione completata: ${added} ordini aggiunti.</span>`;
      setTimeout(closeImportModal, 1500);
    } catch (err) {
      console.error(err);
      alert('Errore durante la lettura del file Excel. Verifica che sia un .xlsx valido.');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* --------------------------------------------------------------------------
   TAB 4: SCADENZARIO CONSEGNE
   -------------------------------------------------------------------------- */

function renderScadenzarioTable() {
  const tbody = document.getElementById('scadenzario-table-body');
  const archiveFilter = document.getElementById('scad-archive-filter').value;

  const ordini = pratiche
    .filter(p => p.fase === FASE.ORDINE_CONFERMATO)
    .map(p => { p.archived = !!p.stages.consegnato; return p; })
    .filter(p => {
      if (archiveFilter === 'active' && p.archived) return false;
      if (archiveFilter === 'archived' && !p.archived) return false;
      return true;
    })
    .sort((a, b) => new Date(a.dataConsegnaPrevista || 0) - new Date(b.dataConsegnaPrevista || 0));

  tbody.innerHTML = '';
  if (ordini.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Nessun ordine presente nello scadenzario.</td></tr>`;
    return;
  }

  ordini.forEach(p => {
    const status = checkDelayStatus(p);
    const tr = document.createElement('tr');
    if (p.archived) tr.classList.add('row-archived');
    tr.innerHTML = `
      <td class="text-center" style="font-weight:700;">${p.dataConsegnaPrevista || '-'}</td>
      <td class="text-center"><span class="urgency-chip ${status.urgency}">${status.urgencyLabel}</span></td>
      <td style="font-weight:600;">${p.fornitore || '-'}</td>
      <td>${articoliDescrizione(p.articoli)}</td>
      <td class="text-center">
        ${p.codeRDA ? `<span class="sub-info">RDA: ${p.codeRDA}</span>` : ''}
        ${p.codeODA ? `<span class="sub-info">ODA: ${p.codeODA}</span>` : ''}
        ${p.codeDDT ? `<span class="sub-info">DDT: ${p.codeDDT}</span>` : ''}
        ${!p.codeRDA && !p.codeODA && !p.codeDDT ? '-' : ''}
      </td>
      <td>${p.reparto || '-'} ${p.richiedente ? `(${p.richiedente})` : ''}</td>
      <td class="text-center">${p.maxDelayDays || 0} gg</td>
      <td class="text-right">${p.qty}</td>
      <td class="text-center">
        <label class="stage-chip ${p.stages.consegnato ? 'completed' : ''}"><input type="checkbox" ${p.stages.consegnato ? 'checked' : ''} onchange="toggleStage('${p.id}','consegnato')"> Ricevuta</label>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* --------------------------------------------------------------------------
   Azioni globali del modulo Acquisti
   -------------------------------------------------------------------------- */

function clearAllAcquistiData() {
  if (confirm('Attenzione: vuoi davvero eliminare TUTTI i dati di Gestione Acquisti (richieste, RFQ e ordini)? Operazione non reversibile.')) {
    clearAllPratiche();
    resetRichiestaForm();
    renderRichiesteTable();
    renderRfqSelect();
    renderOrdiniTable();
    renderScadenzarioTable();
  }
}
