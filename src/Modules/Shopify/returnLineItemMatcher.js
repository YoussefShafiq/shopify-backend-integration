/**
 * Pure functions: match Shopify return line items to fulfillment orders and group by supplier location.
 */

/**
 * @param {object[]} fulfillmentOrders
 * @param {object} returnLineItem Shopify return_line_items[] entry
 * @returns {{ fo: object, foLine: object } | null}
 */
export function matchReturnLineItemToFulfillmentOrder(fulfillmentOrders, returnLineItem) {
    const orderLineItemId = returnLineItem?.fulfillment_line_item?.line_item?.id;
    const fulfillmentLineItemId = returnLineItem?.fulfillment_line_item?.id;

    if (orderLineItemId == null && fulfillmentLineItemId == null) {
        return null;
    }

    let lineItemOnlyMatch = null;

    for (const fo of fulfillmentOrders ?? []) {
        for (const foLine of fo?.line_items ?? []) {
            const matchesFulfillmentLineItem =
                fulfillmentLineItemId != null &&
                String(foLine.id) === String(fulfillmentLineItemId);

            if (matchesFulfillmentLineItem) {
                return { fo, foLine };
            }

            const matchesOrderLineItem =
                orderLineItemId != null &&
                String(foLine.line_item_id) === String(orderLineItemId);

            if (matchesOrderLineItem && !lineItemOnlyMatch) {
                lineItemOnlyMatch = { fo, foLine };
            }
        }
    }

    return lineItemOnlyMatch;
}

/**
 * @typedef {object} SupplierReturnGroup
 * @property {string} assignedLocationId
 * @property {object} fulfillmentOrder
 * @property {object[]} items Matched return rows for this FO/location
 */

/**
 * Group return webhook line items by `assigned_location_id` of the matched fulfillment order.
 *
 * @param {object} params
 * @param {object} params.returnPayload Full returns/request webhook body
 * @param {object[]} params.fulfillmentOrders
 * @returns {{ groups: SupplierReturnGroup[], unmatched: object[] }}
 */
export function groupReturnLineItemsBySupplierLocation({ returnPayload, fulfillmentOrders }) {
    const returnLineItems = returnPayload?.return_line_items ?? [];
    /** @type {Map<string, SupplierReturnGroup>} */
    const byLocation = new Map();
    const unmatched = [];

    for (const returnLineItem of returnLineItems) {
        const match = matchReturnLineItemToFulfillmentOrder(fulfillmentOrders, returnLineItem);
        if (!match) {
            unmatched.push(returnLineItem);
            continue;
        }

        const { fo, foLine } = match;
        const assignedLocationId = String(fo.assigned_location_id ?? "");
        if (!assignedLocationId) {
            unmatched.push(returnLineItem);
            continue;
        }

        let group = byLocation.get(assignedLocationId);
        if (!group) {
            group = {
                assignedLocationId,
                fulfillmentOrder: fo,
                items: [],
            };
            byLocation.set(assignedLocationId, group);
        }

        group.items.push({
            returnLineItem,
            fulfillmentOrderLineItem: foLine,
            returnQuantity: returnLineItem.quantity ?? 0,
            lineItemId: returnLineItem?.fulfillment_line_item?.line_item?.id,
            fulfillmentLineItemId: returnLineItem?.fulfillment_line_item?.id,
            returnReason: returnLineItem.return_reason,
            returnReasonNote: returnLineItem.return_reason_note,
            customerNote: returnLineItem.customer_note,
        });
    }

    return {
        groups: [...byLocation.values()],
        unmatched,
    };
}
