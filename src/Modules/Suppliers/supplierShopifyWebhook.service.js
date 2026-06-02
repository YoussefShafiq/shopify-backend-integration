import { resolveSupplierHandlerForWebhook } from "./handlers/index.js";
import { mapOdooProductForShopify } from "./mappers/odooShopifyProductMapper.js";
import { findOne } from "../../DB/Repository/get.repo.js";
import supplierModel from "../../DB/Models/supplier.model.js";

/**
 * Supplier → Shopify bridge.
 * Routes each webhook to the correct supplier handler (Odoo today; more types via getSupplierHandler).
 */

/** @deprecated Prefer supplier handler; kept for backward-compatible imports. */
export const mapSupplierProductForShopify = mapOdooProductForShopify;

export async function onSupplierProductCreate({ product, supplier_code }) {
    const { handler, supplier } = await resolveSupplierHandlerForWebhook({ supplier_code });
    return handler.onProductCreate({ product, supplier });
}

export async function onSupplierProductUpdate({ productId, product, supplier_code }) {
    const { handler, supplier } = await resolveSupplierHandlerForWebhook({ supplier_code });
    return handler.onProductUpdate({ productId, product, supplier });
}

export async function onSupplierProductDelete({ productId, supplier_code }) {
    const { handler } = await resolveSupplierHandlerForWebhook({ supplier_code });
    return handler.onProductDelete({ productId });
}

export async function onSupplierInventorySet(body) {
    const { supplier_code, locationId } = body;
    console.log("[onSupplierInventorySet] Incoming body", body);
    const { handler, supplier } = await resolveSupplierHandlerForWebhook({ supplier_code });
    console.log("[onSupplierInventorySet] After resolveSupplierHandlerForWebhook", {
        supplier_code,
        locationId,
        hasSupplier: Boolean(supplier),
        supplierId: supplier?._id ? String(supplier._id) : null,
        supplierShopifyLocationId: supplier?.shopify_location_id,
        tracksInventory: supplier?.tracksInventory,
    });

    if (supplier) {
        return handler.onInventorySet(body, supplier);
    }

    const locStr = String(locationId ?? "").trim();
    if (locStr) {
        console.log("[onSupplierInventorySet] Attempting fallback supplier lookup by locationId", {
            locationId: locStr,
        });
        const byLocation = await findOne(supplierModel, {
            shopify_location_id: locStr,
            isDeleted: { $ne: true },
        });
        if (byLocation) {
            console.log("[onSupplierInventorySet] Fallback supplier resolved by locationId", {
                _id: String(byLocation?._id ?? ""),
                shopify_location_id: byLocation?.shopify_location_id,
                tracksInventory: byLocation?.tracksInventory,
            });
            const resolved = await resolveSupplierHandlerForWebhook({
                supplier_code: byLocation.shopify_location_id,
            });
            return resolved.handler.onInventorySet(body, resolved.supplier);
        }
    }

    return handler.onInventorySet(body, supplier);
}

export async function onSupplierFulfillmentCreate(body) {
    const { handler } = await resolveSupplierHandlerForWebhook({
        supplier_code: body?.supplier_code,
    });
    return handler.onFulfillmentCreate(body);

}
