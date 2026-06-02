import axios from "axios";
import { findOne } from "../../../DB/Repository/get.repo.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import { notFoundException, unhandledException } from "../../../utils/response/failResponse.js";
import {
    createShopifyProduct,
    createShopifyProductImage,
    deleteShopifyProductImage,
    getShopifyProduct,
    getShopifyAdminClient,
    updateShopifyProduct,
    deleteShopifyProduct,
    setShopifyInventoryLevel,
    setShopifyVariantInventoryNotTrackedBySku,
    createShopifyFulfillmentForFulfillmentOrder,
} from "../../Shopify/shopifyAdmin.service.js";

/**
 * Abstract base class for supplier integrations (Shopify ↔ supplier).
 * Subclasses implement supplier-specific ID resolution, payload mapping, and outbound API calls.
 */
export class SupplierHandler {
    constructor(configuration) {
        this.configuration = configuration ?? {};
    }

    // --- Shopify → supplier (fulfillment orders) ---

    /**
     * Create/Upsert a supplier order based on ONE Shopify Fulfillment Order (FO).
     * @param {object} params
     * @param {object} params.fo Shopify fulfillment order payload
     * @param {object} params.supplier Supplier DB record
     */
    async createSupplierOrderFromFulfillmentOrder({ fo, supplier }) {
        throw unhandledException("createSupplierOrderFromFulfillmentOrder is not implemented");
    }

    /**
     * Notify supplier of return line items routed to their fulfillment location.
     * @param {object} params
     * @param {object} params.returnPayload Full Shopify returns/request webhook body
     * @param {object} params.supplier Supplier DB record
     * @param {object} params.group Group from return routing (assignedLocationId, fulfillmentOrder, items)
     */
    async createSupplierReturnFromShopifyReturn({ returnPayload, supplier, group }) {
        throw unhandledException("createSupplierReturnFromShopifyReturn is not implemented");
    }

    // --- Supplier → Shopify (webhooks): hooks for subclasses ---

    /** Map supplier webhook `product` to Shopify REST product payload. */
    async mapProductForShopify(product, supplier) {
        throw unhandledException("mapProductForShopify is not implemented");
    }

    /** Resolve supplier `productId` to Shopify legacy product id (single target). */
    async resolveProductIdToShopifyProductId(productId) {
        throw unhandledException("resolveProductIdToShopifyProductId is not implemented");
    }

    /** All Shopify product ids linked to this supplier product id (e.g. metafield duplicates). Default: none. */
    async findAllShopifyProductIdsForSupplierProductId(productId) {
        return [];
    }

    /** Resolve supplier `inventoryItemId` to Shopify numeric inventory_item_id. */
    async resolveInventoryItemIdToShopifyInventoryItemId(inventoryItemId) {
        throw unhandledException("resolveInventoryItemIdToShopifyInventoryItemId is not implemented");
    }

    /** After create/update, persist supplier external ids on Shopify for later lookups. */
    async syncInventoryMetafieldsFromSupplierVariants(supplierVariants, shopifyProduct) {
        return;
    }

    /**
     * Supplier warehouse code → Shopify numeric location id.
     * @param {object} params
     * @param {string|number} params.locationId
     * @param {string} [params.supplier_code] Webhook body warehouse / supplier code
     * @param {object|null} params.supplier Resolved supplier DB record when available
     */
    async resolveLocationIdToShopifyLocationId({ locationId, supplier, supplier_code }) {
        throw unhandledException("resolveLocationIdToShopifyLocationId is not implemented");
    }

    // --- Supplier → Shopify: shared orchestration (template method) ---

    applySupplierVendor({ supplier, payload }) {
        const name = typeof supplier?.name === "string" ? supplier.name.trim() : "";
        if (name) payload.vendor = name;
    }

    applySupplierInventoryTracking({ supplier, payload }) {
        if (!supplier || supplier.tracksInventory !== false) return;
        if (!payload || typeof payload !== "object") return;
        if (!Array.isArray(payload.variants)) return;
        for (const v of payload.variants) {
            if (!v || typeof v !== "object") continue;
            v.inventory_management = null;
        }
    }

