import redisClient from "../redis.connection.js"

export async function set(key, value, ttl = 5 * 60 * 1000) {
    return await redisClient.set(key, value, { EX: ttl })
}

export async function get(key) {
    return await redisClient.get(key)
}

export async function del(key) {
    return await redisClient.del(key)
}

export async function ttl(key) {
    return await redisClient.ttl(key)
}

export async function incr(key) {
    return await redisClient.incr(key)
}