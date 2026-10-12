import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, AppWindow, ArrowDownToLine, Bell, Building2,
  CheckCircle2, ChevronRight, CircleHelp, ExternalLink, FileSearch, Filter,
  LayoutDashboard, LoaderCircle, Plus, RefreshCw, Search, Shield, ShieldCheck,
  Smartphone, Users, X, LogIn, LogOut, LockKeyhole, Mail, UserPlus, UserRound
} from "lucide-react";
import api from "./services/api";

const nav = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "brands", label: "Brand Profile", icon: Building2 },
  { id: "social", label: "Social Monitoring", icon: Users },
  { id: "apps", label: "App Monitoring", icon: Smartphone },
  { id: "threats", label: "Threat Center", icon: ShieldAlertIcon }
];
function ShieldAlertIcon(props) { return <AlertTriangle {...props} />; }

const blankBrand = {
  name: "", website: "", logoUrl: "", keywords: "",
  platform: "Instagram", profileUrl: "", accountId: "",
  appName: "", packageId: "", publisher: "", storeUrl: ""
};

function scoreClass(level = "Low") {
  return level.toLowerCase();
}
function prettyDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}
function riskPill(level) {
  return <span className={`pill risk-${scoreClass(level)}`}>{level || "Low"}</span>;
}

function DashboardApp({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [summary, setSummary] = useState(null);
  const [latestScans, setLatestScans] = useState([]);
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState(blankBrand);
  const [savingBrand, setSavingBrand] = useState(false);
  const [filters, setFilters] = useState({ query: "", type: "all", riskLevel: "all", status: "all" });

  const loadBrands = useCallback(async () => {
    const { data } = await api.get("/brands");
    const list = data.brands || [];
    setBrands(list);
    setSelectedBrand(current => current && list.some(b => b._id === current) ? current : (list[0]?._id || ""));
    return list;
  }, []);

  const loadDashboard = useCallback(async () => {
    const { data } = await api.get("/dashboard");
    setSummary(data.summary);
    setLatestScans(data.latestScans || []);
  }, []);

  const loadThreats = useCallback(async () => {
    const params = {};
    if (selectedBrand) params.brandId = selectedBrand;
    if (filters.type !== "all") params.type = filters.type;
    if (filters.riskLevel !== "all") params.riskLevel = filters.riskLevel;
    if (filters.status !== "all") params.status = filters.status;
    const { data } = await api.get("/threats", { params });
    setThreats(data.threats || []);
  }, [selectedBrand, filters.type, filters.riskLevel, filters.status]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadBrands();
      await Promise.all([loadDashboard(), loadThreats()]);
    } catch {
      setError("Can't reach the API. Start the backend and confirm MongoDB is running.");
    } finally {
      setLoading(false);
    }
  }, [loadBrands, loadDashboard, loadThreats]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { loadThreats().catch(() => {}); }, [loadThreats]);

  const visibleThreats = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return threats.filter(t => !q || [
      t.candidateName, t.platform, t.username, t.developer, t.sourceUrl,
      ...(t.signals || []), ...(t.evidence || [])
    ].join(" ").toLowerCase().includes(q));
  }, [threats, filters.query]);

  async function createBrand(event) {
    event.preventDefault();
    setSavingBrand(true);
    setError("");
    setNotice("");
    const payload = {
      name: brandForm.name.trim(),
      website: brandForm.website.trim(),
      logoUrl: brandForm.logoUrl.trim(),
      keywords: brandForm.keywords.split(",").map(s => s.trim()).filter(Boolean),
      officialSocialAccounts: brandForm.profileUrl.trim() ? [{
        platform: brandForm.platform,
        profileUrl: brandForm.profileUrl.trim(),
        accountId: brandForm.accountId.trim()
      }] : [],
      officialApps: brandForm.appName.trim() ? [{
        appName: brandForm.appName.trim(),
        packageId: brandForm.packageId.trim(),
        publisher: brandForm.publisher.trim(),
        storeUrl: brandForm.storeUrl.trim()
      }] : []
    };
    try {
      const { data } = await api.post("/brands", payload);
      const list = await loadBrands();
      setSelectedBrand(data.brand._id);
      setBrandForm(blankBrand);
      setShowBrandForm(false);
      setNotice("Brand profile saved successfully.");
      setPage("brands");
      await Promise.all([loadDashboard(), loadThreats()]);
    } catch (e) {
      setError(e.response?.data?.message || "Could not create brand profile.");
    } finally {
      setSavingBrand(false);
    }
  }

  async function runScan(type) {
    if (!selectedBrand) {
      setNotice("Create or select a brand profile before scanning.");
      setPage("brands");
      return;
    }
    setScanLoading(type);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/scans/${type}`, { brandId: selectedBrand, source: "demo" });
      setNotice(`${data.message} Scanned ${data.summary.scannedCount}; excluded official assets: ${data.summary.excludedOfficialCount}; findings: ${data.summary.findings}.`);
      await Promise.all([loadDashboard(), loadThreats()]);
      setPage(type === "social" ? "social" : "apps");
    } catch (e) {
      setError(e.response?.data?.message || "Scan failed. Check the backend logs.");
    } finally {
      setScanLoading("");
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/threats/${id}/status`, { status });
      setNotice(`Threat status updated to ${status}.`);
      await Promise.all([loadThreats(), loadDashboard()]);
    } catch {
      setError("Could not update threat status.");
    }
  }

  function exportCsv() {
    const columns = ["candidateName", "type", "platform", "developer", "riskScore", "riskLevel", "status", "sourceUrl", "signals", "evidence"];
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [columns.join(","), ...visibleThreats.map(t => columns.map(k => quote(Array.isArray(t[k]) ? t[k].join("; ") : t[k])).join(","))];
    const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Trust Trace-threats.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const currentBrand = brands.find(b => b._id === selectedBrand);
  const title = nav.find(n => n.id === page)?.label || "Overview";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><div className="logo-icon"><ShieldCheck size={23} /></div><div><strong>Trust Trace <span>AI</span></strong><small>Digital Risk Protection</small></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}><Icon size={18} /><span>{item.label}</span>{page === item.id && <ChevronRight size={16} className="nav-chevron" />}</button>;
          })}
        </nav>
        <div className="sidebar-bottom"><div className="status-dot" /><div><strong>Prototype mode</strong><small>Demo / imported data</small></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Trust Trace AI</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <div className="top-actions">
            <span className="environment"><span className="status-dot" /> Local environment</span>
            <div className="account-chip" title={user.email}><span className="account-avatar"><UserRound size={15}/></span><span className="account-copy"><strong>{user.name}</strong><small>{user.role}</small></span></div>
            <button className="icon-button" title="Refresh data" onClick={refreshAll}><RefreshCw size={17} /></button>
            <button className="button secondary logout-button" onClick={onLogout}><LogOut size={15}/> Logout</button>
          </div>
        </header>

        <div className="content">
          <div className="page-intro">
            <div><p className="eyebrow">EXTERNAL ATTACK SURFACE</p><h1>{title}</h1><p className="muted">{page === "dashboard" ? "Monitor brand identity risks across social platforms and mobile app ecosystems." : page === "brands" ? "Register legitimate brand assets to guide detection and prevent false alerts." : page === "social" ? "Review profiles that may imitate your brand identity." : page === "apps" ? "Identify suspicious app listings, developers, and look-alike names." : "Investigate findings, review evidence, and track remediation."}</p></div>
            <div className="intro-actions">
              {page === "brands" && <button className="button primary" onClick={() => setShowBrandForm(v => !v)}><Plus size={17} /> Add brand</button>}
              {page === "social" && <button className="button primary" onClick={() => runScan("social")} disabled={!!scanLoading}><FileSearch size={17} /> {scanLoading === "social" ? "Scanning..." : "Run social scan"}</button>}
              {page === "apps" && <button className="button primary" onClick={() => runScan("apps")} disabled={!!scanLoading}><FileSearch size={17} /> {scanLoading === "apps" ? "Scanning..." : "Run app scan"}</button>}
              {(page === "threats" || page === "social" || page === "apps") && <button className="button secondary" onClick={exportCsv}><ArrowDownToLine size={17} /> Export CSV</button>}
            </div>
          </div>

          {error && <div className="alert error"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}
          {notice && <div className="alert info"><CheckCircle2 size={18} /><span>{notice}</span><button onClick={() => setNotice("")}><X size={16}/></button></div>}

          {page === "dashboard" && <Dashboard summary={summary} latestScans={latestScans} brands={brands} selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand} onSocial={() => runScan("social")} onApps={() => runScan("apps")} scanLoading={scanLoading} loading={loading} threats={threats.slice(0, 6)} goThreats={() => setPage("threats")} />}
          {page === "brands" && <BrandPage brands={brands} selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand} showForm={showBrandForm} setShowForm={setShowBrandForm} form={brandForm} setForm={setBrandForm} onSubmit={createBrand} saving={savingBrand} onRefresh={loadBrands} />}
          {page === "social" && <MonitorPage type="social" selectedBrand={currentBrand} threats={visibleThreats.filter(t => t.type === "social")} filters={filters} setFilters={setFilters} onScan={() => runScan("social")} scanning={scanLoading === "social"} onStatus={updateStatus} loading={loading} />}
          {page === "apps" && <MonitorPage type="app" selectedBrand={currentBrand} threats={visibleThreats.filter(t => t.type === "app")} filters={filters} setFilters={setFilters} onScan={() => runScan("apps")} scanning={scanLoading === "apps"} onStatus={updateStatus} loading={loading} />}
          {page === "threats" && <ThreatCenter threats={visibleThreats} filters={filters} setFilters={setFilters} onStatus={updateStatus} loading={loading} />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, caption, icon: Icon, accent = "" }) {
  return <div className="stat-card"><div className={`stat-icon ${accent}`}><Icon size={19} /></div><div className="stat-label">{label}</div><div className="stat-value">{value ?? "—"}</div><div className="stat-caption">{caption}</div></div>;
}

