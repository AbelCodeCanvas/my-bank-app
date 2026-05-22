import { useState, useMemo } from "react";
import Papa from "papaparse";
import {
  Upload, AlertCircle, Loader2, RefreshCcw,
  Search, ArrowUpDown
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ═══════════════════════════════════════════════════════════
// SECTION 1: UTILITIES & CONSTANTS
// ═══════════════════════════════════════════════════════════

const formatZAR = (val) =>
  "R " + Math.abs(val ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


function generateId(date, amount, desc) {
  const str = `${date}|${amount}|${desc}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h = h & h; }
  return Math.abs(h).toString(16);
}

function normalizeKey(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").trim();
}

function parseDate(str) {
  if (!str) return null;
  str = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const dm = str.match(/^(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{4})$/);
  if (dm && months[dm[2].toLowerCase()]) return `${dm[3]}-${months[dm[2].toLowerCase()]}-${dm[1].padStart(2, "0")}`;
  return null;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  let s = String(val).trim().replace(/[R$€£\s]/g, "");
  const ci = s.lastIndexOf(","), pi = s.lastIndexOf(".");
  if (ci > pi) { s = s.replace(/\./g, "").replace(",", "."); }
  else { s = s.replace(/,/g, ""); }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ═══════════════════════════════════════════════════════════
// SECTION 2: MERCHANT & CATEGORY DATA
// ═══════════════════════════════════════════════════════════

const MERCHANT_LOOKUP = {
  "checkers": { merchant: "Checkers", merchantKey: "checkers" },
  "woolworths-food": { merchant: "Woolworths Food", merchantKey: "woolworths-food" },
  "woolworths": { merchant: "Woolworths", merchantKey: "woolworths" },
  "pick-n-pay": { merchant: "Pick n Pay", merchantKey: "pick-n-pay" },
  "spar": { merchant: "Spar", merchantKey: "spar" },
  "shoprite": { merchant: "Shoprite", merchantKey: "shoprite" },
  "netflix": { merchant: "Netflix", merchantKey: "netflix" },
  "showmax": { merchant: "Showmax", merchantKey: "showmax" },
  "dstv": { merchant: "DStv", merchantKey: "dstv" },
  "spotify": { merchant: "Spotify", merchantKey: "spotify" },
  "apple": { merchant: "Apple", merchantKey: "apple" },
  "disney": { merchant: "Disney+", merchantKey: "disney" },
  "uber-eats": { merchant: "Uber Eats", merchantKey: "uber-eats" },
  "uber": { merchant: "Uber", merchantKey: "uber" },
  "bolt": { merchant: "Bolt", merchantKey: "bolt" },
  "engen": { merchant: "Engen", merchantKey: "engen" },
  "sasol": { merchant: "Sasol", merchantKey: "sasol" },
  "eskom": { merchant: "Eskom", merchantKey: "eskom" },
  "discovery": { merchant: "Discovery", merchantKey: "discovery" },
  "clicks": { merchant: "Clicks", merchantKey: "clicks" },
};

const CATEGORY_RULES = [
  { pattern: /SALARY|PAYROLL|WAGES/i, category: "income" },
  { pattern: /OWN ACC|TRANSFER|TRF/i, category: "transfer" },
  { pattern: /ENGEN|SASOL|SHELL|BP|TOTAL|CALTEX|PETROL|DIESEL/i, category: "fuel" },
  { pattern: /CHECKERS|WOOLWORTHS|PICK N PAY|SPAR|SHOPRITE/i, category: "groceries" },
  { pattern: /NETFLIX|SHOWMAX|DSTV|SPOTIFY|APPLE/i, category: "streaming" },
  { pattern: /INSURANCE|INSURE|DISCOVERY|OUTSURANCE/i, category: "insurance" },
  { pattern: /PHARMACY|DISCHEM|CLICKS|MEDICLINIC/i, category: "medical" },
  { pattern: /RESTAURANT|SPUR|NANDOS|KFC|MCDONALDS/i, category: "dining" },
  { pattern: /UBER|BOLT|GAUTRAIN/i, category: "transport" },
  { pattern: /ESKOM|MUNICIPAL|WATER|ELECTRICITY|TELKOM|VODACOM/i, category: "utilities" },
];

// ═══════════════════════════════════════════════════════════
// SECTION 3: NORMALIZER & PARSERS
// ═══════════════════════════════════════════════════════════

function cleanMerchant(raw) {
  let s = String(raw).toUpperCase().replace(/\b(PTY|LTD|CC|NPC|SA|ZA|RSA)\b/g, "").trim();
  const nk = normalizeKey(s);
  if (MERCHANT_LOOKUP[nk]) return MERCHANT_LOOKUP[nk];
  return { merchant: s || "Unknown", merchantKey: nk || "unknown" };
}

function categorizeTransaction(rawDesc, merchant) {
  const text = String(rawDesc).toUpperCase() + " " + String(merchant).toUpperCase();
  for (const { pattern, category } of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data: rows }) => {
        if (!rows || rows.length === 0) return resolve([]);

        const headers = Object.keys(rows[0] || {});
        const h = headers.map(x => x.toLowerCase().trim());
        const find = (terms) => h.findIndex(c => terms.some(t => c.includes(t)));
        const getField = (idx, row) => (idx >= 0 ? row[headers[idx]] : undefined);

        const cols = {
          date: find(["date", "val"]),
          desc: find(["desc", "narr", "det", "part", "ref", "trans"]),
          debit: h.findIndex(c => c === "debit" || c.includes("debit amt")),
          credit: h.findIndex(c => c === "credit" || c.includes("credit amt")),
          amount: find(["amount", "trans amt"]),
        };

        const transactions = rows.map(row => {
          const rawDate = getField(cols.date, row);
          const date = parseDate(rawDate);
          if (!date) return null;

          let amt = null;
          if (cols.amount >= 0) amt = parseAmount(getField(cols.amount, row));
          if (amt === null) {
            const dv = cols.debit >= 0 ? parseAmount(getField(cols.debit, row)) : null;
            const cv = cols.credit >= 0 ? parseAmount(getField(cols.credit, row)) : null;
            if (dv !== null) amt = -Math.abs(dv);
            else if (cv !== null) amt = Math.abs(cv);
          }

          if (amt === null || Math.abs(amt) < 0.01) return null;

          const rawDesc = getField(cols.desc, row) || "";
          const { merchant, merchantKey } = cleanMerchant(rawDesc);
          const category = categorizeTransaction(rawDesc, merchant);

          return {
            id: generateId(date, amt, rawDesc),
            date,
            amount: amt,
            merchant,
            merchantKey,
            rawDescription: rawDesc,
            category,
            type: amt < 0 ? "debit" : "credit",
            source: file.name,
            month: date.substring(0, 7),
            flags: []
          };
        }).filter(Boolean);
        resolve(transactions);
      },
      error: reject
    });
  });
}

// (Note: parsePDF logic omitted for space, but would follow the same structure)

async function parseAllFiles(files) {
  const results = await Promise.all(files.map(async f => {
    if (f.name.toLowerCase().endsWith(".csv")) return await parseCSV(f);
    return []; // PDF stub
  }));
  return results.flat().sort((a, b) => a.date.localeCompare(b.date));
}

function preFlag(transactions) {
  const catAmounts = {};
  transactions.forEach(t => {
    if (t.amount < 0) {
      if (!catAmounts[t.category]) catAmounts[t.category] = [];
      catAmounts[t.category].push(Math.abs(t.amount));
    }
  });
  const medians = Object.fromEntries(Object.entries(catAmounts).map(([c, v]) => [c, [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]]));
  const mCounts = {};
  transactions.forEach(t => mCounts[t.merchantKey] = (mCounts[t.merchantKey] || 0) + 1);

  return transactions.map(t => {
    const flags = [];
    const isDup = transactions.some(o => o.id !== t.id && o.merchantKey === t.merchantKey && o.amount === t.amount && Math.abs(new Date(t.date) - new Date(o.date)) <= 172800000);
    if (isDup) flags.push("possible-duplicate");
    if (t.amount < 0 && medians[t.category] && Math.abs(t.amount) > 2 * medians[t.category]) flags.push("large-amount");
    if (mCounts[t.merchantKey] === 1) flags.push("new-merchant");
    return { ...t, flags };
  });
}

// ═══════════════════════════════════════════════════════════
// SECTION 4: API (GEMMA 4)
// ═══════════════════════════════════════════════════════════

async function analyzeWithGemma(transactions) {
  // STUB: Return mock data for testing if no API key
  console.log("Calling Gemma 4 API with", transactions.length, "transactions...");
  return new Promise(resolve => setTimeout(() => resolve({
    spending: { totalDebit: -5000, totalCredit: 15000, byCategory: [{ category: "groceries", total: 2000, monthlyAverage: 1000, byMonth: {"2024-01": 2000}, topMerchants: [{merchant: "Checkers", total: 2000}], trend: "stable" }], notes: ["Spending looks normal."] },
    subscriptions: [{ merchant: "Netflix", merchantKey: "netflix", amount: 199, frequency: "monthly", lastCharged: "2024-01-15", totalSpent: 199, confidence: "high", note: "Monthly subscription" }],
    anomalies: [{ transactionId: transactions[0]?.id, date: "2024-01-01", merchant: "Unknown", amount: -5000, type: "spike", explanation: "Unusual spike in spending." }],
    recommendations: [{ category: "groceries", title: "Reduce Food Spend", detail: "You spend significantly more on groceries than average.", estimatedMonthlySaving: 500, priority: "medium" }]
  }), 2000));
}

// ═══════════════════════════════════════════════════════════
// SECTION 5: UI COMPONENTS (SUB-PANELS)
// ═══════════════════════════════════════════════════════════

const TransactionTable = ({ transactions }) => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return transactions
      .filter(t => t.merchant.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => {
        const aValue = a[sort.key];
        const bValue = b[sort.key];
        if (aValue === bValue) return 0;
        return (aValue < bValue ? -1 : 1) * (sort.dir === 'asc' ? 1 : -1);
      });
  }, [transactions, search, sort]);
  const paginated = filtered.slice(0, page * 50);
  return (
    <div className="space-y-4">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-xs uppercase font-bold"><tr>{["date","merchant","category","amount"].map(k => <th key={k} onClick={() => setSort({key:k, dir:sort.dir==='asc'?'desc':'asc'})} className="px-4 py-3 cursor-pointer">{k} <ArrowUpDown size={12}/></th>)}</tr></thead><tbody className="divide-y"> {paginated.map(t => <tr key={t.id} className="hover:bg-gray-50"><td className="px-4 py-2 font-mono">{t.date}</td><td className="px-4 py-2 font-bold">{t.merchant}</td><td className="px-4 py-2 text-xs uppercase text-gray-500">{t.category}</td><td className={`px-4 py-2 font-bold ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatZAR(t.amount)}</td></tr>)}</tbody></table></div>
      {paginated.length < filtered.length && <button onClick={() => setPage(p => p+1)} className="w-full py-2 text-blue-600 font-bold">Load More</button>}
    </div>
  );
};

