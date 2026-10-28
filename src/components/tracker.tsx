"use client";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown,
  CircleDollarSign, ClipboardList, Cloud, Download, Filter, Gauge, LogOut, Plus, RefreshCw,
  ShieldCheck, Target, Trash2, TrendingDown, TrendingUp, Wallet, X
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar, Cell
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { dailyProfitSeries, netProfit, sportBreakdown, summarizeBets } from "@/lib/analytics";
import type { Bet, BetStatus, BetType, LedgerTransaction, Sport } from "@/lib/types";

const sports: Sport[] = ["Cricket", "Football", "Tennis", "Basketball", "Other"];
const statuses: BetStatus[] = ["pending", "won", "lost", "void", "cashout", "partial"];
const emptyForm = {
  sport: "Cricket" as Sport, event_name: "", market: "Match winner", selection: "", bookmaker: "",
  bet_type: "single" as BetType, odds: "1.90", stake: "100", status: "pending" as BetStatus,
  actual_return: "", placed_at: new Date().toISOString().slice(0,16), settled_at: "", notes: ""
};
const money = (n: number) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(Number.isFinite(n) ? n : 0);
const compactMoney = (n: number) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", notation:"compact", maximumFractionDigits:1 }).format(n);
const dateLabel = (s: string) => new Date(s).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
const csvEscape = (v: unknown) => `"${String(v ?? "").replaceAll('"','""')}"`;

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, hint, icon: Icon, positive }: {label:string; value:string; hint:string; icon: typeof Wallet; positive?:boolean}) {
  return <div className="panel p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><span className="text-sm muted">{label}</span><span className="rounded-xl border border-[#303746] bg-[#1a202b] p-2"><Icon size={17} className="text-[#aab4c6]"/></span></div>
    <div className={`metric-value mt-4 text-2xl sm:text-3xl font-semibold ${positive===undefined?"":positive?"text-[#51d6a0]":"text-[#ff7885]"}`}>{value}</div>
    <div className="mt-2 text-xs muted">{hint}</div>
  </div>;
}

export default function Tracker() {
  const [client, setClient] = useState<ReturnType<typeof createClient> | null>(null);
  const [configError, setConfigError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin"|"signup">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [initialBankroll, setInitialBankroll] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview"|"bets"|"analytics"|"wallet"|"settings">("overview");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({...emptyForm});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("All sports");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [period, setPeriod] = useState("all");
  const [txKind, setTxKind] = useState<"deposit"|"withdrawal">("deposit");
  const [txAmount, setTxAmount] = useState("1000");
  const [txNote, setTxNote] = useState("");

  useEffect(() => {
    try { setClient(createClient()); }
    catch (e) { setConfigError(e instanceof Error ? e.message : "Configuration error"); }
  }, []);

  const loadData = useCallback(async (c: ReturnType<typeof createClient>, userId: string) => {
    setPageError("");
    const [b, t, p] = await Promise.all([
      c.from("bets").select("*").eq("user_id", userId).order("placed_at", { ascending:false }).limit(5000),
      c.from("transactions").select("*").eq("user_id", userId).order("occurred_at", { ascending:false }).limit(5000),
      c.from("profiles").select("initial_bankroll").eq("id", userId).maybeSingle()
    ]);
    if (b.error || t.error) { setPageError(b.error?.message || t.error?.message || "Could not load records."); return; }
    setBets((b.data || []) as Bet[]);
    setTransactions((t.data || []) as LedgerTransaction[]);
    setInitialBankroll(Number(p.data?.initial_bankroll || 0));
  }, []);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    client.auth.getSession().then(({data}) => { if (alive) setSession(data.session); });
    const {data:{subscription}} = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setBets([]); setTransactions([]); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [client]);

  useEffect(() => {
    if (client && session?.user?.id) void loadData(client, session.user.id);
  }, [client, session?.user?.id, loadData]);

  const metrics = useMemo(() => summarizeBets(bets, transactions, initialBankroll), [bets, transactions, initialBankroll]);
  const series = useMemo(() => {
    const all = dailyProfitSeries(bets);
    if (period === "all") return all;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days + 1); cutoff.setHours(0,0,0,0);
    return all.filter(p => new Date(`${p.date}T12:00:00`) >= cutoff);
  }, [bets, period]);
  const breakdown = useMemo(() => sportBreakdown(bets), [bets]);
  const filteredBets = useMemo(() => bets.filter(b => {
    const haystack = [b.event_name,b.selection,b.market,b.bookmaker,b.sport].join(" ").toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) &&
      (sportFilter === "All sports" || b.sport === sportFilter) &&
      (statusFilter === "All statuses" || b.status === statusFilter);
  }), [bets, search, sportFilter, statusFilter]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault(); if (!client) return;
    setAuthBusy(true); setAuthMessage("");
    try {
      const result = authMode === "signup"
        ? await client.auth.signUp({email, password, options:{emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined}})
        : await client.auth.signInWithPassword({email, password});
      if (result.error) throw result.error;
      if (authMode === "signup" && !result.data.session) setAuthMessage("Account created. Check your email to confirm, then sign in.");
      else setAuthMessage("Signed in successfully.");
    } catch (e) { setAuthMessage(e instanceof Error ? e.message : "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function signOut() { if (client) await client.auth.signOut(); }

  function openNewBet() { setEditingId(null); setForm({...emptyForm, placed_at:new Date().toISOString().slice(0,16)}); setModal(true); }
  function openEditBet(b: Bet) {
    setEditingId(b.id);
    setForm({
      sport:b.sport, event_name:b.event_name, market:b.market, selection:b.selection, bookmaker:b.bookmaker || "",
      bet_type:b.bet_type, odds:String(b.odds), stake:String(b.stake), status:b.status,
      actual_return:b.actual_return == null ? "" : String(b.actual_return),
      placed_at:new Date(b.placed_at).toISOString().slice(0,16),
      settled_at:b.settled_at ? new Date(b.settled_at).toISOString().slice(0,16) : "", notes:b.notes || ""
    });
    setModal(true);
  }

  async function saveBet(e: React.FormEvent) {
    e.preventDefault(); if (!client || !session?.user?.id) return;
    setBusy(true); setPageError("");
    const stake = Number(form.stake), odds = Number(form.odds);
    if (!form.event_name.trim() || !form.selection.trim() || !Number.isFinite(stake) || stake <= 0 || !Number.isFinite(odds) || odds < 1) {
      setPageError("Enter an event, selection, positive stake and valid decimal odds (at least 1.00)."); setBusy(false); return;
    }
    if (form.status !== "pending" && form.status !== "void" && form.actual_return.trim() === "") {
      setPageError("Enter the actual total return for a settled bet. For a loss, enter 0."); setBusy(false); return;
    }
    const payload = {
      user_id:session.user.id, sport:form.sport, event_name:form.event_name.trim(), market:form.market.trim() || "Unspecified",
      selection:form.selection.trim(), bookmaker:form.bookmaker.trim(), bet_type:form.bet_type, odds, stake,
      status:form.status, actual_return:form.status === "void" ? stake : form.status === "pending" ? null : Number(form.actual_return),
      placed_at:new Date(form.placed_at).toISOString(),
      settled_at:form.status === "pending" ? null : (form.settled_at ? new Date(form.settled_at).toISOString() : new Date().toISOString()),
      notes:form.notes.trim() || null
    };
    try {
      const result = editingId
        ? await client.from("bets").update(payload).eq("id", editingId).eq("user_id",session.user.id).select().single()
        : await client.from("bets").insert(payload).select().single();
      if (result.error) throw result.error;
      setModal(false); await loadData(client, session.user.id);
    } catch (e) { setPageError(e instanceof Error ? e.message : "Could not save bet."); }
    finally { setBusy(false); }
  }

  async function deleteBet(b: Bet) {
    if (!client || !session?.user?.id || !window.confirm(`Delete "${b.event_name}"? This cannot be undone.`)) return;
    const {error} = await client.from("bets").delete().eq("id",b.id).eq("user_id",session.user.id);
    if (error) setPageError(error.message); else await loadData(client,session.user.id);
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault(); if (!client || !session?.user?.id) return;
    const amount = Number(txAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setPageError("Transaction amount must be greater than zero."); return; }
    setBusy(true);
    const {error} = await client.from("transactions").insert({user_id:session.user.id,kind:txKind,amount,note:txNote.trim()||null});
    if (error) setPageError(error.message);
    else { setTxAmount("1000"); setTxNote(""); await loadData(client,session.user.id); }
    setBusy(false);
  }

  async function saveInitialBankroll(e: React.FormEvent) {
    e.preventDefault(); if (!client || !session?.user?.id) return;
    const value = Number(initialBankroll);
    if (!Number.isFinite(value) || value < 0) { setPageError("Starting bankroll cannot be negative."); return; }
    const {error} = await client.from("profiles").upsert({id:session.user.id,initial_bankroll:value});
    if (error) setPageError(error.message); else setPageError("Starting bankroll saved.");
  }

  function exportCsv() {
    const headers = ["id","sport","event_name","market","selection","bookmaker","bet_type","odds","stake","status","actual_return","net_profit","placed_at","settled_at","notes"];
    const rows = filteredBets.map(b =>
      headers.map(h =>
        h === "net_profit"
          ? csvEscape(netProfit(b))
          : csvEscape(b[h as keyof Bet])
      )
    );
    downloadFile("betwise-bets.csv",[headers.join(","),...rows.map(r=>r.join(","))].join("\r\n"),"text/csv;charset=utf-8");
  }
  function backupJson() {
    downloadFile(`betwise-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:1,exported_at:new Date().toISOString(),currency:"INR",bets,transactions,initial_bankroll:initialBankroll},null,2),"application/json");
  }

  if (configError) return <div className="min-h-screen flex items-center justify-center p-5"><div className="panel w-full max-w-xl p-7">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-[#183a2f] p-3"><Activity className="text-[#51d6a0]"/></div><div><h1 className="text-2xl font-bold">Betwise</h1><p className="muted text-sm">Sports betting performance tracker</p></div></div>
    <div className="mt-6 rounded-xl border border-[#755c30] bg-[#332a19] p-4 text-sm text-[#f5ce7a]">Supabase setup is required before this app can connect to online storage.</div>
    <h2 className="mt-5 font-semibold">Quick setup</h2><ol className="mt-3 list-decimal pl-5 space-y-2 text-sm muted"><li>Create a project at <a className="text-[#6ce6b2] underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com/dashboard</a>.</li><li>Copy <code className="text-white">.env.example</code> to <code className="text-white">.env.local</code>.</li><li>Set <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> from Supabase Project Settings → API.</li><li>Run the SQL migration in <code className="text-white">supabase/schema.sql</code>, then restart the dev server.</li></ol>
    <pre className="mt-5 overflow-x-auto rounded-xl bg-black/40 p-4 text-sm">cp .env.example .env.local{"\n"}npm install{"\n"}npm run dev</pre>
  </div></div>;

  if (!session) return <main className="min-h-screen grid lg:grid-cols-2">
    <section className="hidden lg:flex flex-col justify-between p-12 border-r border-[#252b37] bg-[radial-gradient(ellipse_at_top_left,#183a30_0%,#0b0e14_48%,#090b10_100%)]">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-[#183a2f] p-3"><Activity className="text-[#51d6a0]"/></div><span className="text-xl font-bold">betwise<span className="text-[#51d6a0]">.</span></span></div>
      <div><p className="text-xs uppercase tracking-[.25em] text-[#51d6a0]">Your data. Your decisions.</p><h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-tight">Know your numbers.<br/><span className="text-[#51d6a0]">Track every outcome.</span></h1><p className="mt-5 max-w-lg leading-7 muted">A private ledger for recording sports bets, tracking settled profit and loss, and reviewing your history with clear analytics.</p><div className="mt-9 grid grid-cols-2 gap-3"><div className="panel p-4"><TrendingUp className="text-[#51d6a0]"/><p className="mt-3 font-semibold">Performance</p><p className="mt-1 text-xs muted">Daily and long-term reports</p></div><div className="panel p-4"><ShieldCheck className="text-[#51d6a0]"/><p className="mt-3 font-semibold">Private by design</p><p className="mt-1 text-xs muted">Your account, your records</p></div></div></div>
      <p className="text-xs muted">Personal record-keeping only · Currency: INR (₹)</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10"><form onSubmit={submitAuth} className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="rounded-xl bg-[#183a2f] p-3"><Activity className="text-[#51d6a0]"/></div><span className="text-xl font-bold">betwise<span className="text-[#51d6a0]">.</span></span></div>
      <p className="text-sm text-[#51d6a0]">{authMode==="signin"?"WELCOME BACK":"GET STARTED"}</p><h2 className="mt-2 text-3xl font-semibold">{authMode==="signin"?"Sign in to Betwise":"Create your account"}</h2><p className="mt-2 text-sm muted">Your betting records are private to your account.</p>
      <label className="mt-7 block text-sm">Email address<input className="field mt-2" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label className="mt-4 block text-sm">Password<input className="field mt-2" type="password" required minLength={8} autoComplete={authMode==="signin"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
      {authMessage && <p className="mt-4 rounded-lg border border-[#303746] p-3 text-sm muted">{authMessage}</p>}
      <button className="btn btn-primary mt-6 w-full" disabled={authBusy}>{authBusy?"Please wait…":authMode==="signin"?"Sign in":"Create account"}</button>
      <p className="mt-5 text-center text-sm muted">{authMode==="signin"?"New to Betwise?":"Already have an account?"} <button type="button" className="text-[#6ce6b2] underline" onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthMessage("");}}>{authMode==="signin"?"Create an account":"Sign in"}</button></p>
      <p className="mt-8 text-center text-xs muted">Tracking and reporting only. No betting, deposits or wagering transactions are processed by this app.</p>
    </form></section>
  </main>;

  const nav = [
    {id:"overview",label:"Overview",icon:Gauge},{id:"bets",label:"Bet history",icon:ClipboardList},
    {id:"analytics",label:"Analytics",icon:BarChart3},{id:"wallet",label:"Bankroll ledger",icon:Wallet},
    {id:"settings",label:"Settings & backups",icon:ShieldCheck}
  ] as const;

  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-[#252b37] bg-[#0d1016] p-5 lg:flex">
      <div className="flex items-center gap-3 px-2 py-3"><div className="rounded-xl bg-[#183a2f] p-2.5"><Activity className="text-[#51d6a0]"/></div><span className="text-lg font-bold">betwise<span className="text-[#51d6a0]">.</span></span></div>
      <p className="mt-9 px-3 text-[10px] font-semibold uppercase tracking-[.18em] muted">Workspace</p>
      <nav className="mt-3 space-y-1">{nav.map(item=><button key={item.id} onClick={()=>setActiveTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${activeTab===item.id?"bg-[#183a30] text-[#6ce6b2]":"text-[#aab2c0] hover:bg-[#171c26]"}`}><item.icon size={17}/>{item.label}</button>)}</nav>
      <div className="mt-auto panel p-4"><div className="flex items-center gap-2 text-xs text-[#6ce6b2]"><Cloud size={15}/> Cloud sync enabled</div><p className="mt-2 break-all text-xs muted">{session.user.email}</p><button onClick={signOut} className="btn mt-4 w-full text-xs"><LogOut size={14}/> Sign out</button></div>
    </aside>
    <main className="min-w-0 lg:ml-60">
      <header className="sticky top-0 z-10 border-b border-[#252b37] bg-[#090b10]/90 px-4 py-3 backdrop-blur-xl sm:px-7 lg:px-9">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3"><div><div className="flex items-center gap-2 lg:hidden"><Activity className="text-[#51d6a0]" size={20}/><span className="font-bold">betwise.</span></div><h1 className="hidden text-lg font-semibold sm:block">{nav.find(n=>n.id===activeTab)?.label}</h1><p className="hidden text-xs muted sm:block">Your personal sports performance ledger</p></div><div className="flex items-center gap-2"><span className="hidden rounded-full border border-[#254536] bg-[#10251d] px-3 py-1.5 text-xs text-[#6ce6b2] sm:inline-flex"><span className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-[#51d6a0]"/>Synced</span><button className="btn btn-primary text-sm" onClick={openNewBet}><Plus size={16}/> <span className="hidden sm:inline">Add bet</span><span className="sm:hidden">Add</span></button></div></div>
        <nav className="mt-3 flex gap-1 overflow-x-auto lg:hidden">{nav.map(item=><button key={item.id} onClick={()=>setActiveTab(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs ${activeTab===item.id?"bg-[#183a30] text-[#6ce6b2]":"text-[#aab2c0]"}`}>{item.label}</button>)}</nav>
      </header>
      <div className="mx-auto max-w-[1600px] p-4 sm:p-7 lg:p-9">
        {pageError && <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#74434a] bg-[#301b20] p-3 text-sm text-[#ffabb3]"><span>{pageError}</span><button onClick={()=>setPageError("")}><X size={16}/></button></div>}
        {activeTab==="overview" && <>
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm muted">Welcome back</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your performance at a glance</h2><p className="mt-2 text-sm muted">Only settled bets count toward realized P/L and ROI.</p></div><button className="btn self-start text-sm sm:self-auto" onClick={()=>client&&loadData(client,session.user.id)}><RefreshCw size={15}/> Refresh data</button></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Net profit / loss" value={money(metrics.profit)} hint={`${metrics.settledBets} settled bets`} icon={metrics.profit>=0?TrendingUp:TrendingDown} positive={metrics.profit>=0}/>
            <Metric label="Settled ROI" value={`${metrics.roi.toFixed(1)}%`} hint="Profit ÷ settled stake" icon={Target} positive={metrics.roi>=0}/>
            <Metric label="Bankroll balance" value={money(metrics.bankroll)} hint="Opening balance + ledger + P/L" icon={Wallet}/>
            <Metric label="Pending exposure" value={money(metrics.pendingExposure)} hint={`${metrics.pendingBets} unsettled bets` } icon={CircleDollarSign}/>
            <Metric label="Total returned" value={money(metrics.totalReturned)} hint={`Settled stakes: ${money(metrics.totalStaked)}`} icon={ArrowDownToLine}/>
            <Metric label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} hint={`${metrics.wins} wins · ${metrics.losses} losses`} icon={Check}/>
            <Metric label="Average daily P/L" value={money(metrics.avgDailyProfit)} hint={`${metrics.calendarDays} calendar days since first settlement`} icon={CalendarDays} positive={metrics.avgDailyProfit>=0}/>
            <Metric label="Average active-day P/L" value={money(metrics.avgActiveDayProfit)} hint={`${metrics.activeDays} days with settled bets`} icon={Activity} positive={metrics.avgActiveDayProfit>=0}/>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
            <section className="panel p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Profit & loss</h3><p className="mt-1 text-xs muted">Daily settled net result</p></div><select className="field w-auto py-2 text-xs" value={period} onChange={e=>setPeriod(e.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select></div>
              <div className="mt-5 h-64">{series.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={series}><defs><linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#51d6a0" stopOpacity={0.28}/><stop offset="95%" stopColor="#51d6a0" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#252b37" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fill:"#929bad",fontSize:11}} axisLine={false} tickLine={false}/><YAxis tickFormatter={compactMoney} tick={{fill:"#929bad",fontSize:11}} axisLine={false} tickLine={false} width={68}/><Tooltip contentStyle={{background:"#11151d",border:"1px solid #303746",borderRadius:10,color:"#fff"}} formatter={(v)=>[money(Number(v)),"Net P/L"]}/><Area type="monotone" dataKey="profit" stroke="#51d6a0" strokeWidth={2.5} fill="url(#profitFill)" activeDot={{r:4}}/></AreaChart></ResponsiveContainer> : <div className="flex h-full flex-col items-center justify-center text-center"><BarChart3 size={28} className="muted"/><p className="mt-3 text-sm">No settled bets yet</p><p className="mt-1 text-xs muted">Add a bet and settle it to see your trend.</p></div>}</div>
            </section>
            <section className="panel p-4 sm:p-5"><div><h3 className="font-semibold">By sport</h3><p className="mt-1 text-xs muted">Net result by category</p></div><div className="mt-4 h-60">{breakdown.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={breakdown} layout="vertical" margin={{left:4,right:12}}><CartesianGrid stroke="#252b37" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={compactMoney} tick={{fill:"#929bad",fontSize:10}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="sport" width={80} tick={{fill:"#b8c0ce",fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#11151d",border:"1px solid #303746",borderRadius:10}} formatter={(v)=>money(Number(v))}/><Bar dataKey="profit" radius={[0,5,5,0]}>{breakdown.map(r=><Cell key={r.sport} fill={r.profit>=0?"#51d6a0":"#ff7885"}/>)}</Bar></BarChart></ResponsiveContainer> : <p className="pt-10 text-center text-sm muted">Your sport breakdown will appear here.</p>}</div>
              <div className="mt-2 space-y-3">{breakdown.slice(0,4).map(r=><div key={r.sport} className="flex items-center justify-between text-sm"><span>{r.sport} <span className="muted">· {r.bets} bets</span></span><span className={r.profit>=0?"text-[#51d6a0]":"text-[#ff7885]"}>{money(r.profit)}</span></div>)}</div>
            </section>
          </div>
          <section className="panel mt-5 p-4 sm:p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Recent bets</h3><p className="mt-1 text-xs muted">Your latest activity</p></div><button className="text-sm text-[#6ce6b2]" onClick={()=>setActiveTab("bets")}>View all →</button></div><BetTable bets={bets.slice(0,5)} onEdit={openEditBet} onDelete={deleteBet}/></section>
        </>}
        {activeTab==="bets" && <><div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold">Bet history</h2><p className="mt-1 text-sm muted">Review, filter and edit your records.</p></div><button className="btn" onClick={exportCsv}><Download size={15}/> Export filtered CSV</button></div>
          <section className="panel p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><input className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search event, selection, bookmaker…"/><select className="field" value={sportFilter} onChange={e=>setSportFilter(e.target.value)}><option>All sports</option>{sports.map(s=><option key={s}>{s}</option>)}</select><select className="field" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></div><div className="mt-3 flex items-center justify-between text-xs muted"><span><Filter size={13} className="mr-1 inline"/> {filteredBets.length} records</span><button className="underline" onClick={()=>{setSearch("");setSportFilter("All sports");setStatusFilter("All statuses");}}>Clear filters</button></div><BetTable bets={filteredBets} onEdit={openEditBet} onDelete={deleteBet}/></section>
        </>}
        {activeTab==="analytics" && <><div className="mb-5"><h2 className="text-2xl font-semibold">Performance analytics</h2><p className="mt-1 text-sm muted">Historical reporting based on your saved records.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total bets" value={String(metrics.totalBets)} hint={`${metrics.settledBets} settled`} icon={ClipboardList}/><Metric label="Average stake" value={money(metrics.averageStake)} hint="Per settled record" icon={CircleDollarSign}/><Metric label="Total staked" value={money(metrics.totalStaked)} hint="Excludes void bets" icon={ArrowUpRight}/><Metric label="Average daily P/L" value={money(metrics.avgDailyProfit)} hint="From first settlement to today" icon={CalendarDays} positive={metrics.avgDailyProfit>=0}/></div>
          <section className="panel mt-5 p-5"><h3 className="font-semibold">Cumulative net profit</h3><p className="mt-1 text-xs muted">Running total of settled results, ordered by settlement date.</p><div className="mt-5 h-72">{series.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={series.map((r,i,a)=>({...r,cumulative:a.slice(0,i+1).reduce((s,x)=>s+x.profit,0)}))}><CartesianGrid stroke="#252b37" strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:"#929bad",fontSize:11}}/><YAxis tickFormatter={compactMoney} tick={{fill:"#929bad",fontSize:11}}/><Tooltip contentStyle={{background:"#11151d",border:"1px solid #303746",borderRadius:10}} formatter={(v)=>money(Number(v))}/><Area dataKey="cumulative" stroke="#51d6a0" fill="#51d6a0" fillOpacity={.1}/></AreaChart></ResponsiveContainer>:<p className="pt-20 text-center muted">Settle a bet to start your analytics.</p>}</div></section>
          <section className="panel mt-5 p-5"><h3 className="font-semibold">Sport performance table</h3><div className="table-wrap mt-3"><table><thead><tr><th>Sport</th><th>Bets</th><th>Net P/L</th><th>Settled stake</th><th>ROI</th></tr></thead><tbody>{breakdown.map(r=><tr key={r.sport}><td>{r.sport}</td><td>{r.bets}</td><td className={r.profit>=0?"text-[#51d6a0]":"text-[#ff7885]"}>{money(r.profit)}</td><td>{money(r.staked)}</td><td>{r.staked?(r.profit/r.staked*100).toFixed(1)+"%":"—"}</td></tr>)}</tbody></table></div></section>
        </>}
        {activeTab==="wallet" && <><div className="mb-5"><h2 className="text-2xl font-semibold">Bankroll ledger</h2><p className="mt-1 text-sm muted">Track external deposits and withdrawals separately from betting performance.</p></div><div className="grid gap-4 sm:grid-cols-3"><Metric label="Current tracked balance" value={money(metrics.bankroll)} hint="Opening bankroll + net P/L + net deposits" icon={Wallet}/><Metric label="Deposits" value={money(metrics.deposits)} hint="Money added to bankroll" icon={ArrowDownToLine}/><Metric label="Withdrawals" value={money(metrics.withdrawals)} hint="Money removed from bankroll" icon={ArrowUpRight}/></div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2"><form onSubmit={addTransaction} className="panel p-5"><h3 className="font-semibold">Add ledger transaction</h3><p className="mt-1 text-xs muted">This records a manual balance movement; it does not place a bet.</p><label className="mt-4 block text-sm">Transaction type<select className="field mt-2" value={txKind} onChange={e=>setTxKind(e.target.value as "deposit" | "withdrawal")}><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></label><label className="mt-3 block text-sm">Amount (₹)<input className="field mt-2" type="number" min="0.01" step="0.01" required value={txAmount} onChange={e=>setTxAmount(e.target.value)}/></label><label className="mt-3 block text-sm">Note (optional)<input className="field mt-2" value={txNote} onChange={e=>setTxNote(e.target.value)} placeholder="e.g. Opening wallet top-up"/></label><button className="btn btn-primary mt-4" disabled={busy}>Save transaction</button></form>
          <form onSubmit={saveInitialBankroll} className="panel p-5"><h3 className="font-semibold">Opening bankroll</h3><p className="mt-1 text-xs muted">Set the balance you started tracking with. This is not counted as profit.</p><label className="mt-4 block text-sm">Initial amount (₹)<input className="field mt-2" type="number" min="0" step="0.01" required value={initialBankroll} onChange={e=>setInitialBankroll(Number(e.target.value))}/></label><button className="btn mt-4">Save opening balance</button></form></div>
          <section className="panel mt-5 p-5"><h3 className="font-semibold">Recent transactions</h3><div className="table-wrap mt-3"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>{dateLabel(t.occurred_at)}</td><td className="capitalize">{t.kind}</td><td>{money(t.amount)}</td><td className="muted">{t.note||"—"}</td></tr>)}{!transactions.length&&<tr><td colSpan={4} className="muted">No transactions yet.</td></tr>}</tbody></table></div></section>
        </>}
        {activeTab==="settings" && <><div className="mb-5"><h2 className="text-2xl font-semibold">Settings & backups</h2><p className="mt-1 text-sm muted">Export a portable copy of your records at any time.</p></div><div className="grid gap-4 xl:grid-cols-2"><section className="panel p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#183a30] p-3"><Download className="text-[#6ce6b2]"/></div><div><h3 className="font-semibold">Export data</h3><p className="text-xs muted">Keep an independent copy of your data.</p></div></div><button className="btn btn-primary mt-5 w-full" onClick={backupJson}>Download full JSON backup</button><button className="btn mt-2 w-full" onClick={exportCsv}>Download bets as CSV</button><p className="mt-3 text-xs muted">JSON contains bets, transactions and opening bankroll. Store backups somewhere private.</p></section><section className="panel p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#183a30] p-3"><ShieldCheck className="text-[#6ce6b2]"/></div><div><h3 className="font-semibold">Privacy & security</h3><p className="text-xs muted">Security depends on correctly applying the included SQL policies.</p></div></div><ul className="mt-5 space-y-3 text-sm"><li className="flex gap-2"><Check size={16} className="shrink-0 text-[#51d6a0]"/> Supabase email/password authentication</li><li className="flex gap-2"><Check size={16} className="shrink-0 text-[#51d6a0]"/> Row Level Security per user</li><li className="flex gap-2"><Check size={16} className="shrink-0 text-[#51d6a0]"/> Public client key only; no service-role key in browser</li><li className="flex gap-2"><Check size={16} className="shrink-0 text-[#51d6a0]"/> Confirmation before deleting bets</li></ul><p className="mt-4 rounded-lg border border-[#755c30] bg-[#332a19] p-3 text-xs text-[#f5ce7a]">This is a manual export, not an automatic cloud backup schedule. Keep a separate copy periodically.</p></section></div><section className="panel mt-5 p-5"><h3 className="font-semibold">Account</h3><p className="mt-1 text-sm muted">Signed in as {session.user.email}</p><button className="btn mt-4" onClick={signOut}><LogOut size={15}/> Sign out</button></section></>}
        <footer className="mt-8 flex flex-col gap-2 border-t border-[#252b37] py-5 text-xs muted sm:flex-row sm:items-center sm:justify-between"><span>Betwise · Personal record-keeping · INR</span><span>Track outcomes, not predictions. Set limits and take breaks.</span></footer>
      </div>
    </main>
    {modal && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"><form onSubmit={saveBet} className="my-4 w-full max-w-3xl rounded-2xl border border-[#303746] bg-[#11151d] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[#51d6a0]">{editingId?"UPDATE RECORD":"NEW RECORD"}</p><h2 className="mt-1 text-2xl font-semibold">{editingId?"Edit bet":"Add a bet"}</h2><p className="mt-1 text-sm muted">Record details and settle the outcome when known.</p></div><button type="button" className="btn" onClick={()=>setModal(false)}><X size={16}/></button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Sport<select className="field mt-2" value={form.sport} onChange={e=>setForm({...form,sport:e.target.value as Sport})}>{sports.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="text-sm sm:col-span-1 lg:col-span-2">Match / event<input className="field mt-2" required value={form.event_name} onChange={e=>setForm({...form,event_name:e.target.value})} placeholder="e.g. India vs Australia"/></label>
        <label className="text-sm">Market<input className="field mt-2" value={form.market} onChange={e=>setForm({...form,market:e.target.value})} placeholder="Match winner"/></label>
        <label className="text-sm">Selection<input className="field mt-2" required value={form.selection} onChange={e=>setForm({...form,selection:e.target.value})} placeholder="e.g. India"/></label>
        <label className="text-sm">Bookmaker / platform<input className="field mt-2" value={form.bookmaker} onChange={e=>setForm({...form,bookmaker:e.target.value})} placeholder="Optional"/></label>
        <label className="text-sm">Bet type<select className="field mt-2" value={form.bet_type} onChange={e=>setForm({...form,bet_type:e.target.value as BetType})}><option value="single">Single</option><option value="accumulator">Accumulator / parlay</option><option value="system">System</option></select></label>
        <label className="text-sm">Decimal odds<input className="field mt-2" required type="number" min="1" step="0.01" value={form.odds} onChange={e=>setForm({...form,odds:e.target.value})}/></label>
        <label className="text-sm">Stake (₹)<input className="field mt-2" required type="number" min="0.01" step="0.01" value={form.stake} onChange={e=>setForm({...form,stake:e.target.value})}/></label>
        <label className="text-sm">Status<select className="field mt-2" value={form.status} onChange={e=>setForm({...form,status:e.target.value as BetStatus,actual_return:e.target.value==="lost"?"0":e.target.value==="void"?form.stake:form.actual_return})}>{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></label>
        <label className="text-sm">Actual total return (₹)<input className="field mt-2" type="number" min="0" step="0.01" disabled={form.status==="pending"||form.status==="void"} value={form.status==="void"?form.stake:form.actual_return} onChange={e=>setForm({...form,actual_return:e.target.value})} placeholder={form.status==="lost"?"0":"Enter payout including stake"}/><span className="mt-1 block text-[11px] muted">For a win, include the returned stake. For a loss, enter 0.</span></label>
        <label className="text-sm">Placed at<input className="field mt-2" type="datetime-local" required value={form.placed_at} onChange={e=>setForm({...form,placed_at:e.target.value})}/></label>
        <label className="text-sm">Settled at (optional)<input className="field mt-2" type="datetime-local" value={form.settled_at} onChange={e=>setForm({...form,settled_at:e.target.value})}/></label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">Notes<textarea className="field mt-2 min-h-20" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional notes for your own records"/></label>
      </div>
      <div className="mt-5 rounded-xl border border-[#303746] bg-[#0b0e14] p-4"><p className="text-xs muted">Potential total payout at current odds</p><p className="mt-1 text-xl font-semibold text-[#6ce6b2]">{money(Number(form.stake||0)*Number(form.odds||0))}</p><p className="mt-1 text-xs muted">Illustrative gross payout if a standard single bet wins. Accumulator/system terms can differ.</p></div>
      <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row"><button type="button" className="btn" onClick={()=>setModal(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?"Saving…":editingId?"Save changes":"Save bet"}</button></div>
    </form></div>}
  </div>;
}

function BetTable({bets,onEdit,onDelete}:{bets:Bet[];onEdit:(b:Bet)=>void;onDelete:(b:Bet)=>void}) {
  if (!bets.length) return <div className="py-12 text-center"><ClipboardList size={28} className="mx-auto muted"/><p className="mt-3 text-sm">No bets found</p><p className="mt-1 text-xs muted">Add a record or change your filters.</p></div>;
  return <div className="table-wrap mt-3"><table><thead><tr><th>Event / selection</th><th>Sport</th><th>Stake</th><th>Odds</th><th>Status</th><th>Net P/L</th><th>Placed</th><th>Actions</th></tr></thead><tbody>{bets.map(b=><tr key={b.id}><td><div className="font-medium">{b.event_name}</div><div className="mt-1 text-xs muted">{b.selection} · {b.market}</div></td><td>{b.sport}</td><td>{money(b.stake)}</td><td>{Number(b.odds).toFixed(2)}</td><td><span className={`pill pill-${b.status}`}>{b.status}</span></td><td className={netProfit(b)>=0?"text-[#51d6a0]":"text-[#ff7885]"}>{b.status==="pending"?"—":money(netProfit(b))}</td><td className="whitespace-nowrap">{dateLabel(b.placed_at)}</td><td><div className="flex gap-2"><button title="Edit" className="btn px-2 py-1.5" onClick={()=>onEdit(b)}><ChevronDown size={14}/></button><button title="Delete" className="btn px-2 py-1.5 text-[#ff929e]" onClick={()=>onDelete(b)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>;
}
