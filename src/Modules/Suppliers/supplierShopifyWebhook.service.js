import { resolveSupplierHandlerForWebhook } from "./handlers/index.js";
import { mapOdooProductForShopify } from "./mappers/odooShopifyProductMapper.js";

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
    const { supplier_code } = body;
    const { handler, supplier } = await resolveSupplierHandlerForWebhook({ supplier_code });
    return handler.onInventorySet(body, supplier);
}

export async function onSupplierFulfillmentCreate(body) {
    const { handler } = await resolveSupplierHandlerForWebhook({
        supplier_code: body?.supplier_code,
    });
    return handler.onFulfillmentCreate(body);

}
