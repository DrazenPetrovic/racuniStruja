const DATABASE_NAME = "struja-racuni";
const DATABASE_VERSION = 1;
const STORE_NAME = "racuni";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const formatter = new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });

const form = document.querySelector("#bill-form");
const fileInput = document.querySelector("#pdf-file");
const fileName = document.querySelector("#file-name");
const message = document.querySelector("#form-message");
const billList = document.querySelector("#bill-list");
const chart = document.querySelector("#chart");
const formButton = form.querySelector("button[type=submit]");
let database;
let bills = [];
let documentUrls = [];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readBills() {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveBill(bill) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).add(bill);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function removeBill(id) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function asDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "short", year: "numeric" }).format(asDate(value));
}

function formatMonth(value) {
  return new Intl.DateTimeFormat("hr-HR", { month: "short", year: "2-digit" }).format(asDate(value));
}

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle("success", success);
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMetric(parent, title, value) {
  const metric = document.createElement("div");
  metric.className = "bill-metric";
  const label = document.createElement("span");
  label.textContent = title;
  const content = document.createElement("strong");
  content.textContent = value;
  metric.append(label, content);
  parent.append(metric);
}

function renderSummary() {
  const totalConsumption = bills.reduce((total, bill) => total + bill.consumption, 0);
  const totalCost = bills.reduce((total, bill) => total + bill.cost, 0);
  document.querySelector("#total-consumption").textContent = formatter.format(totalConsumption);
  document.querySelector("#total-cost").textContent = currencyFormatter.format(totalCost);
  document.querySelector("#bill-count").textContent = String(bills.length);
  document.querySelector("#bill-count-label").textContent = `${bills.length} ${bills.length === 1 ? "račun" : "računa"}`;
}

function renderChart(orderedBills) {
  chart.replaceChildren();
  const recentBills = orderedBills.slice(-6);
  if (!recentBills.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chart";
    empty.textContent = "Dodajte prvi račun za prikaz potrošnje.";
    chart.append(empty);
    return;
  }

  const maxConsumption = Math.max(...recentBills.map((bill) => bill.consumption));
  for (const bill of recentBills) {
    const column = document.createElement("div");
    column.className = "chart-column";
    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = formatter.format(bill.consumption);
    const track = document.createElement("div");
    track.className = "bar-track";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(5, (bill.consumption / maxConsumption) * 100)}%`;
    bar.setAttribute("aria-label", `${formatter.format(bill.consumption)} kWh`);
    track.append(bar);
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = formatMonth(bill.periodEnd);
    column.append(value, track, label);
    chart.append(column);
  }
}

function renderBills() {
  for (const url of documentUrls) URL.revokeObjectURL(url);
  documentUrls = [];
  const orderedBills = [...bills].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  renderSummary();
  renderChart(orderedBills);
  billList.replaceChildren();
  if (!bills.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";
    const title = document.createElement("h3");
    title.textContent = "Još nema spremljenih računa";
    const description = document.createElement("p");
    description.textContent = "Dodajte prvi PDF račun kako biste počeli pratiti potrošnju.";
    empty.append(icon, title, description);
    billList.append(empty);
    return;
  }

  for (const bill of [...orderedBills].reverse()) {
    const row = document.createElement("article");
    row.className = "bill-row";
    const period = document.createElement("div");
    period.className = "bill-period";
    period.textContent = `${formatDate(bill.periodStart)} – ${formatDate(bill.periodEnd)}`;
    const documentLabel = document.createElement("small");
    documentLabel.textContent = bill.pdfName;
    period.append(documentLabel);
    addMetric(row, "POTROŠNJA", `${formatter.format(bill.consumption)} kWh`);
    addMetric(row, "IZNOS", currencyFormatter.format(bill.cost));
    const actions = document.createElement("div");
    actions.className = "bill-actions";
    const pdfUrl = URL.createObjectURL(bill.pdf);
    documentUrls.push(pdfUrl);
    const pdfLink = document.createElement("a");
    pdfLink.href = pdfUrl;
    pdfLink.target = "_blank";
    pdfLink.rel = "noopener";
    pdfLink.textContent = "Otvori PDF";
    pdfLink.setAttribute("aria-label", `Otvori PDF: ${bill.pdfName}`);
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Obriši";
    deleteButton.dataset.billId = bill.id;
    deleteButton.setAttribute("aria-label", `Obriši račun: ${bill.pdfName}`);
    actions.append(pdfLink, deleteButton);
    row.prepend(period);
    row.append(actions);
    billList.append(row);
  }
}

fileInput.addEventListener("change", () => {
  fileName.textContent = fileInput.files[0]?.name ?? "Nijedna datoteka nije odabrana";
  setMessage("");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  const data = new FormData(form);
  const pdf = fileInput.files[0];
  const periodStart = data.get("periodStart");
  const periodEnd = data.get("periodEnd");
  const consumption = Number(data.get("consumption"));
  const cost = Number(data.get("cost"));

  if (!pdf || !pdf.name.toLowerCase().endsWith(".pdf")) {
    setMessage("Odaberite valjanu PDF datoteku.");
    return;
  }
  const header = new TextDecoder().decode(await pdf.slice(0, 5).arrayBuffer());
  if (header !== "%PDF-") {
    setMessage("Odabrana datoteka nije valjan PDF dokument.");
    return;
  }
  if (pdf.size > MAX_FILE_SIZE) {
    setMessage("PDF datoteka ne smije biti veća od 20 MB.");
    return;
  }
  if (periodEnd < periodStart) {
    setMessage("Završetak razdoblja ne može biti prije početka.");
    return;
  }
  if (!Number.isFinite(consumption) || consumption <= 0 || !Number.isFinite(cost) || cost < 0) {
    setMessage("Unesite valjanu potrošnju i iznos računa.");
    return;
  }

  formButton.disabled = true;
  formButton.textContent = "Spremanje…";
  try {
    const bill = {
      id: crypto.randomUUID(),
      periodStart,
      periodEnd,
      consumption,
      cost,
      pdfName: pdf.name,
      pdf
    };
    await saveBill(bill);
    bills.push(bill);
    renderBills();
    form.reset();
    fileName.textContent = "Nijedna datoteka nije odabrana";
    setMessage("Račun je spremljen.", true);
  } catch {
    setMessage("Račun nije moguće spremiti. Provjerite slobodan prostor preglednika.");
  } finally {
    formButton.disabled = false;
    formButton.innerHTML = 'Spremi račun <span aria-hidden="true">→</span>';
  }
});

billList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-bill-id]");
  if (!button) return;
  button.disabled = true;
  try {
    await removeBill(button.dataset.billId);
    bills = bills.filter((bill) => bill.id !== button.dataset.billId);
    renderBills();
  } catch {
    button.disabled = false;
    setMessage("Račun nije moguće obrisati. Pokušajte ponovno.");
  }
});

async function initialize() {
  const today = new Date();
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  document.querySelector("#period-start").value = localDateString(previousMonth);
  document.querySelector("#period-end").value = localDateString(today);
  try {
    database = await openDatabase();
    bills = await readBills();
    renderBills();
  } catch {
    setMessage("Lokalna pohrana nije dostupna. Pokušajte otvoriti aplikaciju u drugom pregledniku.");
    formButton.disabled = true;
  }
}

initialize();
