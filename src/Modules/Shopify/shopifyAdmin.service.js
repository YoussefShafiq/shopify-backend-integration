import axios from "axios";
import { SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_URL } from "../../../configs/app.config.js";
import { unhandledException } from "../../utils/response/failResponse.js";

const API_VERSION = "2024-01";

export function getShopifyAdminBaseUrl() {
    if (!SHOPIFY_API_URL) throw unhandledException('SHOPIFY_API_URL is not configured');
    return `${SHOPIFY_API_URL.replace(/\/+$/, '')}/admin/api/${API_VERSION}`;
}

export function getShopifyAdminClient() {
    if (!SHOPIFY_ACCESS_TOKEN) throw unhandledException('SHOPIFY_ACCESS_TOKEN is not configured');

    return axios.create({
        baseURL: getShopifyAdminBaseUrl(),
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json',
        },
        timeout: 30_000,
    });
}

/**
 * Creates a Shopify product.
 * @param {object} product Shopify product object (REST shape)
 */
export async function createShopifyProduct(product) {
    const client = getShopifyAdminClient();
    const { data } = await client.post(`/products.json`, { product });
    return data?.product;
}

/**
 * Updates a Shopify product by id.
 * @param {string|number} productId Shopify product id
 * @param {object} product Partial product object (REST shape)
 */
export async function updateShopifyProduct(productId, product) {
    const client = getShopifyAdminClient();
    const { data } = await client.put(`/products/${productId}.json`, { product: { ...product, id: productId } });
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
        validateStatus: (s) => s === 200 || s === 404,
    });
    if (status === 404) {
        return { deleted: true, productId: String(productId), notFound: true };
    }
    return { deleted: true, productId: String(productId), product: data?.product };
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
    const payload = {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available,
    };
    const { data } = await client.post(`/inventory_levels/set.json`, payload);
    return data;
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

