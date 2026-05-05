import {
    createShopifyProduct,
    updateShopifyProduct,
    deleteShopifyProduct,
    setShopifyInventoryLevel,
    createShopifyFulfillmentForFulfillmentOrder,
} from "../Shopify/shopifyAdmin.service.js";

/**
 * Supplier → Shopify bridge: each function returns payload for successResponse.
 */

export async function onSupplierProductCreate({ product }) {
    const data = await createShopifyProduct(product);
    return {
        data,
        message: "Shopify product created",
        statusCode: 201,
    };
}

export async function onSupplierProductUpdate({ productId, product }) {
    const data = await updateShopifyProduct(productId, product);
    return {
        data,
        message: "Shopify product updated",
        statusCode: 200,
    };
}

export async function onSupplierProductDelete({ productId }) {
    const data = await deleteShopifyProduct(productId);
    return {
        data,
        message: data.notFound
            ? "Shopify product was already deleted or missing"
            : "Shopify product deleted",
        statusCode: 200,
    };
}

export async function onSupplierInventorySet(body) {
    const data = await setShopifyInventoryLevel(body);
    return {
        data,
        message: "Shopify inventory updated",
        statusCode: 200,
    };
}

export async function onSupplierFulfillmentCreate(body) {
    const data = await createShopifyFulfillmentForFulfillmentOrder(body);
    return {
        data,
        message: "Shopify fulfillment created",
        statusCode: 201,
    };
}
