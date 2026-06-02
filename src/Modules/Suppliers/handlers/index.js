import { findOne } from "../../../DB/Repository/get.repo.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import { notFoundException } from "../../../utils/response/failResponse.js";
import { supplierTypes } from "../../../utils/enums/supplier.enum.js";
import { OdooSupplierHandler } from "./odoo.handler.js";

export { SupplierHandler } from "./supplierHandler.base.js";

/**
 * Factory for a supplier handler from a DB supplier record (Shopify → supplier and supplier → Shopify).
 */
export function getSupplierHandler(supplier) {
    const { type, configuration } = supplier ?? {};

    if (!type) throw notFoundException("supplier type is missing");

    if (type === supplierTypes.odoo) {
        return new OdooSupplierHandler(configuration);
    }

    throw notFoundException("supplier type not supported");
}

/**
 * Resolves handler + supplier for supplier → Shopify webhooks.
 * When `supplier_code` is omitted, defaults to Odoo (only supported type today).
 */
export async function resolveSupplierHandlerForWebhook({ supplier_code }) {
    const code = typeof supplier_code === "string" ? supplier_code.trim() : "";

    if (code) {
        console.log("[resolveSupplierHandlerForWebhook] Resolving by supplier_code", {
            supplier_code: code,
        });
        const supplier = await findOne(supplierModel, {
            shopify_location_id: code,
            isDeleted: { $ne: true },
        });
        if (!supplier) {
            notFoundException(`Supplier not found for supplier_code "${code}"`);
        }
        console.log("[resolveSupplierHandlerForWebhook] Resolved supplier", {
            _id: String(supplier?._id ?? ""),
            shopify_location_id: supplier?.shopify_location_id,
            tracksInventory: supplier?.tracksInventory,
            type: supplier?.type,
        });
        return {
            handler: getSupplierHandler(supplier),
            supplier,
        };
    }

    return {
        handler: new OdooSupplierHandler({}),
        supplier: null,
    };
}
