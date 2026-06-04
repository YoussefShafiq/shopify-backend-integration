import { getShopifyAdminBaseUrl, getShopifyAdminClient } from "./shopifyAdmin.service.js";

const FO_FETCH_TIMEOUT_MS = 20_000;
const FO_FETCH_MAX_ATTEMPTS = 4;
/** Shopify may not have FOs ready the instant `orders/create` fires. */
const FO_INITIAL_DELAY_MS = 2_000;
const FO_RETRY_DELAY_MS = 3_000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFulfillmentOrderError(err) {
    const code = err?.code ?? err?.cause?.code;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return true;
    }
    if (err?.message?.includes("timeout")) return true;
    const status = err?.response?.status;
    return status === 429 || (status != null && status >= 500);
}

/**
 * Fetch all fulfillment orders for a Shopify order (Admin REST).
 * Retries on timeout / 5xx — common right after `orders/create` when FOs are still being created.
 *
 * @see https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillmentorder
 * @param {string|number} orderId Shopify order id
 * @returns {Promise<object[]>}
 */
export async function fetchFulfillmentOrdersByOrderId(orderId) {
    const orderIdStr = String(orderId);
    const path = `/orders/${orderIdStr}/fulfillment_orders.json`;
    const url = `${getShopifyAdminBaseUrl()}${path}`;
    const client = getShopifyAdminClient();

    console.log("[fetchFulfillmentOrdersByOrderId] Start", {
        orderId: orderIdStr,
        url,
        maxAttempts: FO_FETCH_MAX_ATTEMPTS,
        initialDelayMs: FO_INITIAL_DELAY_MS,
    });

    await sleep(FO_INITIAL_DELAY_MS);

    let lastError;
    for (let attempt = 1; attempt <= FO_FETCH_MAX_ATTEMPTS; attempt++) {
        const startedAt = Date.now();
        try {
            const { data } = await client.get(path, { timeout: FO_FETCH_TIMEOUT_MS });
            const fulfillment_orders = data?.fulfillment_orders ?? [];
            console.log("[fetchFulfillmentOrdersByOrderId] Success", {
                orderId: orderIdStr,
                attempt,
                elapsedMs: Date.now() - startedAt,
                count: fulfillment_orders.length,
            });
            return fulfillment_orders;
        } catch (err) {
            lastError = err;
            const elapsedMs = Date.now() - startedAt;
            console.warn("[fetchFulfillmentOrdersByOrderId] Attempt failed", {
                orderId: orderIdStr,
                attempt,
                elapsedMs,
                message: err?.message,
                code: err?.code,
                status: err?.response?.status,
            });

            if (attempt >= FO_FETCH_MAX_ATTEMPTS || !isRetryableFulfillmentOrderError(err)) {
                throw err;
            }
            await sleep(FO_RETRY_DELAY_MS);
        }
    }

    throw lastError;
}
