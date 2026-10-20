import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onIdTokenChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Download, LogOut, ShieldCheck, Check, Ban, Send } from "lucide-react";
import { firebaseApp, firebaseAuth, firestore } from "../lib/firebaseClient";
import { dataService } from "../lib/dataService";

type Grant = { id: string; email?: string; status: string; scopes: string[]; allowAmounts: boolean; allowExport: boolean; reportIds?: string[] };
type Report = { id: string; scope: string; includesAmounts: boolean; rows: { label: string; date: string; amount?: number }[] };
const reportScopes = ["sales", "expenses", "ledger"];
async function call(name: string, data: unknown) {
  if (!firebaseApp) throw new Error("Firebase must be configured.");
  return httpsCallable(getFunctions(firebaseApp), name)(data);
}
const message = (error: unknown) => error instanceof Error ? error.message : "Request failed.";

export function useCaIdentity() {
  const [identity, setIdentity] = useState<{ loading: boolean; user: User | null; role?: string; factoryId?: string; active?: boolean }>({ loading: !!firebaseAuth, user: null });
  useEffect(() => {
    if (!firebaseAuth) return;
    let version = 0;
    const unsubscribe = onIdTokenChanged(firebaseAuth, async user => {
      const current = ++version;
      if (!user) { setIdentity({ loading: false, user: null }); return; }
      try {
        const { claims } = await user.getIdTokenResult();
        if (current === version) setIdentity({ loading: false, user, role: typeof claims.role === "string" ? claims.role : undefined, factoryId: typeof claims.factory_id === "string" ? claims.factory_id : undefined, active: claims.active === true });
      } catch { if (current === version) setIdentity({ loading: false, user: null }); }
    });
    return () => { version++; unsubscribe(); };
  }, []);
  return identity;
}

