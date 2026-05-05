import { Router } from "express";
import { shopifyValidation } from "../../Middlewares/shopify/shopifyValidation.middleware.js";
import { parseBody } from "../../Middlewares/shopify/shopifyBodyParser.middleware.js";
import { validation } from "../../Middlewares/validation.middleware.js";
import { orderWebhookSchema } from "./validation.schema.js";
import { upsertShopifyOrderFromWebhook } from "./order.service.js";
import { getFulfillmentByOrderId } from "./shopify.service.js";

const shopifyRouter = Router();

shopifyRouter.post(
    "/webhook/orders/create",
    shopifyValidation(),
    parseBody,
    validation(orderWebhookSchema),
    async (req, res) => {
        const { id } = req.body;
        try {
            await upsertShopifyOrderFromWebhook(req.body);
        } catch (err) {
            console.error("[Shopify webhook] Failed to persist order", {
                orderId: id,
                message: err?.message,
                stack: err?.stack,
            });
        }

        getFulfillmentByOrderId(id).catch((err) => {
            console.error("[Shopify webhook] Failed to process fulfillment orders", {
                orderId: id,
                message: err?.message,
                stack: err?.stack,
            });
        });

        return res.status(200).json({ message: "Webhook received" });
    }
);

export default shopifyRouter;
