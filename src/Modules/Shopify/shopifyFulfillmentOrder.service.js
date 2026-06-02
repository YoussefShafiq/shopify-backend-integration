import { getShopifyAdminClient } from "./shopifyAdmin.service.js";

/**
 * Fetch all fulfillment orders for a Shopify order (Admin REST).
 * @see https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillmentorder
 * @param {string|number} orderId Shopify order id
 * @returns {Promise<object[]>}
 */
export async function fetchFulfillmentOrdersByOrderId(orderId) {
    const client = getShopifyAdminClient();
    const { data } = await client.get(`/orders/${String(orderId)}/fulfillment_orders.json`);
    return data?.fulfillment_orders ?? [];
}
