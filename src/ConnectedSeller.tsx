import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp, firebaseAuth, firestore } from "./lib/firebaseClient";

export function ConnectedSeller() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(()=>firebaseAuth ? onAuthStateChanged(firebaseAuth,setUser) : undefined,[]);
  useEffect(()=>{setStatus("");if(!user||!firestore)return;return onSnapshot(doc(firestore,"sellerApplications",user.uid),snapshot=>setStatus(snapshot.exists()?String(snapshot.data().status):"Not submitted"),()=>setMessage("Could not load application status."));},[user]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!user||!firebaseApp)return;
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);setMessage("");
    try { await user.reload();if(!user.emailVerified){setMessage("Verify your email first, then retry.");return;}await user.getIdToken(true);await httpsCallable(getFunctions(firebaseApp),"submitSellerApplication")(payload);setMessage("Application submitted for review."); }
    catch{setMessage("Submission failed. Check account verification, application status and backend deployment.");}finally{setBusy(false);}
  }
  return <section className="market-page"><h1>Seller registration</h1><p>Apply to sell through Factory Market. Applications require operator review before publishing access is granted.</p>{!firebaseApp?<p>Seller registration is unavailable until Firebase is configured.</p>:!user?<p>Use Sign in / Register above to create your account.</p>:<><p>Application status: <strong>{status||"Loading…"}</strong></p><form className="market-form" onSubmit={submit}><label>Factory / business name<input name="factory" required minLength={2} maxLength={120}/></label><label>City<input name="city" required minLength={2} maxLength={80}/></label><label>Products you manufacture<textarea name="products" required minLength={2} maxLength={1000}/></label><button disabled={busy||!["Not submitted","draft","changes_requested"].includes(status)}>{busy?"Submitting…":"Submit application"}</button></form></>}{message&&<p role="status">{message}</p>}</section>;
}
