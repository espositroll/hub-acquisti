/* ==========================================================================
   ANALISI.JS
   Dashboard di analisi storica acquisti. Modulo indipendente: lavora
   sull'Excel esportato dal gestionale aziendale, caricato di volta in volta
   (nessun collegamento con lo store di Gestione Acquisti, per scelta).
   ========================================================================== */

let rawData = [];
let filteredData = [];
let secondaryPricelist = {};

let chartTopItemsInstance = null;
let chartMonthlyInstance = null;
let chartForecastInstance = null;
let chartPriceHistoryInstance = null;

function initAnalisi() {
  document.getElementById('ana-excel-file').addEventListener('change', e => { if (e.target.files.length) handleMainFile(e.target.files[0]); });
  document.getElementById('ana-excel-file-prompt').addEventListener('change', e => { if (e.target.files.length) handleMainFile(e.target.files[0]); });
  document.getElementById('ana-secondary-excel-file').addEventListener('change', e => { if (e.target.files.length) handleSecondaryFile(e.target.files[0]); });
}

function switchAnalisiTab(tab) {
  document.querySelectorAll('#view-analisi .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-analisi .subview').forEach(v => v.classList.remove('active'));
  document.getElementById('ana-tab-' + tab).classList.add('active');
  document.getElementById('ana-' + tab).classList.add('active');

  if (tab === 'comparison') renderComparisonTab();
  if (tab === 'forecast') renderForecastTab();
  if (tab === 'abc') renderABCTab();
  if (tab === 'reports') renderReportsTab();
}

/* -------------------------------------------------------------------------- 
   Caricamento file principale (export gestionale) 
   -------------------------------------------------------------------------- */

function parseRowDate(row) {
  const explicitYear = row['Documento//Anno'];
  const dateVal = row['Documento//Data'];

  if (typeof dateVal === 'number') {
    const parsed = XLSX.SSF.parse_date_code(dateVal);
    if (parsed) return { year: parsed.y, month: String(parsed.m).padStart(2, '0'), yearMonth: parsed.y + '-' + String(parsed.m).padStart(2, '0'), fullDate: new Date(parsed.y, parsed.m - 1, parsed.d) };
  } else if (typeof dateVal === 'string' && dateVal.trim() !== '') {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
      return { year: d.getFullYear(), month: String(d.getMonth() + 1).padStart(2, '0'), yearMonth: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), fullDate: d };
    }
  } else if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    if (dateVal.getFullYear() > 1970) {
      return { year: dateVal.getFullYear(), month: String(dateVal.getMonth() + 1).padStart(2, '0'), yearMonth: dateVal.getFullYear() + '-' + String(dateVal.getMonth() + 1).padStart(2, '0'), fullDate: dateVal };
    }
  }

  if (explicitYear && !isNaN(parseInt(explicitYear))) {
    const y = parseInt(explicitYear);
    return { year: y, month: '01', yearMonth: y + '-01', fullDate: new Date(y, 0, 1) };
  }
  return null;
}

function handleMainFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawData = XLSX.utils.sheet_to_json(sheet);

    document.getElementById('ana-upload-prompt').classList.add('hidden');
    document.getElementById('ana-subtabs').classList.remove('hidden');

    populateFilterDropdowns();
    populatePriceHistorySelect();
    applyFilters();
    switchAnalisiTab('dashboard');
  };
  reader.readAsArrayBuffer(file);
}

function populateFilterDropdowns() {
  const vendorSelect = document.getElementById('filterVendor');
  const yearSelect = document.getElementById('filterYear');
  const forecastYearSelect = document.getElementById('forecastYearSelect');

  const vendors = new Set();
  const years = new Set();

  rawData.forEach(row => {
    const vendor = row['Cli/For Contabile//Ragione sociale'];
    if (vendor) vendors.add(vendor);
    const dateObj = parseRowDate(row);
    if (dateObj) years.add(dateObj.year);
  });

  vendorSelect.innerHTML = '<option value="ALL">Tutti i Fornitori</option>';
  vendors.forEach(v => vendorSelect.innerHTML += `<option value="${v}">${v}</option>`);

  yearSelect.innerHTML = '<option value="ALL">Tutti gli Anni</option>';
  forecastYearSelect.innerHTML = '';
  const sortedYears = Array.from(years).sort().reverse();
  sortedYears.forEach(y => {
    yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    forecastYearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  });

  vendorSelect.onchange = applyFilters;
  yearSelect.onchange = applyFilters;
  document.getElementById('searchInput').oninput = applyFilters;
}

