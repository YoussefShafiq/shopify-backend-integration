import axios from "axios";
import { SHOPIFY_API_URL } from "../../../configs/app.config.js";
import { badRequestException, notFoundException, unhandledException } from "../../utils/response/failResponse.js";
import {
    getShopifyAccessToken,
    invalidateShopifyAccessToken,
    usesShopifyClientCredentials,
} from "./shopifyToken.service.js";
import { normalizeShopifyStoreOrigin } from "./shopifyStore.util.js";

export { normalizeShopifyStoreOrigin };

const API_VERSION = "2026-04";

function shopifyAdminErrorDetail(data) {
    if (data == null) return "";
    if (typeof data === "string") return data.slice(0, 500);
    if (typeof data.errors === "string") return data.errors.slice(0, 500);
    if (Array.isArray(data.errors)) return JSON.stringify(data.errors).slice(0, 500);
    try {
        return JSON.stringify(data).slice(0, 500);
    } catch {
        return "";
    }
}

function shopify401HelpMessage(detail) {
    const authHint = usesShopifyClientCredentials()
        ? "Verify SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, and that the app is installed on this store with the required API scopes."
        : "Verify SHOPIFY_ACCESS_TOKEN is a valid offline Admin API token (not the webhook signing secret).";
    return (
        `Shopify Admin API returned 401 Unauthorized${detail ? `: ${detail}` : ""}. ` +
        `Check SHOPIFY_API_URL matches the store where the app is installed. ${authHint}`
    );
}

function attachShopifyAxiosErrorInterceptor(client) {
    client.interceptors.response.use(
        (res) => res,
        async (err) => {
            if (!axios.isAxiosError(err)) return Promise.reject(err);
            if (err.response) {
                const st = err.response.status;
                if (st === 401 && usesShopifyClientCredentials() && !err.config?._shopifyTokenRetried) {
                    invalidateShopifyAccessToken();
                    const token = await getShopifyAccessToken(true);
                    const retryConfig = {
                        ...err.config,
                        _shopifyTokenRetried: true,
                        headers: {
                            ...err.config.headers,
                            "X-Shopify-Access-Token": token,
                        },
                    };
                    return client.request(retryConfig);
                }
                if (st === 401) {
                    const detail = shopifyAdminErrorDetail(err.response.data);
                    throw unhandledException(shopify401HelpMessage(detail));
                }
                return Promise.reject(err);
            }
            const code = err.code || err.cause?.code;
            let host = err.hostname || "";
            if (!host && err.config?.baseURL) {
                try {
                    host = new URL(err.config.baseURL).hostname;
                } catch {
                    host = "";
                }
            }
            if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
                throw unhandledException(
                    `Shopify host could not be resolved (${host || "unknown host"}). ` +
                    `Set SHOPIFY_API_URL in .env to your store admin origin, e.g. https://your-store.myshopify.com ` +
                    `(no /admin path). If the store was renamed, transferred, or deleted, copy the current URL from Shopify Admin.`,
                );
            }
            if (code === "ECONNREFUSED" || code === "ETIMEDOUT") {
                throw unhandledException(
                    `Cannot reach Shopify (${code}). Check SHOPIFY_API_URL, firewall, VPN, and that the store is online.`,
                );
            }
            return Promise.reject(err);
        },
    );
}

export function getShopifyAdminBaseUrl() {
    const origin = normalizeShopifyStoreOrigin(SHOPIFY_API_URL);
    if (!origin) throw unhandledException("SHOPIFY_API_URL is not configured");
    return `${origin}/admin/api/${API_VERSION}`;
}

export function getShopifyAdminClient() {
    const client = axios.create({
        baseURL: getShopifyAdminBaseUrl(),
        headers: {
            "Content-Type": "application/json",
        },
        timeout: 30_000,
    });

    client.interceptors.request.use(async (config) => {
        const token = await getShopifyAccessToken();
        config.headers = config.headers ?? {};
        config.headers["X-Shopify-Access-Token"] = token;
        return config;
    });

    attachShopifyAxiosErrorInterceptor(client);
    return client;
}

/**
 * Creates a Shopify product.
 * @param {object} product Shopify product object (REST shape)
 */
const largeJsonRequest = {
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120_000,
};

/**
 * @param {string|number} productId
 * @param {{ src?: string, attachment?: string, filename?: string, position?: number, alt?: string }} image
 */
