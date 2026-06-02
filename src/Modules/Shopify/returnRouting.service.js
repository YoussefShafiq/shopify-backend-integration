import { getSupplierHandler } from "../Suppliers/handlers/index.js";
import { fetchFulfillmentOrdersByOrderId } from "./shopifyFulfillmentOrder.service.js";
import { groupReturnLineItemsBySupplierLocation } from "./returnLineItemMatcher.js";
import { resolveSupplierByAssignedLocationId } from "./supplierResolution.service.js";

/**
 * Process a Shopify `returns/request` webhook:
 * 1. Fetch fulfillment orders for the order
 * 2. Match each return line item to an FO line → supplier location
 * 3. Group by supplier and dispatch to supplier handlers
 *
 * @param {object} returnPayload Full webhook body
 */
export async function processReturnRequestWebhook(returnPayload) {
    const orderId = returnPayload?.order?.id;
    if (orderId == null) {
        throw new Error("processReturnRequestWebhook: missing order.id");
    }

    const fulfillmentOrders = await fetchFulfillmentOrdersByOrderId(orderId);
    const { groups, unmatched } = groupReturnLineItemsBySupplierLocation({
        returnPayload,
        fulfillmentOrders,
    });

    if (unmatched.length > 0) {
        console.warn("[Return routing] Unmatched return line items", {
            shopifyReturnId: returnPayload.id,
            orderId,
            unmatchedCount: unmatched.length,
            unmatchedLineItemIds: unmatched.map(
                (li) => li?.fulfillment_line_item?.line_item?.id ?? li?.id,
            ),
        });
    }

    const results = await Promise.all(
        groups.map((group) => dispatchReturnGroupToSupplier({ returnPayload, group })),
    );

    return {
        shopifyReturnId: returnPayload.id,
        orderId,
        supplierCount: groups.length,
        unmatchedCount: unmatched.length,
        results,
    };
}

async function dispatchReturnGroupToSupplier({ returnPayload, group }) {
    const supplier = await resolveSupplierByAssignedLocationId(group.assignedLocationId);
    const handler = getSupplierHandler(supplier);

    return handler.createSupplierReturnFromShopifyReturn({
        returnPayload,
        supplier,
        group,
    });
}