/* -------------------------------------------------------------------------- 
   TAB 1: Dashboard Analytics 
   -------------------------------------------------------------------------- */

function applyFilters() {
  const selectedVendor = document.getElementById('filterVendor').value;
  const selectedYear = document.getElementById('filterYear').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  filteredData = rawData.filter(row => {
    const vendorMatch = (selectedVendor === 'ALL') || (row['Cli/For Contabile//Ragione sociale'] === selectedVendor);
    let yearMatch = true;
    if (selectedYear !== 'ALL') {
      const dateObj = parseRowDate(row);
      yearMatch = dateObj ? (dateObj.year == selectedYear) : false;
    }
    const code = (row['Articolo//Codice'] || '').toString().toLowerCase();
    const desc = (row['Descrizione articolo'] || '').toString().toLowerCase();
    const searchMatch = !searchTerm || code.includes(searchTerm) || desc.includes(searchTerm);
    return vendorMatch && yearMatch && searchMatch;
  });

  updateKPIs();
  renderDashboardCharts();
  renderDashboardTable();
}

function updateKPIs() {
  let totalSpend = 0, totalQty = 0;
  const items = new Set(), vendors = new Set();

  filteredData.forEach(row => {
    totalSpend += parseFloat(row['Importo netto Totale']) || 0;
    totalQty += parseFloat(row['Quantità Doc.']) || 0;
    const itemCode = row['Articolo//Codice'];
    const vendor = row['Cli/For Contabile//Ragione sociale'];
    if (itemCode) items.add(itemCode);
    if (vendor) vendors.add(vendor);
  });

  document.getElementById('kpiTotalSpend').textContent = formatCurrency(totalSpend);
  document.getElementById('kpiTotalQty').textContent = totalQty.toLocaleString('it-IT');
  document.getElementById('kpiUniqueItems').textContent = items.size;
  document.getElementById('kpiUniqueVendors').textContent = vendors.size;
  document.getElementById('recordCountInfo').textContent = `Righe analizzate: ${filteredData.length} su ${rawData.length}`;
}