function Dashboard({ summary, latestScans, brands, selectedBrand, setSelectedBrand, onSocial, onApps, scanLoading, loading, threats, goThreats }) {
  const risks = summary?.risks || {};
  const totalRisk = ["Critical", "High", "Medium", "Low"].reduce((sum, k) => sum + (risks[k] || 0), 0) || 1;
  return <>
    <div className="banner"><div className="banner-symbol"><Shield size={26}/></div><div className="banner-copy"><strong>Brand identity protection at a glance</strong><p>Prioritize look-alike profiles and apps using explainable signals and trusted asset records.</p></div><div className="banner-tag"><span className="status-dot"/> Detection engine ready</div></div>
    <div className="toolbar-card"><div className="field-inline"><label htmlFor="brand-select">Monitored brand</label><select id="brand-select" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}><option value="">Select a brand</option>{brands.map(b => <option value={b._id} key={b._id}>{b.name}</option>)}</select></div><div className="toolbar-hint">Scans use demo candidates unless you provide custom records through the API.</div></div>
    <div className="stats-grid">
      <StatCard label="Registered brands" value={summary?.brandCount ?? 0} caption="Trusted asset profiles" icon={Building2} />
      <StatCard label="Threat findings" value={summary?.totalThreats ?? 0} caption="Stored candidate records" icon={AlertTriangle} accent="red" />
      <StatCard label="High / critical" value={summary?.highOrCritical ?? 0} caption="Priority review queue" icon={Activity} accent="orange" />
      <StatCard label="Resolved" value={summary?.resolved ?? 0} caption="Reviewed and closed" icon={CheckCircle2} accent="green" />
    </div>
    <div className="two-column">
      <section className="panel"><div className="panel-heading"><div><h2>Monitoring actions</h2><p>Run a sample scan for the selected brand</p></div><FileSearch size={19}/></div><div className="monitor-actions"><button className="monitor-action" onClick={onSocial} disabled={!selectedBrand || !!scanLoading}><span className="action-icon purple"><Users size={20}/></span><span><strong>Social media scan</strong><small>Profiles, handles and descriptions</small></span><ChevronRight size={17}/></button><button className="monitor-action" onClick={onApps} disabled={!selectedBrand || !!scanLoading}><span className="action-icon blue"><Smartphone size={20}/></span><span><strong>App store scan</strong><small>Names, developers and descriptions</small></span><ChevronRight size={17}/></button></div><div className="subtle-note"><CircleHelp size={15}/> Demo scan results are labeled; they are not live platform data.</div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Risk distribution</h2><p>All saved findings</p></div><Activity size={19}/></div><div className="risk-bars">{["Critical","High","Medium","Low"].map(level => <div className="risk-bar-row" key={level}><div className="risk-bar-label">{riskPill(level)}</div><div className="bar-track"><div className={`bar-fill ${scoreClass(level)}`} style={{width: `${Math.max((risks[level] || 0) / totalRisk * 100, risks[level] ? 4 : 0)}%`}}/></div><strong>{risks[level] || 0}</strong></div>)}</div><div className="subtle-note">Risk scores prioritize investigation; they do not confirm malicious intent.</div></section>
    </div>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Recent findings</h2><p>Highest-priority recent candidate records</p></div><button className="text-button" onClick={goThreats}>View threat center <ChevronRight size={15}/></button></div><ThreatTable threats={threats} onStatus={() => {}} compact /></section>
    <section className="panel"><div className="panel-heading"><div><h2>Recent scan activity</h2><p>Latest collection runs</p></div><Activity size={19}/></div>{latestScans.length ? <div className="scan-list">{latestScans.map(s => <div className="scan-row" key={s._id}><span className={`scan-type ${s.type}`}>{s.type === "social" ? <Users size={17}/> : <Smartphone size={17}/>}</span><div className="scan-meta"><strong>{s.type === "social" ? "Social media scan" : "App store scan"}</strong><small>{s.brandId?.name || "Brand"} · {s.sourceType} data · {prettyDate(s.createdAt)}</small></div><div className="scan-count">{s.scannedCount} scanned</div><span className="pill risk-low">{s.status}</span></div>)}</div> : <EmptyState title="No scans yet" detail="Run a social or app scan to see activity here."/>}</section>
  </>;
}

