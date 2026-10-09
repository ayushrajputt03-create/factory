import { useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "../lib/firebaseClient";
import { defaultCrmScope, type CrmPrincipal } from "./foundation";

export type CrmSession = { loading: boolean; principal: CrmPrincipal };

export function useCrmPrincipal(demoRole: string, demoFactoryId: string): CrmSession {
  const demoPrincipal: CrmPrincipal = {
    authenticated: true,
    active: true,
    factoryId: demoFactoryId,
    role: demoRole === "ca" ? "accountant" : demoRole,
    scope: defaultCrmScope(demoRole),
  };
  const [session, setSession] = useState<CrmSession>(() => isFirebaseConfigured
    ? { loading: true, principal: { authenticated: false, active: false } }
    : { loading: false, principal: demoPrincipal });

  useEffect(() => {
    if (!firebaseAuth) {
      setSession({ loading: false, principal: demoPrincipal });
      return;
    }
    return onIdTokenChanged(firebaseAuth, async (user) => {
      if (!user) {
        setSession({ loading: false, principal: { authenticated: false, active: false } });
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        const permissions = Array.isArray(token.claims.crm_permissions) ? token.claims.crm_permissions.filter((item): item is string => typeof item === "string") : [];
        const role = typeof token.claims.role === "string" ? token.claims.role : undefined;
        const claimedScope = token.claims.crm_scope;
        setSession({ loading: false, principal: {
          authenticated: true,
          active: token.claims.active === true,
          factoryId: typeof token.claims.factory_id === "string" ? token.claims.factory_id : undefined,
          role,
          scope: claimedScope === "own" || claimedScope === "team" || claimedScope === "plant" || claimedScope === "all" ? claimedScope : defaultCrmScope(role),
          permissions,
        }});
      } catch {
        setSession({ loading: false, principal: { authenticated: true, active: false } });
      }
    });
  // Demo identity only applies when Firebase is not configured.
  }, [demoRole, demoFactoryId]);

  return session;
}
