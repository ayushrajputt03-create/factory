import { useEffect, useRef, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Ban, Check, LogOut, RefreshCw, Users } from "lucide-react";
import { firebaseApp, firebaseAuth, firestore } from "../lib/firebaseClient";
import { useCaIdentity } from "../ca/CaModule";

type Scope = "crm" | "hr" | "employees";
type Grant = { id: string; email: string; status: string; scopes: Scope[] };
const modules: { scope: Scope; title: string; fields: string[] }[] = [
  { scope: "crm", title: "CRM", fields: ["name", "phone", "city", "status"] },
  { scope: "employees", title: "Employees & Attendance", fields: ["name", "role", "phone", "assignedShift", "attendanceStatus"] },
  { scope: "hr", title: "HR / Leave", fields: ["employeeId", "type", "from", "to", "reason", "status"] },
];
const labels: Record<string, string> = { name: "Name", phone: "Phone", city: "City", status: "Status", role: "Role", assignedShift: "Shift", attendanceStatus: "Attendance", employeeId: "Employee ID", type: "Leave type", from: "From", to: "To", reason: "Reason" };
async function call(name: string, data: unknown) {
  if (!firebaseApp) throw new Error("Firebase is required.");
  return httpsCallable(getFunctions(firebaseApp), name)(data);
}
const errorText = (error: unknown) => error instanceof Error ? error.message : "Request failed.";

export function HrPortal() {
  const identity = useCaIdentity();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", factoryId: "" });
  const [scope, setScope] = useState<Scope>("crm");
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => {
    ++version.current; setGrant(null); setRecords([]);
    if (!firestore || identity.role !== "hr" || !identity.user || !identity.factoryId) return;
    return onSnapshot(doc(firestore, "factories", identity.factoryId, "hrAccess", identity.user.uid), snapshot => {
      ++version.current; setRecords([]);
      const next = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Grant : null;
      setGrant(next);
      if (next?.status === "denied" && firebaseAuth) { setError("Access denied by admin."); void signOut(firebaseAuth); }
    }, failure => { ++version.current; setGrant(null); setRecords([]); setError(errorText(failure)); });
  }, [identity.user?.uid, identity.role, identity.factoryId]);
  async function load() {
    const current = ++version.current;
    setRecords([]);
    if (grant?.status !== "approved" || !grant.scopes.includes(scope)) return;
    setBusy(true); setError("");
    try {
      const response = await call("getHrWorkspace", { scope });
      if (current === version.current) setRecords((response.data as { records: Record<string, string>[] }).records);
    } catch (failure) { if (current === version.current) setError(errorText(failure)); }
    finally { if (current === version.current) setBusy(false); }
  }
  useEffect(() => {
    void load();
    return () => { ++version.current; };
  }, [grant, scope]);
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (!firebaseAuth || busy) return;
    setBusy(true); setError("");
    try {
      const result = await (register ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(firebaseAuth, form.email, form.password);
      if (register || !(await result.user.getIdTokenResult()).claims.role) await call("requestHrAccess", { factoryId: form.factoryId });
      await result.user.getIdToken(true);
    } catch (failure) { setError(errorText(failure)); await signOut(firebaseAuth); }
    finally { setBusy(false); }
  }
  const selected = modules.find(module => module.scope === scope)!;
  const filtered = records.filter(record => Object.values(record).some(value => value.toLowerCase().includes(search.toLowerCase())));
  return <main className="ca-portal"><header className="ca-header"><h1><Users size={24} /> HR Portal</h1>{identity.user && <button className="btn-outline" onClick={() => firebaseAuth && signOut(firebaseAuth)}><LogOut size={16} /> Sign out</button>}</header>
    {error && <p role="alert" className="ca-error">{error}</p>}
    {!firebaseApp ? <p>Firebase is required. Local demo records are not shared.</p> : identity.loading ? <p role="status">Verifying access...</p> : !identity.user ? <form className="ca-login" onSubmit={login}><h2>{register ? "Request HR access" : "HR Login"}</h2><label>Email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required type="password" minLength={12} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>{register && <label>Factory ID<input required value={form.factoryId} onChange={event => setForm({ ...form, factoryId: event.target.value })} /></label>}<button className="btn-primary" disabled={busy}>{busy ? "Please wait..." : register ? "Request access" : "Sign in"}</button><button type="button" className="btn-outline" onClick={() => setRegister(!register)}>{register ? "Existing account" : "New HR account"}</button></form> : identity.role !== "hr" ? <p>A separate HR account is required. <a href="/">Return to Factory OS</a></p> : grant?.status !== "approved" ? <p role="status">Awaiting admin approval. No modules available.</p> : <>
      <nav className="accounts-tabs" aria-label="HR modules">{modules.filter(module => grant.scopes.includes(module.scope)).map(module => <button key={module.scope} className={scope === module.scope ? "active" : ""} onClick={() => { setRecords([]); setScope(module.scope); }}>{module.title}</button>)}</nav>
      {grant.scopes.includes(scope) ? <section className="ca-report"><header><h2>{selected.title}</h2><span>Read only</span><button className="btn-outline" disabled={busy} onClick={() => void load()} title="Refresh records"><RefreshCw size={16} /> Refresh</button></header><label className="hr-search">Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>{busy ? <p role="status">Loading...</p> : <><div className="table-container"><table><thead><tr>{selected.fields.map(field => <th key={field}>{labels[field]}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row.id}>{selected.fields.map(field => <td key={field}>{row[field] || "-"}</td>)}</tr>)}</tbody></table></div>{!filtered.length && <p>No matching synced records.</p>}{records.length === 200 && <p>Showing first 200 records.</p>}</>}</section> : <p>Select an approved module.</p>}
    </>}
  </main>;
}

