import { fetchFulfillmentOrdersByOrderId } from "./shopifyFulfillmentOrder.service.js";
import { getSupplierHandler } from "../Suppliers/handlers/index.js";
import { resolveSupplierByAssignedLocationId } from "./supplierResolution.service.js";

export async function getFulfillmentByOrderId(orderId) {
    const fulfillment_orders = await fetchFulfillmentOrdersByOrderId(orderId);
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