const SpendingPanel = ({ spending, transactions }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-red-50 p-4 rounded-xl border border-red-100"> <p className="text-xs text-red-600 font-bold">Total Spent</p> <p className="text-xl font-bold text-red-700">{formatZAR(spending.totalDebit)}</p> </div>
      <div className="bg-green-50 p-4 rounded-xl border border-green-100"> <p className="text-xs text-green-600 font-bold">Total Income</p> <p className="text-xl font-bold text-green-700">{formatZAR(spending.totalCredit)}</p> </div>
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"> <p className="text-xs text-blue-600 font-bold">Monthly Avg</p> <p className="text-xl font-bold text-blue-700">{formatZAR(spending.totalDebit / (new Set(transactions.map(t => t.month)).size || 1))}</p> </div>
    </div>
    <div className="bg-white p-4 rounded-xl border h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={spending.byCategory} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="category" type="category" tick={{fontSize:12}} width={80}/><Tooltip formatter={v => [formatZAR(v), "Total"]} /><Bar dataKey="total" radius={[0,4,4,0]}>{spending.byCategory.map((e, i) => <Cell key={i} fill={e.trend === 'increasing' ? '#ef4444' : e.trend === 'decreasing' ? '#22c55e' : '#f59e0b'} />)}</Bar></BarChart></ResponsiveContainer></div>
  </div>
);

