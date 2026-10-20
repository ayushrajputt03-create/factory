/** Real commerce stays disabled until the versioned commerce backend is delivered. */
export function marketplaceFeatures(environment: Record<string, unknown>) {
  return Object.freeze({
    browse: environment.VITE_MARKETPLACE_BROWSE === "true",
    demoCheckout: environment.MODE !== "production" && environment.VITE_MARKETPLACE_DEMO_CHECKOUT === "true",
    realCheckout: false,
    settlements: false,
  });
}
