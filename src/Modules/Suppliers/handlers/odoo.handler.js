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

function mapReturnGroupToOdooJsonRpcPayload({ returnPayload, group, supplierCode, requestId }) {
    const fo = group?.fulfillmentOrder ?? {};

    return {
        jsonrpc: "2.0",
        method: "call",
        id: null,
        params: {
            request_id: requestId,
            supplier_code: supplierCode,
            shopify_return_id: String(returnPayload?.id ?? ""),
            shopify_return_name: returnPayload?.name ?? "",
            shopify_return_status: returnPayload?.status ?? "",
            shopify_order_id: String(returnPayload?.order?.id ?? fo?.order_id ?? ""),
            shopify_fulfillment_order_id: String(fo?.id ?? ""),
            assigned_location_id: String(group?.assignedLocationId ?? fo?.assigned_location_id ?? ""),
            lines: (group?.items ?? []).map((item) => {
                const foLine = item?.fulfillmentOrderLineItem ?? {};
                const returnLine = item?.returnLineItem ?? {};
                return {
                    sku: foLine?.sku ?? "",
                    return_quantity: item?.returnQuantity ?? returnLine?.quantity ?? 0,
                    shopify_return_line_item_id: String(returnLine?.id ?? ""),
                    shopify_line_item_id: String(item?.lineItemId ?? foLine?.line_item_id ?? ""),
                    shopify_fo_line_item_id: String(foLine?.id ?? ""),
                    shopify_fulfillment_line_item_id: String(item?.fulfillmentLineItemId ?? ""),
                    variant_id: String(foLine?.variant_id ?? ""),
                    inventory_item_id: String(foLine?.inventory_item_id ?? ""),
                    return_reason: item?.returnReason ?? returnLine?.return_reason ?? "",
                    return_reason_note: item?.returnReasonNote ?? returnLine?.return_reason_note ?? "",
                    customer_note: item?.customerNote ?? returnLine?.customer_note ?? "",
                };
            }),
        },
    };
}

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

    async createSupplierReturnFromShopifyReturn({ returnPayload, supplier, group }) {
        const { baseUrl, apiKey } = this.configuration ?? {};
        const { shopify_location_id: supplierCode } = supplier ?? {};

        if (!baseUrl) throw unhandledException("Odoo supplier configuration missing baseUrl");
        if (!supplierCode) throw unhandledException("Odoo supplier configuration missing supplierCode");

        if (!apiKey) {
            console.warn("[OdooSupplierHandler] Missing apiKey; skipping return remote call", {
                supplierId: supplier?._id,
                shopifyLocationId: supplier?.shopify_location_id,
                shopifyReturnId: returnPayload?.id,
                orderId: returnPayload?.order?.id,
            });
            return { skipped: true };
        }

        const requestId = crypto.randomUUID();
        const payload = mapReturnGroupToOdooJsonRpcPayload({
            returnPayload,
            group,
            supplierCode,
            requestId,
        });

        const headers = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        };

        const { data } = await axios.post(
            `${baseUrl.replace(/\/+$/, "")}/connector/v1/returns/upsert`,
            payload,
            {
                headers,
                timeout: 30_000,
            },
        );

        return data;
    }

    async mapProductForShopify(product, supplier) {
        return mapOdooProductForShopify(product, supplier);
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
