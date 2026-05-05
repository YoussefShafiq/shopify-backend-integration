import { unhandledException } from "../../../utils/response/failResponse.js";

/**
 * Abstract base class for supplier handlers.
 * In plain JS, this is enforced at runtime by throwing if not overridden.
 */
export class SupplierHandler {
    constructor(configuration) {
        this.configuration = configuration;
    }

    /**
     * Create/Upsert a supplier order based on ONE Shopify Fulfillment Order (FO).
     * Your implementation should be idempotent (safe to call multiple times).
     *
     * @param {object} params
     * @param {object} params.fo Shopify fulfillment order payload (from Admin API)
     * @param {object} params.supplier Supplier DB record (resolved by `assigned_location_id`)
     * @returns {Promise<any>} Supplier API response / created order reference
     */
    async createSupplierOrderFromFulfillmentOrder({ fo, supplier }) {
        throw unhandledException('createSupplierOrderFromFulfillmentOrder is not implemented');
    }
}

