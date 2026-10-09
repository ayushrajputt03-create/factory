export const CRM_SECTIONS = [
  { path: "overview", label: "Overview" },
  { path: "leads", label: "Leads" },
  { path: "accounts", label: "Accounts" },
  { path: "contacts", label: "Contacts" },
  { path: "opportunities", label: "Opportunities" },
  { path: "rfqs", label: "RFQs" },
  { path: "quotations", label: "Quotations" },
  { path: "activities", label: "Activities" },
  { path: "reports", label: "Reports" },
] as const;

export type CrmSection = (typeof CRM_SECTIONS)[number]["path"];
export type CrmScope = "own" | "team" | "plant" | "all";
export type CrmAction = "view" | "create" | "edit" | "delete" | "assign" | "approve" | "export" | "merge" | "configure";
export type CrmPermission = `crm.${CrmSection}.${CrmAction}` | "crm.configure";

export type CrmPrincipal = {
  authenticated: boolean;
  active: boolean;
  factoryId?: string;
  role?: string;
  scope?: CrmScope;
  permissions?: readonly string[];
};

const ADMIN_ROLES = new Set(["owner", "plant_manager"]);

export function resolveCrmSection(pathname: string): CrmSection {
  const segment = pathname.split("/").filter(Boolean)[1];
  return CRM_SECTIONS.some((section) => section.path === segment) ? segment as CrmSection : "overview";
}

export function canAccessCrm(principal: CrmPrincipal, permission: CrmPermission = "crm.overview.view"): boolean {
  if (!principal.authenticated || !principal.active || !principal.factoryId) return false;
  if (ADMIN_ROLES.has(principal.role ?? "")) return true;
  return principal.permissions?.includes(permission) === true;
}

export function defaultCrmScope(role?: string): CrmScope | undefined {
  return ADMIN_ROLES.has(role ?? "") ? "plant" : undefined;
}
