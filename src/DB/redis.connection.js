import { createClient } from "redis"
import { REDIS_URL } from "../../configs/app.config.js";

const redisClient = createClient({
    url: REDIS_URL
});

redisClient.on("error", function (err) {
    throw err;
});

export async function testRedisConnection() {
    try {
        await redisClient.connect()
        console.log('connected to redis successfully')
    } catch (error) {
        console.log('error in connection to redis', error)
    }
}

export default redisClient