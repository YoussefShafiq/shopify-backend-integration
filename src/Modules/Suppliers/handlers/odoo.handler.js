import axios from "axios";
import crypto from "crypto";
import { findOne } from "../../../DB/Repository/get.repo.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import { unhandledException } from "../../../utils/response/failResponse.js";
import {
    findAllShopifyProductIdsByOdooProductId,
    resolveSupplierProductIdToShopifyProductId,
    resolveSupplierInventoryItemIdToShopifyInventoryItemId,
    syncOdooInventoryItemMetafieldsFromSupplierVariants,
} from "../../Shopify/shopifyAdmin.service.js";
import { mapOdooProductForShopify } from "../mappers/odooShopifyProductMapper.js";
import { SupplierHandler, resolveSupplierLocationIdViaDb } from "./supplierHandler.base.js";

function mapFulfillmentOrderToOdooJsonRpcPayload({ fo, supplierCode, requestId }) {
    const destination = fo?.destination ?? {};
    const name = [destination?.first_name, destination?.last_name].filter(Boolean).join(" ").trim();

    return {
        jsonrpc: "2.0",
        method: "call",
        id: null,
        params: {
            request_id: requestId,
            supplier_code: supplierCode,
            shopify_order_id: String(fo?.order_id ?? ""),
            shopify_fulfillment_order_id: String(fo?.id ?? ""),
            assigned_location_id: String(fo?.assigned_location_id ?? ""),
            shipping_address: {
                name: name || destination?.name || "",
                address1: destination?.address1 ?? "",
                city: destination?.city ?? "",
                zip: destination?.zip ?? "",
                phone: destination?.phone ?? "",
                email: destination?.email ?? "",
            },
            lines: (fo?.line_items ?? []).map((li) => ({
                sku: li?.sku ?? "",
                quantity: li?.quantity ?? 0,
                shopify_fo_line_item_id: String(li?.id ?? ""),
                variant_id: String(li?.variant_id ?? ""),
                inventory_item_id: String(li?.inventory_item_id ?? ""),
            })),
        },
    };
}

/**
 * Odoo supplier: Shopify fulfillment orders → Odoo API, and Odoo webhooks → Shopify Admin API.
 */
export class OdooSupplierHandler extends SupplierHandler {
    async createSupplierOrderFromFulfillmentOrder({ fo, supplier }) {
        const { baseUrl, apiKey } = this.configuration ?? {};
        const { shopify_location_id: supplierCode } = supplier ?? {};

        if (!baseUrl) throw unhandledException("Odoo supplier configuration missing baseUrl");
        if (!supplierCode) throw unhandledException("Odoo supplier configuration missing supplierCode");

        if (!apiKey) {
            console.warn("[OdooSupplierHandler] Missing apiKey; skipping remote call", {
                supplierId: supplier?._id,
                shopifyLocationId: supplier?.shopify_location_id,
                fulfillmentOrderId: fo?.id,
                orderId: fo?.order_id,
            });
            return { skipped: true };
        }

        const requestId = crypto.randomUUID();
        const payload = mapFulfillmentOrderToOdooJsonRpcPayload({
            fo,
            supplierCode,
            requestId,
        });

        const headers = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        };

        const { data } = await axios.post(
            `${baseUrl.replace(/\/+$/, "")}/connector/v1/fulfillment_orders/upsert`,
            payload,
            {
                headers,
                timeout: 30_000,
            },
        );

        return data;
    }

    async mapProductForShopify(product) {
        return mapOdooProductForShopify(product);
    }

    async resolveProductIdToShopifyProductId(productId) {
        return resolveSupplierProductIdToShopifyProductId(productId);
    }

    async findAllShopifyProductIdsForSupplierProductId(productId) {
        return findAllShopifyProductIdsByOdooProductId(productId);
    }

    async resolveInventoryItemIdToShopifyInventoryItemId(inventoryItemId) {
        return resolveSupplierInventoryItemIdToShopifyInventoryItemId(inventoryItemId);
    }

    async syncInventoryMetafieldsFromSupplierVariants(supplierVariants, shopifyProduct) {
        return syncOdooInventoryItemMetafieldsFromSupplierVariants(supplierVariants, shopifyProduct);
    }

    async resolveLocationIdToShopifyLocationId({ locationId, supplier, supplier_code }) {
        const resolvedSupplier = await resolveOdooSupplierForLocationWebhook({
            locationId,
            supplier_code,
            supplier,
        });
        return resolveSupplierLocationIdViaDb({ locationId, supplier: resolvedSupplier });
    }
}

/**
 * Odoo webhooks may send `supplier_code` after `locationId` lookup by warehouse code.
 */
export async function resolveOdooSupplierForLocationWebhook({ locationId, supplier_code, supplier }) {
    if (supplier) return supplier;

    const locStr = String(locationId ?? "").trim();
    const code = typeof supplier_code === "string" ? supplier_code.trim() : "";

    let resolved = await findOne(supplierModel, {
        shopify_location_id: locStr,
        isDeleted: { $ne: true },
    });
    if (!resolved && code) {
        resolved = await findOne(supplierModel, {
            shopify_location_id: code,
            isDeleted: { $ne: true },
        });
    }
    return resolved;
}
