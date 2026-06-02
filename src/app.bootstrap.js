import express from "express";

import { PORT } from "../configs/app.config.js";

import testDbConncection from "./DB/connection.js";

import authRouter from "./Modules/Auth/auth.controller.js";

import { globalErrorHandling } from "./utils/response/failResponse.js";

import userRouter from "./Modules/User/user.controller.js";

import cors from "cors";

import path from "path";

import { testRedisConnection } from "./DB/redis.connection.js";

import helmet from "helmet";

import shopifyRouter from "./Modules/Shopify/shopify.controller.js";

import supplierShopifyWebhookRouter from "./Modules/Suppliers/supplierShopifyWebhook.controller.js";

import { warmShopifyAccessToken } from "./Modules/Shopify/shopifyToken.service.js";
import { findById } from "./DB/Repository/get.repo.js";
import supplierModel from "./DB/Models/supplier.model.js";



export default async function bootstrap() {

    const app = express();

    await testDbConncection();

    await testRedisConnection();

    await warmShopifyAccessToken();

    app.use("/shopify", express.raw({ type: "application/json" }));

    app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "50mb" }), cors(), helmet());



    app.use("/uploads", express.static(path.resolve("./uploads")));

    app.use("/auth", authRouter);

    app.use("/user", userRouter);

    app.use("/shopify", shopifyRouter);

    app.use("/supplier", supplierShopifyWebhookRouter);



    app.listen(PORT, () => {

        console.log(`Server is running on port ${PORT}`);

    });



    app.all("*d", (req, res) => {
        console.log({
            "req.url": req.url,
            "req.path": req.path,
            "req.baseUrl": req.baseUrl,
            "req.method": req.method,
        });

        return res.status(400).json({

            success: false,

            message: "invalid route or method",
            "req.body": req.body,
            "req.url": req.url,
            "req.path": req.path,
            "req.baseUrl": req.baseUrl,
            "req.method": req.method
        });

    });



    app.use(globalErrorHandling);

}