function BrandPage({ brands, selectedBrand, setSelectedBrand, showForm, setShowForm, form, setForm, onSubmit, saving, onRefresh }) {
  const change = e => setForm(current => ({ ...current, [e.target.name]: e.target.value }));
  return <>
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><h2>Create brand profile</h2><p>Register official identifiers before running scans.</p></div><button className="icon-button" onClick={() => setShowForm(false)}><X size={18}/></button></div><form onSubmit={onSubmit}>
      <div className="form-section-title">Company details</div><div className="form-grid">
        <label>Brand name *<input name="name" required maxLength="100" value={form.name} onChange={change} placeholder="e.g. NovaPay Demo"/></label>
        <label>Official website<input name="website" type="url" value={form.website} onChange={change} placeholder="https://example.com"/></label>
        <label>Logo URL<input name="logoUrl" type="url" value={form.logoUrl} onChange={change} placeholder="https://example.com/logo.png"/></label>
        <label>Brand keywords<input name="keywords" value={form.keywords} onChange={change} placeholder="NovaPay, Nova Pay, NovaPay Support"/></label>
      </div>
      <div className="form-section-title">Official social account (optional)</div><div className="form-grid">
        <label>Platform<select name="platform" value={form.platform} onChange={change}>{["Instagram","Facebook","LinkedIn","X","YouTube","TikTok","Other"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Profile URL<input name="profileUrl" type="url" value={form.profileUrl} onChange={change} placeholder="https://..."/></label>
        <label>Account ID<input name="accountId" value={form.accountId} onChange={change} placeholder="Stable platform ID if available"/></label>
      </div>
      <div className="form-section-title">Official app (optional)</div><div className="form-grid">
        <label>App name<input name="appName" value={form.appName} onChange={change} placeholder="Official app name"/></label>
        <label>Trusted publisher<input name="publisher" required={!!form.appName.trim()} value={form.publisher} onChange={change} placeholder="Publisher name"/></label>
        <label>Package / bundle ID<input name="packageId" value={form.packageId} onChange={change} placeholder="com.company.app"/></label>
        <label>Store listing URL<input name="storeUrl" type="url" value={form.storeUrl} onChange={change} placeholder="https://..."/></label>
      </div>
      <div className="form-footer"><span className="muted small">Official identifiers are used to suppress known legitimate assets.</span><button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} Save brand</button></div>
    </form></section>}
    <div className="section-toolbar"><div><strong>{brands.length} registered brand{brands.length === 1 ? "" : "s"}</strong><p className="muted small">Stored in your local MongoDB database</p></div><button className="button secondary" onClick={onRefresh}><RefreshCw size={16}/> Refresh</button></div>
    {brands.length ? <div className="brand-cards">{brands.map(b => <article className={`brand-profile-card ${selectedBrand === b._id ? "selected" : ""}`} key={b._id}><div className="brand-card-head"><div className="brand-logo-placeholder"><Building2 size={23}/></div><div className="brand-card-name"><h3>{b.name}</h3><small>Created {prettyDate(b.createdAt)}</small></div>{selectedBrand === b._id && <span className="pill risk-low">Selected</span>}</div>{b.website && <a className="website-link" href={b.website} target="_blank" rel="noreferrer">{b.website} <ExternalLink size={12}/></a>}<div className="asset-stats"><div><strong>{b.officialSocialAccounts?.length || 0}</strong><small>Social accounts</small></div><div><strong>{b.officialApps?.length || 0}</strong><small>Official apps</small></div><div><strong>{b.keywords?.length || 0}</strong><small>Keywords</small></div></div><div className="brand-assets"><strong>Trusted identifiers</strong>{(b.officialSocialAccounts || []).map((s,i) => <div className="asset-line" key={`s${i}`}><Users size={14}/><span>{s.platform}: {s.accountId || s.profileUrl}</span></div>)}{(b.officialApps || []).map((a,i) => <div className="asset-line" key={`a${i}`}><AppWindow size={14}/><span>{a.appName} · {a.packageId || a.publisher}</span></div>)}{!(b.officialSocialAccounts?.length || b.officialApps?.length) && <small className="muted">No official social or app identifiers registered yet.</small>}</div><button className={`button ${selectedBrand === b._id ? "secondary" : "primary"} full-button`} onClick={() => setSelectedBrand(b._id)}>{selectedBrand === b._id ? "Selected for monitoring" : "Select for monitoring"}</button></article>)}</div> : <EmptyState title="No brand profiles yet" detail="Create your first brand profile to enable monitoring scans." action={<button className="button primary" onClick={() => setShowForm(true)}><Plus size={16}/> Create brand</button>}/>}
    <div className="info-callout"><ShieldCheck size={19}/><div><strong>Official assets should not be flagged</strong><p>Register stable account IDs, app package IDs, and official listing URLs where available. Similar display names alone are not a reliable identity check.</p></div></div>
  </>;
}