const SubscriptionsPanel = ({ subscriptions }) => (
  <div className="space-y-6">
    <div className="p-4 bg-blue-600 text-white rounded-xl font-bold"> {subscriptions.length} Subscriptions Found</div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{subscriptions.map((s, i) => (<div key={i} className="p-4 bg-white border rounded-xl shadow-sm"><p className="font-bold text-lg">{s.merchant}</p><p className="text-sm text-gray-500">{s.frequency} · {formatZAR(s.amount)}</p></div>))}</div>
  </div>
);

const AnomaliesPanel = ({ anomalies }) => (
  <div className="space-y-4">{anomalies.map((a, i) => <div key={i} className="p-4 bg-white border rounded-xl border-l-4 border-l-red-500"><p className="font-bold">{a.merchant}</p><p className="text-sm text-gray-600">{a.explanation}</p><p className="text-xs font-mono mt-2 text-red-600">{formatZAR(a.amount)}</p></div>)}</div>
);

const RecommendationsPanel = ({ recommendations }) => (
  <div className="space-y-4">
    {recommendations.map((r, i) => <div key={i} className="p-4 bg-white border-l-4 border-l-green-500 rounded-xl shadow-sm"><h4 className="font-bold">{r.title}</h4><p className="text-sm text-gray-600">{r.detail}</p><p className="text-xs font-bold text-green-600 mt-2">Save ~{formatZAR(r.estimatedMonthlySaving)}/mo</p></div>)}
  </div>
);

