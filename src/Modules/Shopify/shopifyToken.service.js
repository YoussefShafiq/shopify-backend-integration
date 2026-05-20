import axios from "axios";
import {
    SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_URL,
    SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET,
} from "../../../configs/app.config.js";
import { unhandledException } from "../../utils/response/failResponse.js";
import { normalizeShopifyStoreOrigin } from "./shopifyStore.util.js";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** @type {{ token: string, expiresAt: number } | null} */
let cachedToken = null;
/** @type {Promise<string> | null} */
let refreshInFlight = null;

export function usesShopifyClientCredentials() {
    return Boolean(SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_SECRET);
}

function shopifyStoreOrigin() {
    const origin = normalizeShopifyStoreOrigin(SHOPIFY_API_URL);
    if (!origin) {
        throw unhandledException(
            "SHOPIFY_API_URL is not configured. Set it to your store origin, e.g. https://your-store.myshopify.com",
        );
    }
    return origin;
}

function tokenEndpointUrl() {
    return `${shopifyStoreOrigin()}/admin/oauth/access_token`;
}

function assertShopifyAuthConfigured() {
    if (usesShopifyClientCredentials()) return;
    if (SHOPIFY_ACCESS_TOKEN) return;
    throw unhandledException(
        "Shopify Admin API is not configured. Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (Dev Dashboard app, client credentials grant), " +
            "or SHOPIFY_ACCESS_TOKEN as a fallback static offline token.",
    );
}

/**
 * Clears in-memory token cache (e.g. after 401 from Shopify).
 */
export function invalidateShopifyAccessToken() {
    cachedToken = null;
}

async function fetchAccessTokenViaClientCredentials() {
    const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
    });

    let response;
    try {
        response = await axios.post(tokenEndpointUrl(), params.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            timeout: 30_000,
            validateStatus: (s) => s >= 200 && s < 300,
        });
    } catch (err) {
        if (axios.isAxiosError(err) && err.response) {
            const st = err.response.status;
            const detail =
                typeof err.response.data === "string"
                    ? err.response.data.slice(0, 300)
                    : JSON.stringify(err.response.data ?? {}).slice(0, 300);
            throw unhandledException(
                `Shopify token request failed (${st}). Verify SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_API_URL, and that the app is installed on this store. ${detail}`,
            );
        }
        throw unhandledException(
            `Cannot reach Shopify token endpoint (${tokenEndpointUrl()}). Check SHOPIFY_API_URL and network connectivity.`,
        );
    }

    const accessToken = response.data?.access_token;
    const expiresIn = Number(response.data?.expires_in);

    if (!accessToken || typeof accessToken !== "string") {
        throw unhandledException("Shopify token response did not include access_token.");
    }

    const ttlMs =
        Number.isFinite(expiresIn) && expiresIn > 0
            ? expiresIn * 1000
            : 24 * 60 * 60 * 1000;

    cachedToken = {
        token: accessToken,
        expiresAt: Date.now() + ttlMs - TOKEN_REFRESH_BUFFER_MS,
    };

    return cachedToken.token;
}

async function resolveAccessToken(forceRefresh = false) {
    assertShopifyAuthConfigured();

    if (!usesShopifyClientCredentials()) {
        return SHOPIFY_ACCESS_TOKEN;
    }

    if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.token;
    }

    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = fetchAccessTokenViaClientCredentials().finally(() => {
        refreshInFlight = null;
    });

    return refreshInFlight;
}

/**
 * Returns a valid Shopify Admin API access token (refreshed automatically when using client credentials).
 */
export async function getShopifyAccessToken(forceRefresh = false) {
    return resolveAccessToken(forceRefresh);
}

/**
 * Validates credentials and prefetches a token before the server accepts traffic.
 */
export async function warmShopifyAccessToken() {
    assertShopifyAuthConfigured();
    const token = await getShopifyAccessToken();
    const mode = usesShopifyClientCredentials() ? "client credentials (auto-refresh)" : "static SHOPIFY_ACCESS_TOKEN";
    console.log(`[shopify] Admin API token ready (${mode})`);
    return token;
}
