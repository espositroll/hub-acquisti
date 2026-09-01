// State & Mock Data iniziale
let state = {
    purchases: [
        { id: 1, name: "Monitor UltraWide 34\"", category: "Tecnologia", price: 399.00, status: "Completato" },
        { id: 2, name: "Sedia Ergonomica Ufficio", category: "Casa", price: 220.50, status: "In Corso" },
        { id: 3, name: "Abbonamento Cloud Hosting", category: "Servizi", price: 120.00, status: "Completato" }
    ],
    quotes: []
};

// Inizializzazione all'avvio
document.addEventListener("DOMContentLoaded", () => {
    loadFromLocalStorage();
    lucide.createIcons();
    updateDashboard();
    renderTable();
});

// Salvataggio localStorage
function saveToLocalStorage() {
    localStorage.setItem("hub_acquisti_state", JSON.stringify(state));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem("hub_acquisti_state");
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Errore nel parsing del localStorage", e);
        }
    }
}

// Navigatore Tab
function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.getElementById(`tab-${tabId}`).classList.remove("hidden");

    // Reset pulsanti sidebar
    document.querySelectorAll("aside nav button").forEach(btn => {
        btn.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors";
    });

    const activeBtn = document.getElementById(`nav-${tabId}`);
    activeBtn.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium bg-indigo-600 text-white shadow-lg shadow-indigo-600/20";

    // Titolo header
    const titles = {
        dashboard: "Dashboard",
        acquisti: "Lista Acquisti",
        preventivi: "Confronto Preventivi",
        impostazioni: "Impostazioni & Dati"
    };
    document.getElementById("current-page-title").innerText = titles[tabId] || "Dashboard";

    if (tabId === 'dashboard') {
        updateDashboard();
    }
}

// Gestione Modale
function openNewItemModal() {
    document.getElementById("itemModal").classList.remove("hidden");
    document.getElementById("itemModal").classList.add("flex");
}

function closeNewItemModal() {
    document.getElementById("itemModal").classList.remove("flex");
    document.getElementById("itemModal").classList.add("hidden");
}

function saveNewItem() {
    const name = document.getElementById("modal-name").value.trim();
    const category = document.getElementById("modal-category").value;
    const price = parseFloat(document.getElementById("modal-price").value);
    const status = document.getElementById("modal-status").value;

    if (!name || isNaN(price)) {
        alert("Inserisci un nome valido e un prezzo numerico.");
        return;
    }

    const newItem = {
        id: Date.now(),
        name,
        category,
        price,
        status
    };

    state.purchases.push(newItem);
    saveToLocalStorage();
    renderTable();
    updateDashboard();
    closeNewItemModal();

    // Pulisci campi
    document.getElementById("modal-name").value = "";
    document.getElementById("modal-price").value = "";
}

// Render Tabella Acquisti
function renderTable(filterText = "") {
    const tbody = document.getElementById("purchases-table-body");
    tbody.innerHTML = "";

    const filtered = state.purchases.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()) || p.category.toLowerCase().includes(filterText.toLowerCase()));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-slate-500">Nessun acquisto trovato</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        let statusBadge = "";
        if (item.status === "Completato") {
            statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">Completato</span>`;
        } else if (item.status === "In Corso") {
            statusBadge = `<span class="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-xs font-semibold">In Corso</span>`;
        } else {
            statusBadge = `<span class="bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full text-xs font-semibold">Annullato</span>`;
        }

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-750 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-white">${item.name}</td>
            <td class="px-6 py-4 text-slate-400">${item.category}</td>
            <td class="px-6 py-4 font-semibold text-white">€ ${item.price.toFixed(2)}</td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="deleteItem(${item.id})" class="text-slate-500 hover:text-red-400 p-1 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function filterTable() {
    const query = document.getElementById("searchInput").value;
    renderTable(query);
}