function MonitorPage({ type, selectedBrand, threats, filters, setFilters, onScan, scanning, onStatus, loading }) {
  const social = type === "social";
  return <>
    {!selectedBrand ? <EmptyState title="Select a brand first" detail="Open Brand Profile and register or select a brand before scanning."/> : <div className="monitor-summary"><div className={`monitor-large-icon ${social ? "purple" : "blue"}`}>{social ? <Users size={25}/> : <Smartphone size={25}/>}</div><div className="monitor-summary-copy"><strong>Monitoring: {selectedBrand.name}</strong><p>Scan source: sample dataset · Findings are for demonstration, not live platform reports.</p></div><div className="monitor-summary-actions"><button className="button primary" onClick={onScan} disabled={scanning}>{scanning ? <LoaderCircle className="spin" size={16}/> : <FileSearch size={16}/>} {scanning ? "Scanning..." : "Run scan"}</button></div></div>}
    <div className="stats-grid small-stats"><StatCard label="Candidates shown" value={threats.length} caption="Matching current filters" icon={FileSearch}/><StatCard label="High / critical" value={threats.filter(t => ["High","Critical"].includes(t.riskLevel)).length} caption="Priority review" icon={AlertTriangle} accent="orange"/><StatCard label="Under review" value={threats.filter(t => t.status === "Under Review").length} caption="Investigation in progress" icon={Activity}/></div>
    <ThreatFilters filters={filters} setFilters={setFilters} showType={false}/>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>{social ? "Social profile findings" : "App listing findings"}</h2><p>{social ? "Potential look-alike profiles and scam signals" : "Potential look-alike apps and publisher discrepancies"}</p></div><span className="pill neutral">{threats.length} findings</span></div><ThreatTable threats={threats} onStatus={onStatus} loading={loading}/></section>
    <div className="info-callout"><CircleHelp size={19}/><div><strong>How to interpret scores</strong><p>Scores combine name similarity and available context. Publisher mismatch, logo similarity and suspicious links are heuristics. Validate the evidence before treating a candidate as malicious.</p></div></div>
  </>;
}

