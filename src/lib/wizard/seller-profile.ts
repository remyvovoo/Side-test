const STORAGE_KEY = "cs_seller_profile";

/**
 * The seller's boilerplate text (shipping, packaging promises, etc.),
 * reused in every generated description. Stored in the browser for now —
 * there is no user-account system yet — but kept behind this one function
 * so swapping in a real per-account profile later is a one-file change.
 */
export function loadSellerBoilerplate(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveSellerBoilerplate(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // localStorage unavailable (private browsing, etc.) — fail silently, non-critical.
  }
}