export async function createShopifyProductImage(productId, image) {
    const client = getShopifyAdminClient();
    const body = { image: {} };
    const im = body.image;
    if (image.src) im.src = image.src;
    if (image.attachment) im.attachment = image.attachment;
    if (image.filename) im.filename = image.filename;
    if (image.position != null) im.position = image.position;
    if (image.alt) im.alt = image.alt;
    if (!im.src && !im.attachment) {
        throw unhandledException("createShopifyProductImage: need src or attachment");
    }
    try {
        const { data } = await client.post(`/products/${productId}/images.json`, body, largeJsonRequest);
        return data?.image;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 422) {
            const detail =
                typeof err.response.data === "object"
                    ? JSON.stringify(err.response.data)
                    : String(err.response.data ?? "");
            badRequestException(`Shopify rejected product image (422): ${detail}`);
        }
        throw err;
    }
}

export async function getShopifyProduct(productId) {
    const client = getShopifyAdminClient();
    const { data } = await client.get(`/products/${productId}.json`);
    return data?.product;
}

/** Must match metafields you write on create/update from the supplier. */
const ODOO_PRODUCT_METAFIELD = { namespace: "odoo", key: "odoo_product_id" };

/** On each Shopify **product variant** (InventoryItem has no `metafield` in Admin GraphQL). Used to resolve Odoo `inventoryItemId` → Shopify `inventory_item_id`. */
const ODOO_INVENTORY_ITEM_METAFIELD = { namespace: "odoo", key: "odoo_inventory_item_id" };

const GQL_PRODUCTS_BY_ODOO_METAFIELD_PAGE = `
query ProductsByOdooMetafieldPage($query: String!, $after: String) {
  products(first: 50, query: $query, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      legacyResourceId
      title
      metafield(namespace: "odoo", key: "odoo_product_id") {
        value
      }
    }
  }
}
`;

const GQL_PRODUCT_VARIANTS_BY_ODOO_INVENTORY_METAFIELD_PAGE = `
query ProductVariantsByOdooInventoryMetafieldPage($query: String!, $after: String) {
  productVariants(first: 50, query: $query, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        inventoryItem {
          legacyResourceId
        }
        metafield(namespace: "odoo", key: "odoo_inventory_item_id") {
          value
        }
      }
    }
  }
}
`;

const MAX_ODOO_PRODUCT_SEARCH_PAGES = 10;
const MAX_PRODUCT_IDS_DELETE_BY_ODOO = 50;
const MAX_ODOO_INVENTORY_ITEM_SEARCH_PAGES = 10;
const MAX_INVENTORY_ITEM_IDS_BY_ODOO = 50;

const METAFIELDS_SET_MUTATION = `
mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
    }
    userErrors {
      field
      message
    }
  }
}
`;

/**
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
export async function shopifyGraphql(query, variables) {
    const client = getShopifyAdminClient();
    const { data } = await client.post("/graphql.json", { query, variables }, { timeout: 30_000 });
    if (data?.errors?.length) {
        throw unhandledException(`Shopify GraphQL: ${JSON.stringify(data.errors)}`);
    }
    return data?.data;
}

/**
 * All Shopify product ids whose metafield `odoo.odoo_product_id` equals this value (paginated).
 * Never trusts search `nodes` alone: Shopify search can return unrelated rows; we only keep ids
 * where the metafield value strictly matches `odooProductId`.
 */
export async function findAllShopifyProductIdsByOdooProductId(odooProductId) {
    const raw = String(odooProductId ?? "").trim();
    if (!raw) return [];
    const safe = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const searchQuery = `metafields.${ODOO_PRODUCT_METAFIELD.namespace}.${ODOO_PRODUCT_METAFIELD.key}:"${safe}"`;
    const ids = [];
    let cursor = null;
    let hasNext = true;
    let page = 0;
    while (hasNext && page < MAX_ODOO_PRODUCT_SEARCH_PAGES) {
        page += 1;
        const variables =
            cursor == null ? { query: searchQuery } : { query: searchQuery, after: cursor };
        const gqlData = await shopifyGraphql(GQL_PRODUCTS_BY_ODOO_METAFIELD_PAGE, variables);
        const conn = gqlData?.products;
        const nodes = conn?.nodes ?? [];
        for (const n of nodes) {
            const mfVal = String(n?.metafield?.value ?? "").trim();
            if (mfVal !== raw) continue;
            const rid = n?.legacyResourceId;
            if (rid != null) ids.push(Number(rid));
        }
        if (ids.length >= MAX_PRODUCT_IDS_DELETE_BY_ODOO) {
            throw unhandledException(
                `More than ${MAX_PRODUCT_IDS_DELETE_BY_ODOO} Shopify products match odoo_product_id "${raw}". ` +
                `Refuse bulk delete for safety; remove duplicates in Shopify or raise MAX_PRODUCT_IDS_DELETE_BY_ODOO.`,
            );
        }
        hasNext = Boolean(conn?.pageInfo?.hasNextPage);
        cursor = conn?.pageInfo?.endCursor ?? null;
    }
    if (page >= MAX_ODOO_PRODUCT_SEARCH_PAGES && hasNext) {
        console.warn(
            `[shopify] odoo_product_id search for "${raw}" hit max pages (${MAX_ODOO_PRODUCT_SEARCH_PAGES}); results may be incomplete`,
        );
    }
    return [...new Set(ids)];
}