function HrAccessCard({ grant, factoryId }: { grant: Grant; factoryId: string }) {
  const [scopes, setScopes] = useState<Scope[]>(grant.scopes || []);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function decide(status: string) {
    if (busy || (status === "denied" && !window.confirm("Block this HR account's login and data access?"))) return;
    setBusy(true); setError("");
    try { await call("manageHrAccess", { factoryId, hrUid: grant.id, status, scopes: status === "approved" ? scopes : [] }); }
    catch (failure) { setError(errorText(failure)); } finally { setBusy(false); }
  }
  return <article className="ca-access-card"><h3>{grant.email || grant.id}</h3><p>Status: {grant.status}</p><fieldset disabled={busy}><legend>Module permissions</legend>{modules.map(module => <label key={module.scope}><input type="checkbox" checked={scopes.includes(module.scope)} onChange={event => setScopes(current => event.target.checked ? [...current, module.scope] : current.filter(scope => scope !== module.scope))} />{module.title}</label>)}</fieldset><div className="ca-actions"><button disabled={busy} className="btn-primary" onClick={() => void decide("approved")}><Check size={16} /> Approve / Save</button><button disabled={busy} className="btn-outline" onClick={() => void decide("denied")}><Ban size={16} /> Deny / Revoke</button></div>{error && <p role="alert">{error}</p>}</article>;
}

export function HrManagement() {
  const identity = useCaIdentity(); const [grants, setGrants] = useState<Grant[]>([]); const [error, setError] = useState("");
  const allowed = identity.role === "owner" && identity.active && !!identity.factoryId;
  useEffect(() => {
    setGrants([]); if (!allowed || !firestore) return;
    return onSnapshot(collection(firestore, "factories", identity.factoryId!, "hrAccess"), snapshot => setGrants(snapshot.docs.map(row => ({ ...row.data(), id: row.id } as Grant))), failure => setError(errorText(failure)));
  }, [allowed, identity.factoryId]);
  return <section><h2>HR Access Management</h2>{!allowed ? <p>Verified factory owner login required.</p> : <><p>Factory ID: <strong>{identity.factoryId}</strong> · <a href="/hr/login" target="_blank" rel="noreferrer">HR Login</a></p>{error && <p role="alert">{error}</p>}<div className="ca-management-list">{grants.map(grant => <HrAccessCard key={grant.id} grant={grant} factoryId={identity.factoryId!} />)}</div>{!grants.length && <p>No HR access requests.</p>}</>}</section>;
}