    /** Update webhook: product missing on Shopify → same path as create. */
    async createProductWhenUpdateTargetMissing({ product, supplier }) {
        const result = await this.onProductCreate({ product, supplier });
        const data =
            result.data && typeof result.data === "object"
                ? { ...result.data, createdViaUpdateFallback: true }
                : result.data;
        return {
            ...result,
            data,
            message: "Shopify product not found; created instead of update",
            statusCode: 201,
        };
    }

    async onProductCreate({ product, supplier }) {
        const payload = await this.mapProductForShopify(product, supplier);
        this.applySupplierVendor({ supplier, payload });
        this.applySupplierInventoryTracking({ supplier, payload });

        const imagesToUpload = Array.isArray(payload.images) ? [...payload.images] : [];
        if (payload.images) delete payload.images;

        const created = await createShopifyProduct(payload);
        const id = created?.id;
        if (id && imagesToUpload.length) {
            for (const img of imagesToUpload) {
                await createShopifyProductImage(id, img);
            }
        }

        let data = id ? await getShopifyProduct(id) : created;
        if (data && Array.isArray(product?.variants)) {
            await this.syncInventoryMetafieldsFromSupplierVariants(product.variants, data);
        }
        return {
            data,
            message: "Shopify product created",
            statusCode: 201,
        };
    }

    async onProductUpdate({ productId, product, supplier }) {
        let shopifyProductId;
        try {
            shopifyProductId = await this.resolveProductIdToShopifyProductId(productId);
        } catch (err) {
            if (err?.cause?.statusCode === 404) {
                return this.createProductWhenUpdateTargetMissing({ product, supplier });
            }
            throw err;
        }

        const payload = await this.mapProductForShopify(product, supplier);
        this.applySupplierVendor({ supplier, payload });
        this.applySupplierInventoryTracking({ supplier, payload });

        const imagesToUpload = Array.isArray(payload.images) ? [...payload.images] : [];
        if (payload.images) delete payload.images;

        let data;
        try {
            data = await updateShopifyProduct(shopifyProductId, payload);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 404) {
                return this.createProductWhenUpdateTargetMissing({ product, supplier });
            }
            throw err;
        }

