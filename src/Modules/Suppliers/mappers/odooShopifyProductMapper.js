import {
    mapSupplierProductForShopify,
    normalizeRawBase64ForShopify,
} from "./supplierShopifyProductMapper.js";

function bufferLooksLikeImage(buf) {
    if (!buf || buf.length < 12) return false;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.length >= 12) {
        if (buf.subarray(8, 12).equals(Buffer.from("WEBP"))) return true;
    }
    return false;
}

/**
 * Odoo sometimes sends base64(base64(image)) — peel layers until binary looks like an image.
 */
export function expandOdooImageAttachmentBase64(raw) {
    let s = normalizeRawBase64ForShopify(raw);
    if (!s) return "";
    for (let depth = 0; depth < 4; depth++) {
        let buf;
        try {
            buf = Buffer.from(s, "base64");
        } catch {
            return "";
        }
        if (bufferLooksLikeImage(buf)) return s;
        const inner = buf.toString("utf8").replace(/\s/g, "");
        if (inner.length < 40 || !/^[A-Za-z0-9+/=_-]+$/.test(inner.slice(0, Math.min(500, inner.length)))) {
            return s;
        }
        const next = normalizeRawBase64ForShopify(inner);
        if (!next || next === s) return s;
        s = next;
    }
    return s;
}

/** Odoo supplier webhook `product` → Shopify REST `product` payload. */
export async function mapOdooProductForShopify(product) {
    return mapSupplierProductForShopify(product, expandOdooImageAttachmentBase64);
}
