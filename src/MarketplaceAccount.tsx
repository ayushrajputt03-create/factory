import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "./lib/firebaseClient";

export function MarketplaceAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => firebaseAuth ? onAuthStateChanged(firebaseAuth, setUser) : undefined, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const email = String(data.get("email")), password = String(data.get("password"));
      if (register) { const result = await createUserWithEmailAndPassword(firebaseAuth, email, password); await sendEmailVerification(result.user); setMessage("Account created. Check your email to verify your address."); }
      else { await signInWithEmailAndPassword(firebaseAuth, email, password); setMessage("Signed in successfully."); }
    } catch { setMessage("Unable to complete sign in. Check your details, connection and authentication configuration."); }
    finally { setBusy(false); }
  }
  return <section className="market-account"><button onClick={() => setOpen(!open)} aria-expanded={open}>{user ? "Your account" : "Sign in / Register"}</button>{open && <div><h3>{user ? "Your marketplace account" : register ? "Create buyer account" : "Buyer sign in"}</h3>{!firebaseAuth ? <p>Account service is unavailable. Firebase configuration is required to enable registration.</p> : user ? <><p>{user.email}</p><p>{user.emailVerified ? "Email verified" : "Email verification pending"}</p><button disabled={busy} onClick={async()=>{setBusy(true);try{await signOut(firebaseAuth!);setMessage("Signed out.");}catch{setMessage("Unable to sign out. Try again.");}finally{setBusy(false);}}}>Sign out</button></> : <form className="market-form" onSubmit={submit}><label>Email<input name="email" type="email" required autoComplete="email" maxLength={180}/></label><label>Password<input name="password" type="password" required minLength={12} autoComplete={register ? "new-password" : "current-password"}/></label><button disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button><button type="button" disabled={busy} onClick={()=>setRegister(!register)}>{register ? "Already registered? Sign in" : "New buyer? Register"}</button></form>}{message && <p role="status">{message}</p>}</div>}</section>;
}