/**
 * Supplier webhooks send `productId` as either Shopify's numeric id or Odoo's `odoo_product_id` metafield value.
 * Odoo id is resolved first so `GET /products/20.json` never deletes the wrong row when Shopify legacy id 20 exists.
 */
export async function resolveSupplierProductIdToShopifyProductId(supplierProductId) {
    const idStr = String(supplierProductId ?? "").trim();
    if (!idStr) notFoundException("productId is required");

    const fromOdoo = await findAllShopifyProductIdsByOdooProductId(idStr);
    if (fromOdoo.length > 0) {
        if (fromOdoo.length > 1) {
            console.warn(
                "[shopify] multiple Shopify products share odoo_product_id=%s — ids: %s (using first for single-target ops)",
                idStr,
                fromOdoo.join(", "),
            );
        }
        return fromOdoo[0];
    }

    const client = getShopifyAdminClient();
    const probe = await client.get(`/products/${encodeURIComponent(idStr)}.json`, {
        validateStatus: (s) => s === 200 || s === 404,
    });
    if (probe.status === 200 && probe.data?.product?.id != null) {
        return probe.data.product.id;
    }

    notFoundException(
        `No Shopify product for productId "${idStr}". ` +
        `Use the Shopify product id from create response, or ensure metafield odoo.odoo_product_id matches.`,
    );
}

/**
 * Shopify `inventory_item_id` values for variants whose metafield `odoo.odoo_inventory_item_id` equals this value (paginated).
 * Uses `productVariants` search — `InventoryItem` does not expose `metafield` in Admin GraphQL.
 */
export async function findShopifyInventoryItemIdsByOdooInventoryItemId(odooInventoryItemId) {
    const raw = String(odooInventoryItemId ?? "").trim();
    if (!raw) return [];
    const safe = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const searchQuery = `metafields.${ODOO_INVENTORY_ITEM_METAFIELD.namespace}.${ODOO_INVENTORY_ITEM_METAFIELD.key}:"${safe}"`;
    const ids = [];
    let cursor = null;
    let hasNext = true;
    let page = 0;
    while (hasNext && page < MAX_ODOO_INVENTORY_ITEM_SEARCH_PAGES) {
        page += 1;
        const variables =
            cursor == null ? { query: searchQuery } : { query: searchQuery, after: cursor };
        const gqlData = await shopifyGraphql(GQL_PRODUCT_VARIANTS_BY_ODOO_INVENTORY_METAFIELD_PAGE, variables);
        const conn = gqlData?.productVariants;
        const fromEdges = (conn?.edges ?? []).map((e) => e?.node).filter(Boolean);
        const fromNodes = Array.isArray(conn?.nodes) ? conn.nodes : [];
        const variantNodes = fromEdges.length > 0 ? fromEdges : fromNodes;
        for (const n of variantNodes) {
            const mfVal = String(n?.metafield?.value ?? "").trim();
            if (mfVal !== raw) continue;
            const rid = n?.inventoryItem?.legacyResourceId;
            if (rid != null) ids.push(Number(rid));
        }
        if (ids.length >= MAX_INVENTORY_ITEM_IDS_BY_ODOO) {
            throw unhandledException(
                `More than ${MAX_INVENTORY_ITEM_IDS_BY_ODOO} Shopify variants match odoo_inventory_item_id "${raw}". ` +
                    `Refuse bulk match for safety; remove duplicates in Shopify or raise MAX_INVENTORY_ITEM_IDS_BY_ODOO.`,
            );
        }
        hasNext = Boolean(conn?.pageInfo?.hasNextPage);
        cursor = conn?.pageInfo?.endCursor ?? null;
    }
    if (page >= MAX_ODOO_INVENTORY_ITEM_SEARCH_PAGES && hasNext) {
        console.warn(
            `[shopify] odoo_inventory_item_id search for "${raw}" hit max pages (${MAX_ODOO_INVENTORY_ITEM_SEARCH_PAGES}); results may be incomplete`,
        );
    }
    return [...new Set(ids)];
}