function ThreatFilters({ filters, setFilters, showType = true }) {
  const update = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  return <div className="filter-bar"><div className="search-box"><Search size={16}/><input value={filters.query} onChange={e => update("query", e.target.value)} placeholder="Search names, signals or evidence"/></div>{showType && <label className="filter-select"><Filter size={15}/><select value={filters.type} onChange={e => update("type", e.target.value)}><option value="all">All sources</option><option value="social">Social</option><option value="app">Apps</option></select></label>}<label className="filter-select"><select value={filters.riskLevel} onChange={e => update("riskLevel", e.target.value)}><option value="all">All risk levels</option>{["Critical","High","Medium","Low"].map(v => <option key={v}>{v}</option>)}</select></label><label className="filter-select"><select value={filters.status} onChange={e => update("status", e.target.value)}><option value="all">All statuses</option>{["New","Under Review","Resolved","Dismissed"].map(v => <option key={v}>{v}</option>)}</select></label></div>;
}

function ThreatCenter({ threats, filters, setFilters, onStatus, loading }) {
  return <><ThreatFilters filters={filters} setFilters={setFilters}/><section className="panel table-panel"><div className="panel-heading"><div><h2>All threat findings</h2><p>Search and triage detected candidates</p></div><span className="pill neutral">{threats.length} results</span></div><ThreatTable threats={threats} onStatus={onStatus} loading={loading}/></section></>;
}

