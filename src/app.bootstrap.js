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

export default async function bootstrap() {
    const app = express();
    await testDbConncection();
    await testRedisConnection();
    app.use("/shopify", express.raw({ type: "application/json" }));

    app.use(express.json(), cors(), helmet());

    app.use("/uploads", express.static(path.resolve("./uploads")));
    app.use("/auth", authRouter);
    app.use("/user", userRouter);
    app.use("/shopify", shopifyRouter);
    app.use("/supplier", supplierShopifyWebhookRouter);

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    app.all("*d", (req, res) => {
        return res.status(400).json({
            success: false,
            message: "invalid route or method",
        });
    });

    app.use(globalErrorHandling);
}