/**
 * Resolves `inventoryItemId` from a supplier webhook to Shopify's numeric `inventory_item_id` for REST.
 *
 * Accepts, in order: variant metafield `odoo.odoo_inventory_item_id`; Shopify `inventory_item` legacy id;
 * Shopify **product** legacy id (single-variant → that variant's inventory item); Odoo **product** id matching
 * product metafield `odoo.odoo_product_id` (single-variant only).
 */
export async function resolveSupplierInventoryItemIdToShopifyInventoryItemId(supplierInventoryItemId) {
    const idStr = String(supplierInventoryItemId ?? "").trim();
    if (!idStr) notFoundException("inventoryItemId is required");

    const fromOdoo = await findShopifyInventoryItemIdsByOdooInventoryItemId(idStr);
    if (fromOdoo.length > 0) {
        if (fromOdoo.length > 1) {
            console.warn(
                "[shopify] multiple Shopify variants share odoo_inventory_item_id=%s — inventory_item_ids: %s (using first)",
                idStr,
                fromOdoo.join(", "),
            );
        }
        return fromOdoo[0];
    }

    const client = getShopifyAdminClient();
    const probe = await client.get(`/inventory_items/${encodeURIComponent(idStr)}.json`, {
        validateStatus: (s) => s === 200 || s === 404,
    });
    if (probe.status === 200 && probe.data?.inventory_item?.id != null) {
        return Number(probe.data.inventory_item.id);
    }

    // Callers sometimes send Shopify **product** legacy id instead of variant `inventory_item_id` (they differ).
    const productProbe = await client.get(`/products/${encodeURIComponent(idStr)}.json`, {
        validateStatus: (s) => s === 200 || s === 404,
    });
    if (productProbe.status === 200) {
        const variants = productProbe.data?.product?.variants ?? [];
        if (variants.length === 1 && variants[0]?.inventory_item_id != null) {
            return Number(variants[0].inventory_item_id);
        }
        if (variants.length > 1) {
            notFoundException(
                `inventoryItemId "${idStr}" is a Shopify product id with ${variants.length} variants. ` +
                    `Pass the correct variant's inventory_item_id from GET /products/${idStr}.json → variants[].inventory_item_id ` +
                    `(yours are: ${variants
                        .map((v) => `${v.id}:${v.inventory_item_id}`)
                        .join(", ")}), or your Odoo external id with variant metafield odoo.odoo_inventory_item_id synced.`,
            );
        }
    }

    // Odoo **product** id (same value as metafield `odoo.odoo_product_id` on the Shopify product).
    const fromOdooProductIds = await findAllShopifyProductIdsByOdooProductId(idStr);
    if (fromOdooProductIds.length > 0) {
        if (fromOdooProductIds.length > 1) {
            console.warn(
                "[shopify] multiple Shopify products share odoo_product_id=%s — using first for inventory resolution: %s",
                idStr,
                fromOdooProductIds.join(", "),
            );
        }
        const spid = fromOdooProductIds[0];
        const byOdooProduct = await client.get(`/products/${encodeURIComponent(String(spid))}.json`, {
            validateStatus: (s) => s === 200 || s === 404,
        });
        if (byOdooProduct.status === 200) {
            const vs = byOdooProduct.data?.product?.variants ?? [];
            if (vs.length === 1 && vs[0]?.inventory_item_id != null) {
                return Number(vs[0].inventory_item_id);
            }
            if (vs.length > 1) {
                notFoundException(
                    `inventoryItemId "${idStr}" matches Odoo product id (metafield odoo.odoo_product_id) but Shopify product ${spid} has ${vs.length} variants. ` +
                        `Pass variants[].inventory_item_id from GET /products/${spid}.json, or set odoo.odoo_inventory_item_id per variant and send that value.`,
                );
            }
        }
    }

    notFoundException(
        `No Shopify inventory item for inventoryItemId "${idStr}". ` +
            `Pass Shopify variants[].inventory_item_id, or Odoo id stored in variant metafield odoo.odoo_inventory_item_id, ` +
            `or for single-variant products Odoo product id matching metafield odoo.odoo_product_id.`,
    );
}