function ThreatTable({ threats, onStatus, compact = false, loading = false }) {
  if (loading && !threats.length) return <div className="table-empty"><LoaderCircle className="spin" size={21}/> Loading findings...</div>;
  if (!threats.length) return <EmptyState title="No findings to display" detail="Run a scan or adjust the filters to view candidate findings." />;
  return <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Source</th><th>Risk</th><th>Score</th><th>Status</th>{!compact && <th>Evidence / review</th>}</tr></thead><tbody>{threats.map(t => <tr key={t._id}><td><div className="candidate-cell"><div className={`candidate-icon ${t.type}`}>{t.type === "social" ? <Users size={16}/> : <Smartphone size={16}/>}</div><div><strong>{t.candidateName}</strong><small>{t.username ? `@${t.username}` : t.developer || t.packageId || t.platform || "Candidate"}</small>{t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="source-link">Open evidence <ExternalLink size={11}/></a>}</div></div></td><td><span className="source-type">{t.type === "social" ? (t.platform || "Social") : "App listing"}</span><small className="source-mode">{t.sourceType || "demo"} data</small></td><td>{riskPill(t.riskLevel)}</td><td><div className="score-cell"><strong>{t.riskScore}</strong><div className="mini-track"><div className={`mini-fill ${scoreClass(t.riskLevel)}`} style={{width: `${t.riskScore}%`}}/></div></div></td><td><span className={`status-pill status-${t.status?.toLowerCase().replaceAll(" ", "-")}`}>{t.status}</span></td>{!compact && <td className="evidence-cell"><div>{(t.signals || []).slice(0, 3).map(s => <span className="signal-tag" key={s}>{s}</span>)}</div>{(t.evidence || []).slice(0, 2).map(e => <small key={e}>{e}</small>)}<select aria-label={`Update status for ${t.candidateName}`} value={t.status} onChange={e => onStatus(t._id, e.target.value)} className="status-select">{["New","Under Review","Resolved","Dismissed"].map(v => <option key={v}>{v}</option>)}</select></td>}</tr>)}</tbody></table></div>;
}

