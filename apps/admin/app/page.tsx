"use client";
import { useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";

const screens = ["Overview", "Factory approvals", "Commission + plans", "Orders", "Payouts", "Disputes", "Audit log"];

function adminAuth() {
  const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) throw new Error("Firebase configuration is missing.");
  return getAuth(getApps().length ? getApps()[0] : initializeApp(config));
}

export default function AdminPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [admin, setAdmin] = useState(false); const [error, setError] = useState(""); const [screen, setScreen] = useState("Overview");
  const login = async (event: React.FormEvent) => { event.preventDefault(); setError(""); try { const auth = adminAuth(); const credential = await signInWithEmailAndPassword(auth, email, password); const token = await credential.user.getIdTokenResult(true); if (token.claims.admin !== true) { await signOut(auth); setError("This account is not an administrator."); return; } setAdmin(true); } catch { setError("Unable to sign in with this administrator account."); } };
  if (!admin) return <main className="login"><section><span>FACTORY MARKETPLACE</span><h1>Admin console</h1><p>Access is granted only through a Firebase custom claim.</p><form onSubmit={login}><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Admin email" required /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required /><button>Sign in securely</button>{error && <small role="alert">{error}</small>}</form></section></main>;
  return <main className="shell"><aside><b>Factory Marketplace</b><small>PLATFORM ADMIN</small>{screens.map((item) => <button className={screen === item ? "active" : ""} onClick={() => setScreen(item)} key={item}>{item}</button>)}<button onClick={() => { void signOut(adminAuth()); setAdmin(false); }}>Sign out</button></aside><section className="workspace"><header><div><span>PLATFORM CONTROL</span><h1>{screen}</h1></div><strong>Admin verified</strong></header><AdminScreen screen={screen} /></section></main>;
}

function AdminScreen({ screen }: { screen: string }) {
  const copy: Record<string, string> = { Overview: "Factories, orders, GMV, commission and pending approvals. Charts load from protected Firestore queries.", "Factory approvals": "Review KYC and GST documents, approve or suspend a factory with a mandatory reason.", "Commission + plans": "Set global or per-factory commission and subscription plan controls.", Orders: "Filter all orders, inspect payment events, force-cancel and trigger an authorised refund.", Payouts: "Review monthly settlement: gross order amount less commission and refunds. Export CSV or mark paid with a reference.", Disputes: "Review messages and resolve a dispute with refund or rejection.", "Audit log": "Read-only record of every administrator action." };
  return <><p className="intro">{copy[screen]}</p><div className="metrics">{["Factories", "Orders", "GMV", "Commission", "Pending approvals", "Open disputes"].map((label, index) => <article key={label}><span>{label}</span><strong>{index < 2 ? "—" : "₹—"}</strong><small>Protected live data</small></article>)}</div><section className="panel"><h2>{screen} workspace</h2><p>Use the server-authorized admin Functions for every approval, cancellation, payout and dispute decision. This interface deliberately does not write directly to Firestore.</p></section></>;
}
