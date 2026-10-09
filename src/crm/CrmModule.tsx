import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Building2, ClipboardList, Contact, FileText, Handshake, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { CRM_SECTIONS, canAccessCrm, resolveCrmSection, type CrmPrincipal, type CrmSection } from "./foundation";

const icons: Record<CrmSection, ReactNode> = {
  overview: <BarChart3 size={16} />, leads: <Users size={16} />, accounts: <Building2 size={16} />,
  contacts: <Contact size={16} />, opportunities: <Handshake size={16} />, rfqs: <ClipboardList size={16} />,
  quotations: <FileText size={16} />, activities: <RefreshCw size={16} />, reports: <BarChart3 size={16} />,
};

type Props = { principal: CrmPrincipal; dataState?: "ready" | "loading" | "error"; onNavigate(path: string): void };

export function CrmModule(props: Props) {
  const [section, setSection] = useState(() => resolveCrmSection(window.location.pathname));
  useEffect(() => {
    const syncRoute = () => setSection(resolveCrmSection(window.location.pathname));
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  const permission = `crm.${section}.view` as const;
  if (!canAccessCrm(props.principal, permission)) return <CrmPermissionDenied />;
  return <CrmErrorBoundary>
    <section className="crm-foundation" aria-labelledby="crm-page-title">
      <header className="crm-foundation-header">
        <div><span className="eyebrow">CUSTOMER LIFECYCLE · FACTORY CONNECTED</span><h2 id="crm-page-title">{CRM_SECTIONS.find((item) => item.path === section)?.label}</h2><p>Manufacturing sales workspace linked to the existing customer, product, order and finance records.</p></div>
        <span className="finance-role"><ShieldAlert size={15} /> {props.principal.scope ?? "plant"} scope</span>
      </header>
      <nav className="crm-section-nav" aria-label="CRM sections">
        {CRM_SECTIONS.map((item) => <button key={item.path} className={section === item.path ? "active" : ""} aria-current={section === item.path ? "page" : undefined} onClick={() => { setSection(item.path); props.onNavigate(item.path); }}>{icons[item.path]}<span>{item.label}</span></button>)}
      </nav>
      {section === "overview" ? <CrmOverview state={props.dataState ?? "ready"} /> : <CrmEmptyState title={CRM_SECTIONS.find((item) => item.path === section)?.label ?? "CRM"} />}
    </section>
  </CrmErrorBoundary>;
}

function CrmOverview({ state }: { state: "ready" | "loading" | "error" }) {
  if (state === "loading") return <div className="panel crm-state" role="status"><span className="crm-spinner" />Loading CRM overview…</div>;
  if (state === "error") return <div className="panel crm-state crm-state-error" role="alert"><AlertTriangle size={22} /><h3>CRM overview unavailable</h3><p>We could not load authorized CRM aggregates. Try again after checking the connection.</p></div>;
  return <div className="panel crm-state"><BarChart3 size={24} /><h3>No CRM analytics yet</h3><p>Metrics will appear after authorized CRM records exist. Existing customer, order and finance data is not copied into placeholder analytics.</p></div>;
}

function CrmEmptyState({ title }: { title: string }) {
  return <div className="panel crm-state"><ClipboardList size={24} /><h3>No {title.toLowerCase()} yet</h3><p>This foundation route is ready. Records will be added in the corresponding vertical-slice phase.</p></div>;
}

export function CrmPermissionDenied() {
  return <div className="panel crm-state crm-state-error" role="alert"><ShieldAlert size={26} /><h2>CRM access required</h2><p>Your active Factory OS membership does not grant access to this CRM route. Ask an administrator for the minimum required permission.</p></div>;
}

export function CrmUnavailable() {
  return <div className="panel crm-state" role="status"><ShieldAlert size={26} /><h2>CRM is not enabled</h2><p>This Factory OS environment has not enabled the CRM module.</p></div>;
}

class CrmErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("CRM module error", error, info.componentStack); }
  render() { return this.state.failed ? <div className="panel crm-state crm-state-error" role="alert"><AlertTriangle size={24} /><h2>CRM could not be displayed</h2><p>Reload the page. If the problem continues, contact your Factory OS administrator.</p></div> : this.props.children; }
}