/**
 * Writes Odoo's external inventory id onto a Shopify **product variant** (for `productVariants` search + inventory resolution).
 */
export async function setProductVariantOdooInventoryItemIdMetafield(shopifyVariantLegacyId, odooInventoryItemIdValue) {
    const rid = Number(shopifyVariantLegacyId);
    if (!Number.isFinite(rid)) return;
    const value = String(odooInventoryItemIdValue ?? "").trim();
    if (!value) return;

    const variables = {
        metafields: [
            {
                ownerId: `gid://shopify/ProductVariant/${rid}`,
                namespace: ODOO_INVENTORY_ITEM_METAFIELD.namespace,
                key: ODOO_INVENTORY_ITEM_METAFIELD.key,
                type: "single_line_text_field",
                value,
            },
        ],
    };
    const gqlData = await shopifyGraphql(METAFIELDS_SET_MUTATION, variables);
    const errs = gqlData?.metafieldsSet?.userErrors ?? [];
    if (errs.length) {
        console.warn("[shopify] metafieldsSet odoo_inventory_item_id on ProductVariant", errs);
    }
}

/**
 * After product create/update, map supplier variants to Shopify variants (SKU first, else index) and store Odoo external id on each **variant** metafield.
 * Uses `variant.odoo_inventory_item_id`, else `variant.inventory_item_id` as the Odoo-side external id (do not use Shopify variant `id` here).
 */
export async function syncOdooInventoryItemMetafieldsFromSupplierVariants(supplierVariants, shopifyProduct) {
    if (!Array.isArray(supplierVariants) || !shopifyProduct?.variants?.length) return;

    const shopifyVariants = shopifyProduct.variants;
    for (let i = 0; i < supplierVariants.length; i++) {
        const sv = supplierVariants[i];
        const odooKey = String(sv?.odoo_inventory_item_id ?? sv?.inventory_item_id ?? "").trim();
        if (!odooKey) continue;

        let mv = null;
        if (sv?.sku != null && String(sv.sku).trim() !== "") {
            mv = shopifyVariants.find((v) => String(v?.sku ?? "") === String(sv.sku).trim());
        }
        if (!mv) mv = shopifyVariants[i];
        const variantId = mv?.id;
        if (variantId == null) continue;

        await setProductVariantOdooInventoryItemIdMetafield(variantId, odooKey);
    }
}

export async function deleteShopifyProductImage(productId, imageId) {
    const client = getShopifyAdminClient();
    await client.delete(`/products/${productId}/images/${imageId}.json`, {
        validateStatus: (s) => s === 200 || s === 404,
    });
}

export async function createShopifyProduct(product) {
    const client = getShopifyAdminClient();
    const { data } = await client.post(`/products.json`, { product }, largeJsonRequest);
    return data?.product;
}

/**
 * Updates a Shopify product by id.
 * @param {string|number} productId Shopify product id
 * @param {object} product Partial product object (REST shape)
 */
export async function updateShopifyProduct(productId, product) {
    const client = getShopifyAdminClient();
    const { data } = await client.put(
        `/products/${productId}.json`,
        { product: { ...product, id: productId } },
        largeJsonRequest,
    );
    return data?.product;
}

/**
 * Permanently deletes a Shopify product by id.
 * If the product is already gone (404), returns success so supplier delete webhooks stay idempotent.
 *
 * @param {string|number} productId Shopify product id
 */
export async function deleteShopifyProduct(productId) {
    const client = getShopifyAdminClient();
    const { status, data } = await client.delete(`/products/${productId}.json`, {
        validateStatus: (s) => s === 200 || s === 204 || s === 404,
    });
    if (status === 404) {
        return { deleted: true, productId: String(productId), notFound: true };
    }
    return { deleted: true, productId: String(productId), product: data?.product };
}

/**
 * Shopify Admin REST: `GET /locations.json` — all locations the app can access (id + name, etc.).
 * @see https://shopify.dev/docs/api/admin-rest/latest/resources/location
 */
export async function listShopifyLocations() {
    const client = getShopifyAdminClient();
    const { data } = await client.get("/locations.json");
    return data?.locations ?? [];
}