export function CaPortal() {
  const identity = useCaIdentity();
  const [form, setForm] = useState({ email: "", password: "", factoryId: "" });
  const [register, setRegister] = useState(false);
  const [grant, setGrant] = useState<Grant | null>(null);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setGrant(null); setReports({});
    if (!identity.user || identity.role !== "ca" || !identity.factoryId || !firestore) return;
    let active = true;
    const unsubscribe = onSnapshot(doc(firestore, "factories", identity.factoryId, "caAccess", identity.user.uid), snapshot => {
      if (!active) return;
      const value = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Grant : null;
      setGrant(value); setReports({});
      if (value?.status === "denied") { setError("Admin denied or revoked access."); if (firebaseAuth) void signOut(firebaseAuth); }
    }, () => { setGrant(null); setReports({}); setError("Access could not be verified."); });
    return () => { active = false; unsubscribe(); };
  }, [identity.user?.uid, identity.role, identity.factoryId]);
  useEffect(() => {
    setReports({});
    if (grant?.status !== "approved" || !identity.factoryId || !firestore) return;
    let active = true;
    const unsubscribes = (grant.reportIds || []).map(reportId => onSnapshot(doc(firestore!, "factories", identity.factoryId!, "caReports", reportId), snapshot => {
      if (!active || !snapshot.exists()) return;
      const report = { ...snapshot.data(), id: snapshot.id } as Report;
      if (!grant.scopes.includes(report.scope) || (report.includesAmounts && !grant.allowAmounts)) return;
      setReports(current => ({ ...current, [report.id]: report }));
    }, () => { if (active) setReports(current => { const next = { ...current }; delete next[reportId]; return next; }); }));
    return () => { active = false; unsubscribes.forEach(unsubscribe => unsubscribe()); };
  }, [grant, identity.factoryId]);
  const login = async (event: React.FormEvent) => {
    event.preventDefault(); if (!firebaseAuth || busy) return;
    setBusy(true); setError("");
    try {
      const result = await (register ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(firebaseAuth, form.email, form.password);
      if (register || !(await result.user.getIdTokenResult()).claims.role) await call("requestCaAccess", { factoryId: form.factoryId });
      await result.user.getIdToken(true);
    } catch (failure) { setError(message(failure)); if (firebaseAuth) await signOut(firebaseAuth); }
    finally { setBusy(false); }
  };
  function download(report: Report) {
    if (grant?.status !== "approved" || !grant.allowExport) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `${report.scope}-${report.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <main className="ca-portal"><header className="ca-header"><h1><ShieldCheck size={24} /> CA Portal</h1>{identity.user && <button className="btn-outline" onClick={() => firebaseAuth && signOut(firebaseAuth)}><LogOut size={16} /> Sign out</button>}</header>
    {error && <p role="alert" className="ca-error">{error}</p>}
    {!firebaseApp ? <p>Firebase is required for CA login. Demo data is not shared.</p> : identity.loading ? <p role="status">Verifying access...</p> : !identity.user ? <form className="ca-login" onSubmit={login}><h2>{register ? "Request CA access" : "CA Login"}</h2><label>Email<input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Password<input type="password" required minLength={12} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>{register && <label>Factory ID<input required value={form.factoryId} onChange={event => setForm({ ...form, factoryId: event.target.value })} /></label>}<button className="btn-primary" disabled={busy}>{busy ? "Please wait..." : register ? "Request access" : "Sign in"}</button><button type="button" className="btn-outline" onClick={() => setRegister(!register)}>{register ? "Existing account" : "New CA account"}</button></form> : identity.role !== "ca" ? <p>A separate CA account is required. <a href="/">Return to Factory OS</a></p> : grant?.status !== "approved" ? <p role="status">Awaiting factory admin approval. No reports are available.</p> : <><div className="ca-access-summary"><span className="badge badge-success">Approved · Read only</span><span>Amounts: {grant.allowAmounts ? "Allowed" : "Hidden"}</span><span>Export: {grant.allowExport ? "Allowed" : "Blocked"}</span></div>{Object.values(reports).map(report => <section className="ca-report" key={report.id}><header><h2>{report.scope} report</h2>{grant.allowExport && <button className="btn-outline" onClick={() => download(report)}><Download size={16} /> Export</button>}</header><div className="table-container"><table><thead><tr><th>Reference</th><th>Date</th>{report.includesAmounts && <th>Amount</th>}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}><td>{row.label}</td><td>{row.date}</td>{report.includesAmounts && <td>{Number(row.amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>}</tr>)}</tbody></table></div></section>)}{!Object.keys(reports).length && <p>No reports released by admin yet.</p>}</>}
  </main>;
}

function AccessCard({ grant, factoryId }: { grant: Grant; factoryId: string }) {
  const [scopes, setScopes] = useState(grant.scopes || []);
  const [amounts, setAmounts] = useState(grant.allowAmounts);
  const [exports, setExports] = useState(grant.allowExport);
  const [scope, setScope] = useState("sales");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(""); try { await action(); } catch (failure) { setError(message(failure)); } finally { setBusy(false); } }
  function release() {
    const rows = scope === "sales" ? dataService.getInvoices().map(row => ({ label: row.invoiceNumber, date: row.createdAt, amount: row.total })) : scope === "expenses" ? dataService.getExpenses().map(row => ({ label: row.note || row.category, date: row.expenseDate, amount: row.amount })) : dataService.getLedgerEntries().map(row => ({ label: row.note, date: row.date, amount: row.type === "debit" ? row.amount : -row.amount }));
    return call("releaseCaReport", { factoryId, caUid: grant.id, scope, includesAmounts: grant.allowAmounts, rows });
  }
  return <article className="ca-access-card"><h3>{grant.email || grant.id}</h3><p>Status: {grant.status}</p><fieldset disabled={busy}><legend>Report permissions</legend>{reportScopes.map(value => <label key={value}><input type="checkbox" checked={scopes.includes(value)} onChange={event => setScopes(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{value}</label>)}<label><input type="checkbox" checked={amounts} onChange={event => setAmounts(event.target.checked)} /> Show amounts</label><label><input type="checkbox" checked={exports} onChange={event => setExports(event.target.checked)} /> Allow export</label></fieldset><div className="ca-actions"><button className="btn-primary" disabled={busy} onClick={() => run(() => call("manageCaAccess", { factoryId, caUid: grant.id, status: "approved", scopes, allowAmounts: amounts, allowExport: exports }))}><Check size={16} /> Approve / Save</button><button className="btn-outline" disabled={busy} onClick={() => window.confirm("Block CA login and all report access?") && run(() => call("manageCaAccess", { factoryId, caUid: grant.id, status: "denied", scopes: [] }))}><Ban size={16} /> Deny / Revoke</button></div>{grant.status === "approved" && <div className="ca-actions"><select aria-label="Report to share" value={scope} onChange={event => setScope(event.target.value)}>{grant.scopes.map(value => <option key={value}>{value}</option>)}</select><button className="btn-outline" disabled={busy || !grant.scopes.includes(scope)} onClick={() => window.confirm("Release the current report snapshot to this CA?") && run(release)}><Send size={16} /> Release report</button></div>}{error && <p role="alert">{error}</p>}</article>;
}

export function CaManagement() {
  const identity = useCaIdentity(); const [grants, setGrants] = useState<Grant[]>([]); const [error, setError] = useState("");
  const allowed = identity.role === "owner" && identity.active && !!identity.factoryId;
  useEffect(() => {
    setGrants([]); if (!allowed || !firestore) return;
    return onSnapshot(collection(firestore, "factories", identity.factoryId!, "caAccess"), snapshot => setGrants(snapshot.docs.map(row => ({ ...row.data(), id: row.id } as Grant))), failure => setError(message(failure)));
  }, [allowed, identity.factoryId]);
  return <section><h2>CA Management</h2>{!allowed ? <p>Sign in with the factory owner's verified account to manage CA access.</p> : <><p>Factory ID: <strong>{identity.factoryId}</strong> · <a href="/ca/login" target="_blank" rel="noreferrer">CA Login</a></p>{error && <p role="alert">{error}</p>}<div className="ca-management-list">{grants.map(grant => <AccessCard key={grant.id} grant={grant} factoryId={identity.factoryId!} />)}</div>{!grants.length && <p>No CA access requests.</p>}</>}</section>;
}
