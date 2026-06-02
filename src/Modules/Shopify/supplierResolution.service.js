import { findOne } from "../../DB/Repository/get.repo.js";
import supplierModel from "../../DB/Models/supplier.model.js";
import { notFoundException } from "../../utils/response/failResponse.js";

/**
 * Resolve supplier DB record from a fulfillment order's assigned location.
 * @param {string|number} assignedLocationId
 */
export async function resolveSupplierByAssignedLocationId(assignedLocationId) {
    const locationKey = String(assignedLocationId ?? "").trim();
    if (!locationKey) {
        throw notFoundException("assigned_location_id is missing on fulfillment order");
    }

    const supplier = await findOne(supplierModel, {
        shopify_location_id: locationKey,
        isDeleted: { $ne: true },
    });

    if (!supplier) {
        throw notFoundException(`supplier not found for location "${locationKey}"`);
    }

    return supplier;
}