/**
 * Sets inventory level for a specific inventory item at a specific location.
 * @param {object} params
 * @param {string|number} params.locationId Shopify location id
 * @param {string|number} params.inventoryItemId Shopify inventory_item_id
 * @param {number} params.available Available quantity at this location
 */
export async function setShopifyInventoryLevel({ locationId, inventoryItemId, available }) {
    const client = getShopifyAdminClient();
    const locNum = Number(locationId);
    const invNum = Number(inventoryItemId);
    const payload = {
        location_id: Number.isFinite(locNum) ? locNum : locationId,
        inventory_item_id: Number.isFinite(invNum) ? invNum : inventoryItemId,
        available,
    };
    console.log("[setShopifyInventoryLevel] Request payload", payload);
    try {
        const { data } = await client.post(`/inventory_levels/set.json`, payload);
        return data;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            const detail = shopifyAdminErrorDetail(err.response.data);
            throw unhandledException(
                `Shopify inventory_levels/set returned 404${detail ? `: ${detail}` : ""}. ` +
                    `Confirm the location exists, the inventory_item_id is correct, and the item is stocked at that location (activate inventory at the location in Shopify if needed).`,
            );
        }
        throw err;
    }
}

/**
 * Sets a Shopify variant to "Inventory not tracked" by SKU (best-effort).
 * This is used when a supplier does not track inventory but still calls inventory webhooks.
 *
 * @param {string} sku
 */
export async function setShopifyVariantInventoryNotTrackedBySku(sku) {
    const rawSku = typeof sku === "string" ? sku.trim() : "";
    if (!rawSku) throw unhandledException("sku is required");

    const safe = rawSku.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const searchQuery = `sku:"${safe}"`;

    const gql = `
query VariantBySku($query: String!) {
  productVariants(first: 5, query: $query) {
    nodes {
      legacyResourceId
      sku
      inventoryManagement
    }
  }
}
`;
    const gqlData = await shopifyGraphql(gql, { query: searchQuery });
    const nodes = gqlData?.productVariants?.nodes ?? [];
    const match = nodes.find((n) => String(n?.sku ?? "").trim() === rawSku) ?? nodes[0];
    const legacyId = match?.legacyResourceId;
    if (legacyId == null) {
        throw notFoundException(`No Shopify variant found for sku "${rawSku}"`);
    }

    const variantId = Number(legacyId);
    if (!Number.isFinite(variantId)) {
        throw unhandledException(`Invalid Shopify variant legacyResourceId for sku "${rawSku}"`);
    }

    const client = getShopifyAdminClient();
    const payload = { variant: { id: variantId, inventory_management: null } };
    console.log("[setShopifyVariantInventoryNotTrackedBySku] Updating variant", {
        sku: rawSku,
        variantId,
    });
    const { data } = await client.put(`/variants/${variantId}.json`, payload, { timeout: 30_000 });
    return data?.variant;
}

/**
 * Creates a fulfillment for one fulfillment order (FO) with tracking.
 * You must provide fulfillment-order line item IDs (these are FO line item ids, not order line item ids).
 *
 * @param {object} params
 * @param {string|number} params.fulfillmentOrderId Shopify fulfillment_order_id
 * @param {Array<{id: string|number, quantity: number}>} params.fulfillmentOrderLineItems FO line items to fulfill
 * @param {object} params.tracking Tracking info
 * @param {string} params.tracking.number Tracking number
 * @param {string} [params.tracking.company] Carrier/company name
 * @param {string} [params.tracking.url] Tracking URL
 * @param {boolean} [params.notifyCustomer=false] Notify customer
 * @param {string} [params.message] Optional message
 */
export async function createShopifyFulfillmentForFulfillmentOrder({
    fulfillmentOrderId,
    fulfillmentOrderLineItems,
    tracking,
    notifyCustomer = false,
    message,
}) {
    const client = getShopifyAdminClient();

    const payload = {
        fulfillment: {
            notify_customer: notifyCustomer,
            message,
            tracking_info: {
                number: tracking?.number,
                company: tracking?.company,
                url: tracking?.url,
            },
            line_items_by_fulfillment_order: [
                {
                    fulfillment_order_id: fulfillmentOrderId,
                    fulfillment_order_line_items: (fulfillmentOrderLineItems ?? []).map((li) => ({
                        id: li.id,
                        quantity: li.quantity,
                    })),
                },
            ],
        },
    };

    const { data } = await client.post(`/fulfillments.json`, payload);
    return data?.fulfillment;
}