function renderDashboardCharts() {
  const itemMap = {};
  filteredData.forEach(row => {
    const name = row['Descrizione articolo'] || row['Articolo//Codice'] || 'N/D';
    itemMap[name] = (itemMap[name] || 0) + (parseFloat(row['Importo netto Totale']) || 0);
  });
  const sortedItems = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const monthMap = {};
  filteredData.forEach(row => {
    const dateObj = parseRowDate(row);
    if (dateObj) monthMap[dateObj.yearMonth] = (monthMap[dateObj.yearMonth] || 0) + (parseFloat(row['Importo netto Totale']) || 0);
  });
  const sortedMonths = Object.keys(monthMap).sort();

  if (chartTopItemsInstance) chartTopItemsInstance.destroy();
  chartTopItemsInstance = new Chart(document.getElementById('chartTopItems').getContext('2d'), {
    type: 'bar',
    data: {
      labels: sortedItems.map(i => i[0].length > 25 ? i[0].substring(0, 25) + '...' : i[0]),
      datasets: [{ label: 'Spesa Totale (€)', data: sortedItems.map(i => i[1]), backgroundColor: '#3452D6', borderRadius: 6 }]
    },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  if (chartMonthlyInstance) chartMonthlyInstance.destroy();
  chartMonthlyInstance = new Chart(document.getElementById('chartMonthlySpend').getContext('2d'), {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [{ label: 'Spesa Mensile (€)', data: sortedMonths.map(m => monthMap[m]), borderColor: '#1F8F5F', backgroundColor: 'rgba(31,143,95,0.12)', fill: true, tension: 0.3, pointRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

function renderDashboardTable() {
  const tableBody = document.getElementById('tableBody');
  const itemSummary = {};

  filteredData.forEach(row => {
    const code = row['Articolo//Codice'] || 'N/D';
    const desc = row['Descrizione articolo'] || '';
    const qty = parseFloat(row['Quantità Doc.']) || 0;
    const spend = parseFloat(row['Importo netto Totale']) || 0;
    const um = row['UM Doc.'] || '';
    if (!itemSummary[code]) itemSummary[code] = { desc, totalQty: 0, totalSpend: 0, um };
    itemSummary[code].totalQty += qty;
    itemSummary[code].totalSpend += spend;
  });

  let html = '';
  Object.entries(itemSummary).forEach(([code, data]) => {
    const avgPrice = data.totalQty > 0 ? (data.totalSpend / data.totalQty) : 0;
    html += `
      <tr>
        <td class="font-mono text-accent" style="font-weight:600;">${code}</td>
        <td>${data.desc}</td>
        <td class="text-right">${formatCurrency(avgPrice)}</td>
        <td class="text-right" style="font-weight:600;">${data.totalQty.toLocaleString('it-IT')}</td>
        <td class="text-center text-muted">${data.um}</td>
        <td class="text-right" style="font-weight:700;">${formatCurrency(data.totalSpend)}</td>
      </tr>`;
  });

  tableBody.innerHTML = html || `<tr class="empty-row"><td colspan="6">Nessun dato trovato con i filtri correnti.</td></tr>`;
}

/* -------------------------------------------------------------------------- 
   TAB 2: Comparazione Listini 
   -------------------------------------------------------------------------- */

function downloadPricelistTemplate() {
  let templateData = [];
  const itemMap = new Map();
  rawData.forEach(row => {
    const code = row['Articolo//Codice'];
    if (code && !itemMap.has(code)) {
      itemMap.set(code, { desc: row['Descrizione articolo'] || '', um: row['UM Doc.'] || 'PZ' });
    }
  });
  itemMap.forEach((val, code) => {
    templateData.push({ 'Codice Articolo': code, 'Descrizione Articolo': val.desc, 'Prezzo Unitario Offerto (€)': '', 'Unità di Misura': val.um, 'Note / Condizioni': '' });
  });

  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 25 }, { wch: 15 }, { wch: 25 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Listino_Fornitore');
  XLSX.writeFile(wb, 'Template_Listino_Fornitore_Secondario.xlsx');
}

function handleSecondaryFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    secondaryPricelist = {};
    rows.forEach(row => {
      const code = row['Codice Articolo'] || row['Codice'] || row['Articolo'];
      const price = row['Prezzo Unitario Offerto (€)'] || row['Prezzo'] || row['Prezzo Listino'];
      if (code !== undefined && code !== null) {
        const numPrice = parseFloat(price);
        if (!isNaN(numPrice) && numPrice >= 0) {
          secondaryPricelist[String(code).trim()] = { price: numPrice, desc: row['Descrizione Articolo'] || '', note: row['Note / Condizioni'] || '' };
        }
      }
    });

    const count = Object.keys(secondaryPricelist).length;
    document.getElementById('secondaryStatusInfo').textContent = `Listino caricato: ${count} articoli identificati nel file`;
    document.getElementById('secondaryStatusCard').classList.remove('hidden');

    renderComparisonTab();
    renderForecastTab();
    renderReportsTab();
  };
  reader.readAsArrayBuffer(file);
}

function renderComparisonTab() {
  const cmpTableBody = document.getElementById('cmpTableBody');
  const cmpSearch = (document.getElementById('cmpSearchInput').value || '').toLowerCase();
  const secVendorName = document.getElementById('secondaryVendorName').value || 'Nuovo Fornitore';

  const itemSummary = {};
  rawData.forEach(row => {
    const code = row['Articolo//Codice'];
    if (!code) return;
    if (!itemSummary[code]) itemSummary[code] = { desc: row['Descrizione articolo'] || '', totalQty: 0, totalSpend: 0 };
    itemSummary[code].totalQty += parseFloat(row['Quantità Doc.']) || 0;
    itemSummary[code].totalSpend += parseFloat(row['Importo netto Totale']) || 0;
  });

  let matchedCount = 0, cheaperCount = 0, totalSavings = 0, totalCurrentSpend = 0, html = '';

  Object.entries(itemSummary).forEach(([code, data]) => {
    if (cmpSearch && !code.toLowerCase().includes(cmpSearch) && !data.desc.toLowerCase().includes(cmpSearch)) return;

    const currentAvgPrice = data.totalQty > 0 ? (data.totalSpend / data.totalQty) : 0;
    const secItem = secondaryPricelist[code];
    const secPrice = secItem ? secItem.price : null;
    let deltaUnit = 0, deltaPct = 0, deltaTotal = 0, badge = '';

    if (secPrice !== null) {
      matchedCount++;
      deltaUnit = secPrice - currentAvgPrice;
      deltaPct = currentAvgPrice > 0 ? ((secPrice - currentAvgPrice) / currentAvgPrice) * 100 : 0;
      deltaTotal = (secPrice * data.totalQty) - data.totalSpend;
      totalCurrentSpend += data.totalSpend;

      if (secPrice < currentAvgPrice) { cheaperCount++; totalSavings += Math.abs(deltaTotal); badge = `<span class="badge badge-success">Conviene ${secVendorName}</span>`; }
      else if (secPrice > currentAvgPrice) badge = `<span class="badge badge-warning">Conviene Attuale</span>`;
      else badge = `<span class="badge badge-info">Parità Prezzo</span>`;
    } else {
      badge = `<span class="badge badge-neutral">Non in Listino</span>`;
    }

    const deltaClass = deltaUnit < 0 ? 'text-success' : 'text-danger';
    html += `
      <tr>
        <td class="font-mono text-accent" style="font-weight:600;">${code}</td>
        <td>${data.desc}</td>
        <td class="text-right">${data.totalQty.toLocaleString('it-IT')}</td>
        <td class="text-right">${formatCurrency(currentAvgPrice)}</td>
        <td class="text-right" style="font-weight:700;">${secPrice !== null ? formatCurrency(secPrice) : '-'}</td>
        <td class="text-right ${deltaClass}" style="font-weight:600;">${secPrice !== null ? (deltaUnit <= 0 ? '' : '+') + '€ ' + deltaUnit.toFixed(2) + ' (' + deltaPct.toFixed(1) + '%)' : '-'}</td>
        <td class="text-right ${deltaClass}" style="font-weight:600;">${secPrice !== null ? (deltaTotal <= 0 ? '' : '+') + formatCurrency(deltaTotal) : '-'}</td>
        <td class="text-center">${badge}</td>
      </tr>`;
  });

  cmpTableBody.innerHTML = html || `<tr class="empty-row"><td colspan="8">Carica il listino del nuovo fornitore per visualizzare la comparazione.</td></tr>`;

  document.getElementById('cmpKpiMatched').textContent = `${matchedCount} / ${Object.keys(itemSummary).length}`;
  document.getElementById('cmpKpiCheaperCount').textContent = cheaperCount;
  document.getElementById('cmpKpiTotalSavings').textContent = formatCurrency(totalSavings);
  document.getElementById('cmpKpiPctSavings').textContent = (totalCurrentSpend > 0 ? (totalSavings / totalCurrentSpend) * 100 : 0).toFixed(1) + ' %';
}

/* -------------------------------------------------------------------------- 
   TAB 3: Forecast & Prospect 
   -------------------------------------------------------------------------- */

function renderForecastTab() {
  const targetYear = document.getElementById('forecastYearSelect').value;
  const elapsedMonths = parseInt(document.getElementById('elapsedMonthsInput').value) || 8;
  const remainingMonths = Math.max(1, 12 - elapsedMonths);
  document.getElementById('remainingMonthsLabel').textContent = remainingMonths;

  const secVendorName = document.getElementById('secondaryVendorName').value || 'Nuovo Fornitore';
  const yearData = rawData.filter(row => { const d = parseRowDate(row); return d ? (d.year == targetYear) : false; });

  const itemStats = {};
  yearData.forEach(row => {
    const code = row['Articolo//Codice'];
    if (!code) return;
    if (!itemStats[code]) itemStats[code] = { desc: row['Descrizione articolo'] || '', qty: 0, spend: 0 };
    itemStats[code].qty += parseFloat(row['Quantità Doc.']) || 0;
    itemStats[code].spend += parseFloat(row['Importo netto Totale']) || 0;
  });

  let currentHistSpend = 0, currentRemTot = 0, secRemTot = 0, optRemTot = 0, tableHtml = '';

  Object.entries(itemStats).forEach(([code, data]) => {
    currentHistSpend += data.spend;
    const currentAvgPrice = data.qty > 0 ? (data.spend / data.qty) : 0;
    const monthlyQty = data.qty / elapsedMonths;
    const remainingQty = monthlyQty * remainingMonths;
    const remSpendCurrent = remainingQty * currentAvgPrice;

    const secItem = secondaryPricelist[code];
    const secPrice = secItem ? secItem.price : null;
    const remSpendSec = remainingQty * (secPrice !== null ? secPrice : currentAvgPrice);
    const optimalPrice = (secPrice !== null && secPrice < currentAvgPrice) ? secPrice : currentAvgPrice;
    const remSpendOpt = remainingQty * optimalPrice;

    currentRemTot += remSpendCurrent; secRemTot += remSpendSec; optRemTot += remSpendOpt;
    const itemSavingsOpt = remSpendCurrent - remSpendOpt;

    let recBadge = `<span class="badge badge-neutral">Mantieni Attuale</span>`;
    if (secPrice !== null && secPrice < currentAvgPrice) recBadge = `<span class="badge badge-success">Passa a ${secVendorName}</span>`;
    else if (secPrice !== null) recBadge = `<span class="badge badge-info">Mantieni Attuale</span>`;

    tableHtml += `
      <tr>
        <td class="font-mono text-accent" style="font-weight:600;">${code}</td>
        <td>${data.desc}</td>
        <td class="text-right">${monthlyQty.toFixed(1)} / m</td>
        <td class="text-right" style="font-weight:600;">${Math.round(remainingQty).toLocaleString('it-IT')}</td>
        <td class="text-right">${formatCurrency(remSpendCurrent)}</td>
        <td class="text-right" style="font-weight:600;">${formatCurrency(remSpendSec)}</td>
        <td class="text-right text-success" style="font-weight:700;">${formatCurrency(itemSavingsOpt)}</td>
        <td class="text-center">${recBadge}</td>
      </tr>`;
  });

  document.getElementById('fctTableBody').innerHTML = tableHtml || `<tr class="empty-row"><td colspan="8">Nessun dato trovato per l'anno selezionato.</td></tr>`;

  const totalCurrent = currentHistSpend + currentRemTot;
  const totalSecondary = currentHistSpend + secRemTot;
  const totalOptimal = currentHistSpend + optRemTot;
  const savingsSec = currentRemTot - secRemTot;
  const savingsOpt = currentRemTot - optRemTot;

  document.getElementById('fctCurrentTotal').textContent = formatCurrency(totalCurrent);
  document.getElementById('fctCurrentRemaining').textContent = formatCurrency(currentRemTot);
  document.getElementById('fctSecondaryTotal').textContent = formatCurrency(totalSecondary);
  document.getElementById('fctSecondarySavingsLabel').textContent = `Risparmio stimato a fine anno: ${formatCurrency(savingsSec)}`;
  document.getElementById('fctSecondaryRemainingSavings').textContent = formatCurrency(savingsSec);
  document.getElementById('fctOptimalTotal').textContent = formatCurrency(totalOptimal);
  document.getElementById('fctOptimalSavingsLabel').textContent = `Risparmio MAX stimato a fine anno: ${formatCurrency(savingsOpt)}`;
  document.getElementById('fctOptimalRemainingSavings').textContent = formatCurrency(savingsOpt);

  if (chartForecastInstance) chartForecastInstance.destroy();
  chartForecastInstance = new Chart(document.getElementById('chartForecast').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Fornitore Attuale (100%)', `Nuovo Fornitore (${secVendorName})`, 'Strategia Ottimale (Mix)'],
      datasets: [
        { label: 'Spesa Storica (€)', data: [currentHistSpend, currentHistSpend, currentHistSpend], backgroundColor: '#7C879C' },
        { label: 'Spesa Stimata Residua (€)', data: [currentRemTot, secRemTot, optRemTot], backgroundColor: ['#C2402F', '#1F8F5F', '#3452D6'] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
  });
}

/* -------------------------------------------------------------------------- 
   TAB 4: Analisi ABC & Storico Prezzi 
   -------------------------------------------------------------------------- */

function populatePriceHistorySelect() {
  const select = document.getElementById('itemPriceHistorySelect');
  const items = new Map();
  rawData.forEach(row => {
    const code = row['Articolo//Codice'];
    if (code && !items.has(code)) items.set(code, row['Descrizione articolo'] || '');
  });
  select.innerHTML = '';
  items.forEach((desc, code) => { select.innerHTML += `<option value="${code}">${code} - ${desc.substring(0, 30)}</option>`; });
}

function renderABCTab() {
  const itemMap = {};
  rawData.forEach(row => {
    const code = row['Articolo//Codice'];
    if (!code) return;
    if (!itemMap[code]) itemMap[code] = { desc: row['Descrizione articolo'] || '', spend: 0, qty: 0 };
    itemMap[code].spend += parseFloat(row['Importo netto Totale']) || 0;
    itemMap[code].qty += parseFloat(row['Quantità Doc.']) || 0;
  });

  const sorted = Object.entries(itemMap).sort((a, b) => b[1].spend - a[1].spend);
  const totalSpendAll = sorted.reduce((sum, item) => sum + item[1].spend, 0);

  let cumSpend = 0, countA = 0, spendA = 0, countB = 0, spendB = 0, countC = 0, spendC = 0, tableHtml = '';

  sorted.forEach(([code, data]) => {
    cumSpend += data.spend;
    const cumPct = totalSpendAll > 0 ? (cumSpend / totalSpendAll) * 100 : 0;
    const avgPrice = data.qty > 0 ? (data.spend / data.qty) : 0;

    let category = 'C', badgeClass = 'badge-neutral';
    if (cumPct <= 80 || (cumPct - (data.spend / totalSpendAll) * 100 < 80)) { category = 'A'; badgeClass = 'badge-danger'; countA++; spendA += data.spend; }
    else if (cumPct <= 95) { category = 'B'; badgeClass = 'badge-warning'; countB++; spendB += data.spend; }
    else { countC++; spendC += data.spend; }

    tableHtml += `
      <tr>
        <td class="text-center"><span class="badge ${badgeClass}">Classe ${category}</span></td>
        <td class="font-mono text-accent" style="font-weight:600;">${code}</td>
        <td>${data.desc}</td>
        <td class="text-right" style="font-weight:700;">${formatCurrency(data.spend)}</td>
        <td class="text-right">${cumPct.toFixed(1)} %</td>
        <td class="text-right" style="font-weight:600;">${data.qty.toLocaleString('it-IT')}</td>
        <td class="text-right">${formatCurrency(avgPrice)}</td>
      </tr>`;
  });

  document.getElementById('abcClassACount').textContent = `${countA} articoli`;
  document.getElementById('abcClassASpend').textContent = formatCurrency(spendA);
  document.getElementById('abcClassBCount').textContent = `${countB} articoli`;
  document.getElementById('abcClassBSpend').textContent = formatCurrency(spendB);
  document.getElementById('abcClassCCount').textContent = `${countC} articoli`;
  document.getElementById('abcClassCSpend').textContent = formatCurrency(spendC);
  document.getElementById('abcTableBody').innerHTML = tableHtml || `<tr class="empty-row"><td colspan="7">Nessun dato disponibile.</td></tr>`;

  renderPriceHistoryChart();
}

function renderPriceHistoryChart() {
  const selectedCode = document.getElementById('itemPriceHistorySelect').value;
  if (!selectedCode) return;

  const priceHistory = [];
  rawData.forEach(row => {
    if (row['Articolo//Codice'] === selectedCode) {
      const dateObj = parseRowDate(row);
      const qty = parseFloat(row['Quantità Doc.']) || 0;
      const spend = parseFloat(row['Importo netto Totale']) || 0;
      if (dateObj && qty > 0) priceHistory.push({ date: dateObj.fullDate, dateStr: dateObj.yearMonth, unitPrice: spend / qty });
    }
  });
  priceHistory.sort((a, b) => a.date - b.date);

  if (chartPriceHistoryInstance) chartPriceHistoryInstance.destroy();
  chartPriceHistoryInstance = new Chart(document.getElementById('chartPriceHistory').getContext('2d'), {
    type: 'line',
    data: {
      labels: priceHistory.map(p => p.dateStr),
      datasets: [{ label: `Prezzo Unitario Netto (€) per ${selectedCode}`, data: priceHistory.map(p => p.unitPrice), borderColor: '#3452D6', backgroundColor: 'rgba(52,82,214,0.1)', fill: true, tension: 0.2, pointRadius: 5, pointHoverRadius: 7 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }
  });
}

/* -------------------------------------------------------------------------- 
   TAB 5: Report & Dossier Negoziazione 
   -------------------------------------------------------------------------- */

function renderReportsTab() {
  document.getElementById('repCurrentDate').textContent = new Date().toLocaleDateString('it-IT');
  const secVendorName = document.getElementById('secondaryVendorName').value || 'Fornitore Concorrente';
  document.getElementById('repVendorName').textContent = secVendorName;

  const targetYear = document.getElementById('forecastYearSelect').value || 2026;
  const elapsedMonths = parseInt(document.getElementById('elapsedMonthsInput').value) || 8;
  const remainingMonths = Math.max(1, 12 - elapsedMonths);

  const yearData = rawData.filter(row => { const d = parseRowDate(row); return d ? (d.year == targetYear) : false; });
  const itemStats = {};
  yearData.forEach(row => {
    const code = row['Articolo//Codice'];
    if (!code) return;
    if (!itemStats[code]) itemStats[code] = { desc: row['Descrizione articolo'] || '', qty: 0, spend: 0 };
    itemStats[code].qty += parseFloat(row['Quantità Doc.']) || 0;
    itemStats[code].spend += parseFloat(row['Importo netto Totale']) || 0;
  });

  let currentHistSpend = 0, currentRemSpend = 0, secRemSpend = 0, optRemSpend = 0, negHtml = '', overpricedCount = 0;

  Object.entries(itemStats).forEach(([code, data]) => {
    currentHistSpend += data.spend;
    const currentAvgPrice = data.qty > 0 ? (data.spend / data.qty) : 0;
    const monthlyQty = data.qty / elapsedMonths;
    const remainingQty = monthlyQty * remainingMonths;
    const remSpendCurrent = remainingQty * currentAvgPrice;

    const secItem = secondaryPricelist[code];
    const secPrice = secItem ? secItem.price : null;
    const remSpendSec = remainingQty * (secPrice !== null ? secPrice : currentAvgPrice);
    const optimalPrice = (secPrice !== null && secPrice < currentAvgPrice) ? secPrice : currentAvgPrice;
    const remSpendOpt = remainingQty * optimalPrice;

    currentRemSpend += remSpendCurrent; secRemSpend += remSpendSec; optRemSpend += remSpendOpt;

    if (secPrice !== null && secPrice < currentAvgPrice) {
      overpricedCount++;
      const requiredDiscountPct = ((currentAvgPrice - secPrice) / currentAvgPrice) * 100;
      const itemImpact = remSpendCurrent - remSpendSec;
      negHtml += `
        <tr>
          <td class="font-mono text-accent" style="font-weight:600;">${code}</td>
          <td>${data.desc}</td>
          <td class="text-right">${formatCurrency(currentAvgPrice)}</td>
          <td class="text-right text-success" style="font-weight:700;">${formatCurrency(secPrice)}</td>
          <td class="text-right text-danger" style="font-weight:700;">-${requiredDiscountPct.toFixed(1)} %</td>
          <td class="text-right" style="font-weight:700;">${formatCurrency(itemImpact)}</td>
        </tr>`;
    }
  });

  const totalCurrentProj = currentHistSpend + currentRemSpend;
  const savingsSec = currentRemSpend - secRemSpend;
  const savingsOpt = currentRemSpend - optRemSpend;

  document.getElementById('repExecCurrentSpend').textContent = formatCurrency(totalCurrentProj);
  document.getElementById('repExecSecSavings').textContent = formatCurrency(savingsSec);
  document.getElementById('repExecOptSavings').textContent = formatCurrency(savingsOpt);
  document.getElementById('repExecTextSummary').textContent =
    `Dall'analisi delle condizioni del nuovo fornitore "${secVendorName}", emergono ${overpricedCount} articoli fuori mercato rispetto alle quotazioni attuali. Il passaggio totale genererebbe un risparmio stimato a fine anno di ${formatCurrency(savingsSec)}. Adottando una strategia dual-sourcing mirata sugli articoli più convenienti, il risparmio massimo potenziale sale a ${formatCurrency(savingsOpt)}.`;

  document.getElementById('negTableBody').innerHTML = negHtml || `<tr class="empty-row"><td colspan="6">Nessun articolo identificato come fuori prezzo rispetto al listino secondario caricato.</td></tr>`;
}
