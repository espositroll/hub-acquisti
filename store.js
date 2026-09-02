/* ==========================================================================
   STORE.JS
   Unica fonte dati per il modulo "Gestione Acquisti".
   Una "pratica" nasce come Richiesta (RdO), attraversa la fase RFQ/Offerta
   e infine, alla conferma, diventa un Ordine tracciato nel registro e nello
   scadenzario. Sostituisce i due archivi separati delle versioni precedenti
   (app_orders_data e hub_rda_db) con un'unica riga di dati per pratica.

   Il modulo Analisi NON usa questo store: lavora su un Excel caricato di
   volta in volta dal gestionale aziendale, per scelta esplicita dell'utente.
   ========================================================================== */

const STORE_KEY = 'procura_hub_pratiche_v1';

const FASE = {
  RICHIESTA: 'richiesta',
  RFQ_INVIATA: 'rfq_inviata',
  OFFERTA_RICEVUTA: 'offerta_ricevuta',
  ORDINE_CONFERMATO: 'ordine_confermato'
};

let pratiche = [];

function loadPratiche() {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    pratiche = stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Errore lettura archivio pratiche:', err);
    pratiche = [];
  }
  return pratiche;
}

function savePratiche() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(pratiche));
    return true;
  } catch (err) {
    console.error('Errore salvataggio archivio pratiche:', err);
    alert('Errore durante il salvataggio dei dati nel browser.');
    return false;
  }
}

function nextPraticaId() {
  const year = new Date().getFullYear();
  const prefix = `PA-${year}-`;
  const seq = pratiche.filter(p => (p.id || '').startsWith(prefix)).length + 1;
  return prefix + String(seq).padStart(3, '0');
}

function articoliDescrizione(articoli) {
  if (!articoli || articoli.length === 0) return '-';
  return articoli.map(a => `${a.quantita}x ${a.descrizione}`).join(', ');
}

function sommaQuantitaArticoli(articoli) {
  return (articoli || []).reduce((sum, a) => sum + (parseInt(a.quantita) || 0), 0);
}

function createPratica({ reparto, richiedente, dataConsegnaRichiesta, articoli }) {
  const pratica = {
    id: nextPraticaId(),
    createdAt: new Date().toISOString().split('T')[0],
    fase: FASE.RICHIESTA,

    reparto: (reparto || '').trim(),
    richiedente: (richiedente || '').trim(),
    dataConsegnaRichiesta: dataConsegnaRichiesta || '',
    articoli: articoli || [],

    fornitore: '',
    fornitoreEmail: '',
    rfqNote: '',

    codeRDA: '',
    codeODA: '',
    codeDDT: '',
    dataOrdine: '',
    dataConsegnaPrevista: '',
    maxDelayDays: 0,
    qty: 0,
    price: 0,
    transport: 0,
    stages: { inviato: false, confermato: false, spedito: false, consegnato: false },
    archived: false
  };
  pratiche.unshift(pratica);
  savePratiche();
  return pratica;
}

function updatePratica(id, patch) {
  const p = pratiche.find(x => x.id === id);
  if (!p) return null;
  Object.assign(p, patch);
  savePratiche();
  return p;
}

function deletePratica(id) {
  pratiche = pratiche.filter(x => x.id !== id);
  savePratiche();
}

function getPratica(id) {
  return pratiche.find(x => x.id === id) || null;
}

function clearAllPratiche() {
  pratiche = [];
  savePratiche();
}

/* Stato di consegna/ritardo per un ordine confermato. */
function checkDelayStatus(p) {
  if (p.stages.consegnato) {
    return { label: 'Archiviato', class: 'badge-success', urgency: 'urgency-archiviato', urgencyLabel: 'Consegna ricevuta', isDelayed: false, daysDiff: 0 };
  }
  if (!p.dataConsegnaPrevista) {
    return { label: 'In attesa data', class: 'badge-neutral', urgency: 'urgency-futuro', urgencyLabel: 'Data da definire', isDelayed: false, daysDiff: 0 };
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const delivery = new Date(p.dataConsegnaPrevista); delivery.setHours(0, 0, 0, 0);
  const maxAllowed = new Date(delivery); maxAllowed.setDate(maxAllowed.getDate() + parseInt(p.maxDelayDays || 0));
  const diffDays = Math.ceil((today - delivery) / 86400000);

  if (today > maxAllowed) {
    return { label: `Ritardo (${diffDays} gg)`, class: 'badge-danger', urgency: 'urgency-scaduto', urgencyLabel: `Scaduto da ${Math.abs(diffDays)} gg`, isDelayed: true, daysDiff: diffDays };
  }
  if (diffDays === 0) {
    return { label: 'Consegna oggi', class: 'badge-warning', urgency: 'urgency-oggi', urgencyLabel: 'Consegna oggi', isDelayed: false, daysDiff: diffDays };
  }
  if (diffDays > 0 && diffDays <= 5) {
    return { label: 'In scadenza', class: 'badge-warning', urgency: 'urgency-imminente', urgencyLabel: `Tra ${diffDays} gg`, isDelayed: false, daysDiff: diffDays };
  }
  if (p.stages.spedito) return { label: 'In spedizione', class: 'badge-info', urgency: 'urgency-futuro', urgencyLabel: `Tra ${Math.abs(diffDays)} gg`, isDelayed: false, daysDiff: diffDays };
  if (p.stages.confermato) return { label: 'Confermato', class: 'badge-info', urgency: 'urgency-futuro', urgencyLabel: `Tra ${Math.abs(diffDays)} gg`, isDelayed: false, daysDiff: diffDays };
  if (p.stages.inviato) return { label: 'Inviato', class: 'badge-info', urgency: 'urgency-futuro', urgencyLabel: `Tra ${Math.abs(diffDays)} gg`, isDelayed: false, daysDiff: diffDays };
  return { label: 'In attesa', class: 'badge-neutral', urgency: 'urgency-futuro', urgencyLabel: `Tra ${Math.abs(diffDays)} gg`, isDelayed: false, daysDiff: diffDays };
}

function formatCurrency(amount) {
  return '€ ' + (amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