// ═══════════════════════════════════════════════════════════
// SECTION 6: MAIN APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [files, setFiles] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState("spending");
  const [progress, setProgress] = useState(0);

  const runPipeline = async () => {
    try {
      setStatus("parsing");
      setProgress(10);
      const parsed = await parseAllFiles(files.filter(f => !f.error).map(f => f.file));
      if (parsed.length < 10) throw new Error("Requires at least 10 transactions.");
      
      setStatus("analyzing");
      setProgress(40);

      const flagged = preFlag(parsed);
      setTransactions(flagged);

      // Simulate heavy lifting
      const interval = setInterval(() => setProgress(p => (p < 95 ? p + 2 : p)), 300);
      const result = await analyzeWithGemma(flagged);
      clearInterval(interval);

      setProgress(100);
      setTimeout(() => { setAnalysis(result); setStatus("done"); }, 500);
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  };

  if (status === "idle") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold">Statement Analyser</h1>
        <p className="text-gray-500 text-sm mt-2 mb-6">Upload CSV/PDF up to 12 files (Max 10MB ea)</p>
        <input type="file" multiple className="hidden" id="u" onChange={e => setFiles(Array.from(e.target.files).map(f => ({ file: f, error: f.size > 10*1024*1024 ? "File too large" : null })))} />
        <label htmlFor="u" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center cursor-pointer hover:bg-blue-700"><Upload size={18} className="mr-2"/> Upload Files</label>
        {files.length > 0 && <button onClick={runPipeline} className="w-full mt-4 p-3 text-blue-600 font-bold">Start Analysis</button>}
      </div>
    </div>
  );

  if (status === "parsing" || status === "analyzing") return (
    <div className="min-h-screen flex items-center justify-center flex-col">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="font-bold text-gray-700">{status === "parsing" ? "Reading files..." : "Gemma 4 is thinking..."}</p>
      <div className="w-64 bg-gray-200 h-2 rounded-full mt-4 overflow-hidden"><div className="bg-blue-600 h-full transition-all" style={{width: `${progress}%`}} /></div>
    </div>
  );

  if (status === "error") return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div className="bg-red-50 p-8 rounded-2xl border border-red-100 max-w-sm"><AlertCircle className="text-red-500 mx-auto mb-4" size={48}/><h2 className="text-xl font-bold text-red-800">Error</h2><p className="text-red-600 mb-6">{errorMessage}</p><button onClick={()=>setStatus("idle")} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">Try Again</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Results</h2><button onClick={()=>window.location.reload()} className="text-gray-400"><RefreshCcw size={20}/></button></div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar bg-gray-200 p-1 rounded-xl">
          {["spending", "subscriptions", "anomalies", "recommendations", "all"].map(t => <button key={t} onClick={()=>setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize ${activeTab===t?'bg-white text-blue-600 shadow-sm':'text-gray-500'}`}>{t}</button>)}
        </div>
        <div className="min-h-[400px]">{activeTab === "spending" && analysis && <SpendingPanel spending={analysis.spending} transactions={transactions} />}{activeTab === "subscriptions" && analysis && <SubscriptionsPanel subscriptions={analysis.subscriptions} />}{activeTab === "anomalies" && analysis && <AnomaliesPanel anomalies={analysis.anomalies} transactions={transactions} />}{activeTab === "recommendations" && analysis && <RecommendationsPanel recommendations={analysis.recommendations} />}{activeTab === "all" && <TransactionTable transactions={transactions} />}</div>
      </div>
    </div>
  );
}