function EmptyState({ title, detail, action }) {
  return <div className="empty-state"><div className="empty-icon"><FileSearch size={23}/></div><strong>{title}</strong><p>{detail}</p>{action}</div>;
}


export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    let active = true;
    api.get("/auth/me")
      .then(({ data }) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
      const payload = authMode === "register"
        ? { name: authForm.name.trim(), email: authForm.email.trim(), password: authForm.password }
        : { email: authForm.email.trim(), password: authForm.password };
      const { data } = await api.post(endpoint, payload);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setAuthError(error.response?.data?.message || "Authentication failed. Make sure the backend and MongoDB are running.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* Clear the local view even if the API is offline. */ }
    setUser(null);
    setAuthMode("login");
    setAuthError("");
    setAuthNotice("You have been logged out.");
  }

  if (checkingSession) {
    return <div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={25}/> Checking your session...</div></div>;
  }
  if (user) return <DashboardApp user={user} onLogout={logout} />;

  return <div className="auth-screen">
    <div className="auth-glow auth-glow-one"/><div className="auth-glow auth-glow-two"/>
    <section className="auth-card">
      <div className="auth-brand"><div className="auth-logo"><ShieldCheck size={25}/></div><div><strong>Trust Trace <span>AI</span></strong><small>Digital Risk Protection</small></div></div>
      <div className="auth-heading"><p className="eyebrow">SECURE WORKSPACE</p><h1>{authMode === "login" ? "Welcome back" : "Create your account"}</h1><p>{authMode === "login" ? "Sign in to monitor brand identity risks." : "Register to start protecting your brand assets."}</p></div>
      {authError && <div className="auth-message error"><AlertTriangle size={16}/><span>{authError}</span></div>}
      {authNotice && <div className="auth-message success"><CheckCircle2 size={16}/><span>{authNotice}</span></div>}
      <form className="auth-form" onSubmit={submitAuth}>
        {authMode === "register" && <label>Full name<span className="auth-input"><UserRound size={16}/><input autoComplete="name" value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" minLength={2} maxLength={80} required/></span></label>}
        <label>Email address<span className="auth-input"><Mail size={16}/><input type="email" autoComplete="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" maxLength={254} required/></span></label>
        <label>Password<span className="auth-input"><LockKeyhole size={16}/><input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} placeholder={authMode === "login" ? "Enter your password" : "At least 8 characters"} minLength={8} maxLength={128} required/></span></label>
        {authMode === "register" && <p className="auth-hint">New accounts are created with the Analyst role. An administrator can be configured separately.</p>}
        <button className="button primary auth-submit" type="submit" disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" size={17}/> : authMode === "login" ? <LogIn size={17}/> : <UserPlus size={17}/>} {authBusy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <div className="auth-switch">{authMode === "login" ? "New to DigitalsShield AI?" : "Already have an account?"}<button onClick={() => { setAuthMode(m => m === "login" ? "register" : "login"); setAuthError(""); setAuthNotice(""); }} type="button">{authMode === "login" ? "Create account" : "Sign in"}</button></div>
      <div className="auth-security"><LockKeyhole size={14}/> Protected session · Passwords are hashed · 8-hour session</div>
    </section>
  </div>;
}
