/**
 * Admin REST must call `https://{store}.myshopify.com` (custom storefront domains will not resolve for Admin API).
 */
export function normalizeShopifyStoreOrigin(raw) {
    let s = (raw ?? "").trim().replace(/\/+$/, "");
    if (!s) return "";
    s = s.split("/admin")[0].trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(s)) {
        if (!s.includes(".")) s = `https://${s}.myshopify.com`;
        else s = `https://${s}`;
    }
    try {
        return new URL(s).origin.replace(/\/+$/, "");
    } catch {
        return s.replace(/\/+$/, "");
    }
}
