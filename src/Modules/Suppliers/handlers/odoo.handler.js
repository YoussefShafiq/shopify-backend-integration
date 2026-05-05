import axios from "axios";
import crypto from "crypto";
import { unhandledException } from "../../../utils/response/failResponse.js";
import { SupplierHandler } from "./supplierHandler.base.js";

function mapFulfillmentOrderToOdooJsonRpcPayload({ fo, supplierCode, requestId }) {
    const destination = fo?.destination ?? {};
    const name = [destination?.first_name, destination?.last_name].filter(Boolean).join(" ").trim();

    console.log('2- mapFulfillmentOrderToOdooJsonRpcPayload---------------------------------------------');

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
                // Shopify FO payload doesn't include SKU by default; prefer explicit `sku` if it exists, otherwise empty string.
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
 * Odoo supplier handler
 * This handler is responsible for creating/upserting a supplier order in Odoo based on a Shopify Fulfillment Order (FO).
 * It extends the abstract SupplierHandler class and implements the createSupplierOrderFromFulfillmentOrder method.
 * It uses the Odoo API to create/upsert the order.
 * It uses the Odoo API to create/upsert the order.
 */
export class OdooSupplierHandler extends SupplierHandler {
    constructor(configuration) {
        super(configuration);
    }

    async createSupplierOrderFromFulfillmentOrder({ fo, supplier }) {
        console.log('1- odoo createSupplierOrderFromFulfillmentOrder---------------------------------------------');

        const { baseUrl, apiKey } = this.configuration ?? {};
        const { shopify_location_id: supplierCode } = supplier ?? {};
        console.log({ supplier });

        if (!baseUrl) throw unhandledException('Odoo supplier configuration missing baseUrl');
        if (!supplierCode) throw unhandledException('Odoo supplier configuration missing supplierCode');

        // TODO: replace with your real Odoo endpoint + auth mechanism
        // Keeping it non-blocking for now: if you don't have Odoo ready, log payload shape.
        if (!apiKey) {
            console.warn('[OdooSupplierHandler] Missing apiKey; skipping remote call', {
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

        console.log('3- payload---------------------------------------------', { payload });

        console.log("[OdooSupplierHandler] Sending mapped JSON-RPC payload", payload);

        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        }

        console.log('4- headers---------------------------------------------', { headers });
        console.log('5- Url---------------------------------------------', `${baseUrl.replace(/\/+$/, '')}/connector/v1/fulfillment_orders/upsert`);
        const { data } = await axios.post(
            `${baseUrl.replace(/\/+$/, '')}/connector/v1/fulfillment_orders/upsert`,
            payload,
            {
                headers,
                timeout: 30_000,
            }
        );
        console.log('6- data---------------------------------------------', { data });

        return data;
    }
}

