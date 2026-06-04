import { fetchFulfillmentOrdersByOrderId } from "./shopifyFulfillmentOrder.service.js";
import { getSupplierHandler } from "../Suppliers/handlers/index.js";
import { resolveSupplierByAssignedLocationId } from "./supplierResolution.service.js";

export async function getFulfillmentByOrderId(orderId) {
    const fulfillment_orders = await fetchFulfillmentOrdersByOrderId(orderId);
    if (fulfillment_orders.length === 0) {
        console.warn("[getFulfillmentByOrderId] No fulfillment orders yet", { orderId: String(orderId) });
        return;
    }
    console.log("[getFulfillmentByOrderId] Processing fulfillment orders", {
        orderId: String(orderId),
        count: fulfillment_orders.length,
        assignedLocationIds: fulfillment_orders.map((fo) => fo?.assigned_location_id),
    });
    await Promise.all(fulfillment_orders.map((fo) => handleFulfillmentOrder(fo)));
}

export async function handleFulfillmentOrder(fo) {
    const supplier = await resolveSupplierByAssignedLocationId(fo.assigned_location_id);
    const handler = getSupplierHandler(supplier);

    return handler.createSupplierOrderFromFulfillmentOrder({
        fo,
        supplier,
    });
}
