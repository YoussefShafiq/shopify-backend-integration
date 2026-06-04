import { Router } from "express";
import { shopifyValidation } from "../../Middlewares/shopify/shopifyValidation.middleware.js";
import { parseBody } from "../../Middlewares/shopify/shopifyBodyParser.middleware.js";
import { validation } from "../../Middlewares/validation.middleware.js";
import { orderWebhookSchema, returnRequestWebhookSchema } from "./validation.schema.js";
import { upsertShopifyOrderFromWebhook } from "./order.service.js";
import { upsertShopifyReturnFromWebhook } from "./return.service.js";
import { getFulfillmentByOrderId } from "./shopify.service.js";
import { processReturnRequestWebhook } from "./returnRouting.service.js";

const shopifyRouter = Router();

shopifyRouter.post(
    "/webhook/orders/create",
    // shopifyValidation(),
    parseBody,
    validation(orderWebhookSchema),
    async (req, res) => {
        const { id } = req.body;
        console.log("order create webhook received", req.body);
        try {
            await upsertShopifyOrderFromWebhook(req.body);
        } catch (err) {
            console.error("[Shopify webhook] Failed to persist order", {
                orderId: id,
                message: err?.message,
                stack: err?.stack,
            });
        }

        // Await FO processing so serverless (Lambda/Vercel) does not freeze after res.json().
        try {
            await getFulfillmentByOrderId(id);
        } catch (err) {
            console.error("[Shopify webhook] Failed to process fulfillment orders", {
                orderId: id,
                message: err?.message,
                stack: err?.stack,
            });
        }

        return res.status(200).json({ message: "Webhook received" });
    }
);

shopifyRouter.post(
    "/webhook/returns/request",
    shopifyValidation(),
    parseBody,
    validation(returnRequestWebhookSchema),
    async (req, res) => {
        const { id, order } = req.body;
        try {
            await upsertShopifyReturnFromWebhook(req.body);
        } catch (err) {
            console.error("[Shopify webhook] Failed to persist return", {
                returnId: id,
                orderId: order?.id,
                message: err?.message,
                stack: err?.stack,
            });
        }

        processReturnRequestWebhook(req.body).catch((err) => {
            console.error("[Shopify webhook] Failed to route return to suppliers", {
                returnId: id,
                orderId: order?.id,
                message: err?.message,
                stack: err?.stack,
            });
        });

        return res.status(200).json({ message: "Webhook received" });
    },
);

export default shopifyRouter;