        if (imagesToUpload.length) {
            const current = await getShopifyProduct(shopifyProductId);
            for (const existing of current?.images ?? []) {
                if (existing?.id != null) await deleteShopifyProductImage(shopifyProductId, existing.id);
            }
            for (const img of imagesToUpload) {
                await createShopifyProductImage(shopifyProductId, img);
            }
            data = await getShopifyProduct(shopifyProductId);
        }
        if (data && Array.isArray(product?.variants)) {
            await this.syncInventoryMetafieldsFromSupplierVariants(product.variants, data);
        }
        return {
            data,
            message: "Shopify product updated",
            statusCode: 200,
        };
    }

    async onProductDelete({ productId }) {
        const idStr = String(productId ?? "").trim();
        const bySupplier = await this.findAllShopifyProductIdsForSupplierProductId(idStr);
        const idsToDelete =
            bySupplier.length > 0 ? bySupplier : [await this.resolveProductIdToShopifyProductId(idStr)];

        const results = [];
        for (const sid of idsToDelete) {
            results.push(await deleteShopifyProduct(sid));
        }

        const allNotFound = results.length > 0 && results.every((r) => r.notFound);
        const data = {
            deleted: true,
            productIds: idsToDelete.map(String),
            productId: String(idsToDelete[0]),
            count: idsToDelete.length,
            notFound: allNotFound,
        };

        return {
            data,
            message: allNotFound
                ? "Shopify product was already deleted or missing"
                : idsToDelete.length > 1
                  ? `Deleted ${idsToDelete.length} Shopify products linked to supplier productId ${idStr}`
                  : "Shopify product deleted",
            statusCode: 200,
        };
    }

    async onInventorySet(body, supplier) {
        console.log("[SupplierHandler.onInventorySet] Enter", {
            supplierId: supplier?._id ? String(supplier._id) : null,
            supplierShopifyLocationId: supplier?.shopify_location_id,
            tracksInventory: supplier?.tracksInventory,
            hasSupplier: Boolean(supplier),
            body: {
                locationId: body?.locationId,
                inventoryItemId: body?.inventoryItemId,
                available: body?.available,
                supplier_code: body?.supplier_code,
            },
        });
        if (supplier && supplier.tracksInventory === false) {
            console.log(
                "[SupplierHandler.onInventorySet] Skipping inventory update because supplier.tracksInventory === false",
            );
            const sku = typeof body?.sku === "string" ? body.sku.trim() : "";
            if (sku) {
                try {
                    await setShopifyVariantInventoryNotTrackedBySku(sku);
                } catch (err) {
                    console.warn(
                        "[SupplierHandler.onInventorySet] Failed to set inventory not tracked for sku",
                        { sku, message: err?.message },
                    );
                }
            } else {
                console.warn(
                    "[SupplierHandler.onInventorySet] Missing sku; cannot auto-set inventory not tracked for variant",
                );
            }
            return {
                data: {
                    skipped: true,
                    reason: "SUPPLIER_NOT_TRACKING_INVENTORY",
                    supplierId: String(supplier?._id ?? ""),
                    supplierCode: supplier?.shopify_location_id ?? null,
                    sku: sku || null,
                },
                message: sku
                    ? "Supplier does not track inventory; set Shopify variant to not track inventory and skipped inventory update"
                    : "Supplier does not track inventory; skipped Shopify inventory update (send sku to auto-set variant inventory not tracked)",
                statusCode: 200,
            };
        }

        const { locationId, inventoryItemId, available, supplier_code, ...rest } = body;
        const shopifyLocationId = await this.resolveLocationIdToShopifyLocationId({
            locationId,
            supplier,
            supplier_code,
        });
        const shopifyInventoryItemId =
            await this.resolveInventoryItemIdToShopifyInventoryItemId(inventoryItemId);
        const data = await setShopifyInventoryLevel({
            locationId: shopifyLocationId,
            inventoryItemId: shopifyInventoryItemId,
            available,
            ...rest,
        });
        return {
            data,
            message: "Shopify inventory updated",
            statusCode: 200,
        };
    }

    async onFulfillmentCreate(body) {
        const data = await createShopifyFulfillmentForFulfillmentOrder(body);
        return {
            data,
            message: "Shopify fulfillment created",
            statusCode: 201,
        };
    }
}

function configurationShopifyAdminLocationId(configuration) {
    if (!configuration || typeof configuration !== "object") return null;
    const c = configuration;
    const raw =
        c.shopifyAdminLocationId ??
        c.shopifyLocationId ??
        c.shopify_location_numeric_id ??
        c.shopifyLocationNumericId;
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Shared location resolution: numeric Shopify id, or supplier `shopify_location_id` + configuration.
 */
export async function resolveSupplierLocationIdViaDb({ locationId, supplier }) {
    const locStr = String(locationId ?? "").trim();
    if (!locStr) notFoundException("locationId is required");

    const client = getShopifyAdminClient();
    const probe = await client.get(`/locations/${encodeURIComponent(locStr)}.json`, {
        validateStatus: (s) => s === 200 || s === 404,
    });
    if (probe.status === 200 && probe.data?.location?.id != null) {
        return Number(probe.data.location.id);
    }

    let resolvedSupplier = supplier;
    if (!resolvedSupplier) {
        resolvedSupplier = await findOne(supplierModel, {
            shopify_location_id: locStr,
            isDeleted: { $ne: true },
        });
    }

    const fromCfg = resolvedSupplier
        ? configurationShopifyAdminLocationId(resolvedSupplier.configuration)
        : null;
    if (fromCfg != null) {
        const verify = await client.get(`/locations/${fromCfg}.json`, {
            validateStatus: (s) => s === 200 || s === 404,
        });
        if (verify.status === 200 && verify.data?.location?.id != null) {
            return Number(verify.data.location.id);
        }
    }

    notFoundException(
        `Unknown Shopify location for locationId "${locStr}". ` +
            `Use Shopify's numeric location id (Settings → Locations), ` +
            `or store it on the supplier as configuration.shopifyAdminLocationId ` +
            `with shopify_location_id matching this warehouse code (and optional body supplier_code).`,
    );
}
