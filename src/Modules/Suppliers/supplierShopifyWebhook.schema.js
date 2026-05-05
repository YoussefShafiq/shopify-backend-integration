import Joi from "joi";

const shopifyResourceId = Joi.alternatives(Joi.string(), Joi.number()).required();

export const createProductSchema = {
    body: Joi.object({
        product: Joi.object().required(),
    }).required(),
};

export const updateProductSchema = {
    body: Joi.object({
        productId: shopifyResourceId,
        product: Joi.object().required(),
    }).required(),
};

export const deleteProductSchema = {
    body: Joi.object({
        productId: shopifyResourceId,
    }).required(),
};

export const setInventorySchema = {
    body: Joi.object({
        locationId: shopifyResourceId,
        inventoryItemId: shopifyResourceId,
        available: Joi.number().integer().min(0).required(),
    }).required(),
};

export const createFulfillmentSchema = {
    body: Joi.object({
        fulfillmentOrderId: shopifyResourceId,
        fulfillmentOrderLineItems: Joi.array()
            .items(
                Joi.object({
                    id: shopifyResourceId,
                    quantity: Joi.number().integer().min(1).required(),
                }).required()
            )
            .min(1)
            .required(),
        tracking: Joi.object({
            number: Joi.string().required(),
            company: Joi.string().optional(),
            url: Joi.string().uri().optional(),
        }).required(),
        notifyCustomer: Joi.boolean().default(false),
        message: Joi.string().optional(),
    }).required(),
};
