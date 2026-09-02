# Procura Hub — Gestione Acquisti & Analisi

Piattaforma web unica per l'ufficio acquisti: unifica in un'unica app la gestione
delle richieste d'acquisto, la generazione delle RFQ, il registro ordini e lo
scadenzario consegne, più un modulo indipendente di analisi storica/forecast
sui dati del gestionale aziendale.

Nessun backend, nessun build step: è un sito statico (HTML + CSS + JS puro)
pensato per essere pubblicato così com'è su **GitHub Pages** o aperto
localmente facendo doppio clic su `index.html`.

## Struttura del progetto

```
index.html          Shell dell'app: navigazione principale + markup di entrambe le sezioni
css/style.css        Design system unico (glassmorphism minimal) condiviso da tutta l'app
js/store.js          Unica fonte dati del modulo Acquisti (localStorage)
js/acquisti.js        Logica di Richieste, RFQ, Registro Ordini, Scadenzario
js/analisi.js         Logica del modulo Analisi (dashboard, comparazione, forecast, ABC, report)
js/main.js            Navigazione tra le due sezioni principali e inizializzazione
```

## I due moduli

### 1. Gestione Acquisti
Richiesta → RFQ → Ordine confermato → Consegna sono la **stessa pratica**,
non tre archivi separati. Una richiesta nasce nella scheda *Richieste*,
genera un'email di RFQ nella scheda *RFQ*, e alla conferma diventa un ordine
tracciato in *Registro Ordini* e nello *Scadenzario*. Tutti i dati sono
salvati nel `localStorage` del browser sotto la chiave
`procura_hub_pratiche_v1`.

### 2. Analisi & Forecast
Modulo indipendente, per scelta: non condivide dati con la Gestione Acquisti
perché lavora sull'estrazione Excel del gestionale aziendale, caricata di
volta in volta. Offre dashboard di spesa, comparazione con listini di
fornitori alternativi, forecast di fine anno e un generatore di report/dossier
di negoziazione stampabile in PDF.

## Come pubblicarlo su GitHub Pages

1. Crea un repository e carica questi file mantenendo la struttura di cartelle.
2. Nelle impostazioni del repository, sezione **Pages**, seleziona il branch
   `main` e la cartella principale (`/`) come sorgente.
3. GitHub Pages pubblicherà il sito a un indirizzo del tipo
   `https://<utente>.github.io/<repository>/`.

## Limiti da tenere presente

- **Dati per browser**: essendo tutto client-side, i dati del modulo Acquisti
  vivono solo nel browser/dispositivo in cui vengono inseriti. Più persone che
  lavorano da postazioni diverse non vedono automaticamente gli stessi dati:
  serve l'Excel export/import come "scambio manuale", oppure in futuro un
  database condiviso.
- **Excel richiesto per l'Analisi**: la dashboard di analisi non salva nulla:
  ogni volta che si apre la pagina va ricaricato il file Excel del gestionale.
- Librerie esterne caricate via CDN: [SheetJS](https://sheetjs.com/) per
  import/export Excel, [Chart.js](https://www.chartjs.org/) per i grafici —
  serve quindi una connessione internet quando l'app è in uso.