function deleteItem(id) {
    if (confirm("Sei sicuro di voler eliminare questo elemento?")) {
        state.purchases = state.purchases.filter(p => p.id !== id);
        saveToLocalStorage();
        renderTable();
        updateDashboard();
    }
}

// Aggiornamento Dashboard e Grafici (Chart.js)
let catChartInstance = null;
let statusChartInstance = null;

function updateDashboard() {
    // KPI calcoli
    const totalSpent = state.purchases.reduce((acc, curr) => curr.status === 'Completato' ? acc + curr.price : acc, 0);
    const pendingCount = state.purchases.filter(p => p.status === 'In Corso').length;
    const completedCount = state.purchases.filter(p => p.status === 'Completato').length;

    document.getElementById("kpi-total-spent").innerText = `€ ${totalSpent.toFixed(2)}`;
    document.getElementById("kpi-pending").innerText = pendingCount;
    document.getElementById("kpi-completed").innerText = completedCount;

    // Raccogli dati per categorie
    const categories = {};
    state.purchases.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + p.price;
    });

    const catLabels = Object.keys(categories);
    const catData = Object.values(categories);

    // Raccogli dati per stato
    const statuses = { "Completato": 0, "In Corso": 0, "Annullato": 0 };
    state.purchases.forEach(p => {
        if (statuses[p.status] !== undefined) statuses[p.status]++;
    });

    // Chart 1: Categorie
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if (catChartInstance) catChartInstance.destroy();
    catChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: catLabels.length ? catLabels : ['Nessun dato'],
            datasets: [{
                data: catData.length ? catData : [1],
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }
        }
    });

    // Chart 2: Stato Ordini
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctxStatus, {
        type: 'bar',
        data: {
            labels: ['Completato', 'In Corso', 'Annullato'],
            datasets: [{
                label: 'Numero Ordini',
                data: [statuses["Completato"], statuses["In Corso"], statuses["Annullato"]],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Simulatore Preventivi
function addQuoteSimulation() {
    const item = document.getElementById("quote-item").value.trim();
    const price = parseFloat(document.getElementById("quote-price").value);

    if (!item || isNaN(price)) {
        alert("Inserisci articolo e prezzo valido.");
        return;
    }

    state.quotes.push({ item, price });
    document.getElementById("quote-item").value = "";
    document.getElementById("quote-price").value = "";
    renderQuotes();
}

function renderQuotes() {
    const container = document.getElementById("quotes-result");
    container.innerHTML = "";

    if (state.quotes.length === 0) return;

    // Trova il prezzo minimo
    const minPrice = Math.min(...state.quotes.map(q => q.price));

    state.quotes.forEach((q, idx) => {
        const isBest = q.price === minPrice;
        const div = document.createElement("div");
        div.className = `p-4 rounded-xl flex justify-between items-center border ${isBest ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`;
        div.innerHTML = `
            <div>
                <span class="font-bold text-white">${q.item}</span>
                ${isBest ? '<span class="ml-3 bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded text-xs">Miglior Prezzo</span>' : ''}
            </div>
            <div class="flex items-center space-x-4">
                <span class="font-bold text-lg">€ ${q.price.toFixed(2)}</span>
                <button onclick="removeQuote(${idx})" class="text-slate-500 hover:text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function removeQuote(index) {
    state.quotes.splice(index, 1);
    renderQuotes();
}

// Esportazione Excel (SheetJS)
function exportDataExcel() {
    const worksheetData = state.purchases.map(p => ({
        "ID": p.id,
        "Prodotto": p.name,
        "Categoria": p.category,
        "Prezzo (€)": p.price,
        "Stato": p.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Acquisti");

    XLSX.writeFile(workbook, "Hub_Acquisti_Export.xlsx");
}

// Impostazioni e Backup
function resetData() {
    if (confirm("Vuoi ripristinare i dati di default?")) {
        localStorage.removeItem("hub_acquisti_state");
        location.reload();
    }
}

function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `hub_acquisti_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}
