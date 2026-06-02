import Joi from "joi";

const shopifyOrderId = Joi.alternatives(Joi.string(), Joi.number()).required();

/** Shopify `orders/create` sends the full order resource; we only require `id` and keep all other fields. */
export const orderWebhookSchema = {
    body: Joi.object({
        id: shopifyOrderId,
    })
        .unknown(true)
        .required(),
};

const shopifyReturnId = Joi.alternatives(Joi.string(), Joi.number()).required();

/** Shopify `returns/request` webhook; require return id + nested order id. */
export const returnRequestWebhookSchema = {
    body: Joi.object({
        id: shopifyReturnId,
        order: Joi.object({
            id: shopifyOrderId,
        })
            .unknown(true)
            .required(),
    })
        .unknown(true)
        .required(),
};
