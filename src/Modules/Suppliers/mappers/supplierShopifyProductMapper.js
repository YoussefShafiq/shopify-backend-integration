import axios from "axios";
import { SUPPLIER_IMAGE_FETCH_EXTRA_HOSTS } from "../../../../configs/app.config.js";

const IMAGE_FETCH_MAX_BYTES = 20 * 1024 * 1024;

function supplierImageFetchAllowedHosts() {
    return SUPPLIER_IMAGE_FETCH_EXTRA_HOSTS.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

/** SSRF guard: only fetch supplier URLs we expect (localhost + optional env hosts). */
export function isSupplierImageUrlFetchAllowed(url) {
    try {
        const u = new URL(typeof url === "string" ? url.trim() : "");
        if (u.protocol !== "http:" && u.protocol !== "https:") return false;
        const h = u.hostname.toLowerCase();
        if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
        return supplierImageFetchAllowedHosts().includes(h);
    } catch {
        return false;
    }
}

async function fetchSupplierImageAsBase64(url) {
    const { data, status } = await axios.get(url.trim(), {
        responseType: "arraybuffer",
        timeout: 25_000,
        maxContentLength: IMAGE_FETCH_MAX_BYTES,
        maxBodyLength: IMAGE_FETCH_MAX_BYTES,
        validateStatus: (s) => s === 200,
    });
    if (status !== 200 || !data?.byteLength) return "";
    return Buffer.from(data).toString("base64");
}

/** REST Admin fields we forward from supplier `product` (extras are dropped). */
const SHOPIFY_PRODUCT_ROOT_KEYS = new Set([
    "title",
    "body_html",
    "vendor",
    "product_type",
    "status",
    "handle",
    "tags",
    "template_suffix",
    "published_scope",
    "published_at",
    "options",
]);

export function mapSupplierVariantForShopify(variant, index, total, supplier) {
    const out = {};
    if (variant.option1 != null && variant.option1 !== "") out.option1 = variant.option1;
    else if (variant.option2 == null && variant.option3 == null && total === 1) {
        out.option1 = "Default Title";
    }
    if (variant.option2 != null && variant.option2 !== "") out.option2 = variant.option2;
    if (variant.option3 != null && variant.option3 !== "") out.option3 = variant.option3;
    if (variant.price != null && variant.price !== "") out.price = String(variant.price);
    if (variant.sku != null && variant.sku !== "") out.sku = variant.sku;
    if (variant.barcode != null && variant.barcode !== "") out.barcode = variant.barcode;
    if (variant.id != null && variant.id !== "") out.id = variant.id;
    if (supplier?.tracksInventory === false) {
        out.inventory_management = null;
        console.log(`
            
            
            
            
            
            
            
            
            
            
            
            ************************************ supplier does not track inventory ************************************
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            `);
    } else {
        (variant.inventory_management != null)
            ? (out.inventory_management = variant.inventory_management)
            : (out.inventory_management = "shopify");
    }
    if (variant.inventory_policy != null) out.inventory_policy = variant.inventory_policy;
    if (variant.fulfillment_service != null) out.fulfillment_service = variant.fulfillment_service;
    if (variant.requires_shipping != null) out.requires_shipping = variant.requires_shipping;
    if (variant.taxable != null) out.taxable = variant.taxable;
    if (variant.weight != null) out.weight = variant.weight;
    if (variant.weight_unit != null) out.weight_unit = variant.weight_unit;
    return out;
}

function mapSupplierMetafieldForShopify(mf) {
    const out = {};
    if (mf.namespace != null) out.namespace = mf.namespace;
    if (mf.key != null) out.key = mf.key;
    if (mf.value != null) out.value = mf.value;
    if (mf.type != null) out.type = mf.type;
    return out;
}

function attachmentSourceToString(raw) {
    if (typeof raw === "string") return raw;
    if (Buffer.isBuffer(raw)) return raw.toString("utf8");
    return "";
}

/**
 * Raw base64 for Shopify `attachment` (no data-URI prefix, whitespace stripped, padding fixed).
 */
export function normalizeRawBase64ForShopify(raw) {
    let s = attachmentSourceToString(raw).trim();
    const dataUri = /^data:[^;]+;base64,(.+)$/is.exec(s);
    if (dataUri) s = dataUri[1];
    s = s.replace(/\s/g, "");
    if (!s) return "";
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    return s;
}

export function isShopifyReachableImageUrl(url) {
    if (typeof url !== "string" || !url.trim()) return false;
    try {
        const u = new URL(url.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") return false;
        const h = u.hostname.toLowerCase();
        if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".local")) return false;
        return true;
    } catch {
        return false;
    }
}

function imageFilenameFromMimetype(mimetype) {
    if (typeof mimetype !== "string" || !mimetype) return "image.jpg";
    const m = {
        "image/jpeg": "image.jpg",
        "image/jpg": "image.jpg",
        "image/png": "image.png",
        "image/gif": "image.gif",
        "image/webp": "image.webp",
    };
    return m[mimetype.toLowerCase()] || "image.jpg";
}

/**
 * Maps one supplier image to Shopify REST image fields.
 * @param {object} img
 * @param {number} index
 * @param {(raw: unknown) => string} normalizeAttachment - supplier-specific base64 normalization
 */
export async function mapSupplierImageForShopify(img, index, normalizeAttachment) {
    const url = img.src ?? img.url;
    const attachmentSource = img.attachment ?? img.base64 ?? img.image_base64;
    const filename =
        typeof img.filename === "string" && img.filename.trim()
            ? img.filename.trim()
            : imageFilenameFromMimetype(img.mimetype);

    const out = {};
    if (img.position != null) out.position = img.position;
    else out.position = index + 1;
    if (img.alt != null && img.alt !== "") out.alt = img.alt;

    const inlineAttachment = normalizeAttachment(attachmentSource);
    if (inlineAttachment) {
        out.attachment = inlineAttachment;
        out.filename = filename;
        return out;
    }

    if (url && isShopifyReachableImageUrl(url)) {
        out.src = url.trim();
        return out;
    }

    if (typeof url === "string" && url.trim() && isSupplierImageUrlFetchAllowed(url)) {
        let fetched = "";
        try {
            fetched = await fetchSupplierImageAsBase64(url);
        } catch {
            fetched = "";
        }
        if (fetched) {
            out.attachment = normalizeAttachment(fetched);
            out.filename = filename;
            return out;
        }
    }

    return null;
}

/**
 * @param {object} product
 * @param {(raw: unknown) => string} normalizeAttachment
 */
export async function mapSupplierProductForShopify(product, normalizeAttachment, supplier) {
    if (!product || typeof product !== "object") return product;
    const shopifyProduct = {};
    for (const key of SHOPIFY_PRODUCT_ROOT_KEYS) {
        if (product[key] !== undefined) shopifyProduct[key] = product[key];
    }
    if (Array.isArray(product.variants)) {
        const n = product.variants.length;
        shopifyProduct.variants = product.variants.map((v, i) =>
            mapSupplierVariantForShopify(v, i, n, supplier),
        );
    }
    if (Array.isArray(product.metafields)) {
        shopifyProduct.metafields = product.metafields.map(mapSupplierMetafieldForShopify);
    }
    if (Array.isArray(product.images)) {
        const mapped = await Promise.all(
            product.images.map((img, i) => mapSupplierImageForShopify(img, i, normalizeAttachment)),
        );
        shopifyProduct.images = mapped.filter(Boolean);
    }
    return shopifyProduct;
}
