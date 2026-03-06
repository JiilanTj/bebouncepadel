import crypto from "crypto";
import axios, { AxiosError } from "axios";
import { logger } from "./logger";

// --- Config ---
const AYO_BASE_URL = process.env.AYO_BASE_URL || "";
const AYO_VENUE_CODE = process.env.AYO_VENUE_CODE || "";
const AYO_API_TOKEN = process.env.AYO_API_TOKEN || "";
const AYO_PRIVATE_KEY = process.env.AYO_PRIVATE_KEY || "";

// --- Types ---
export interface AyoField {
    id: number;
    name: string;
    [key: string]: unknown;
}

export interface AyoApiResponse<T = unknown> {
    error: boolean;
    status_code?: number;
    message?: string;
    data?: T;
}

// --- Signature ---

/**
 * Generate HMAC-SHA512 signature for Ayo API.
 *
 * Steps (from Ayo docs):
 * 1. Sort data by key ascending
 * 2. Convert to query string
 * 3. Hash with HMAC-SHA512 using private key
 */
export function generateSignature(params: Record<string, string>): string {
    // 1. Sort keys ascending
    const sortedKeys = Object.keys(params).sort();

    // 2. Build query string
    const queryString = sortedKeys
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key] ?? "")}`)
        .join("&");

    // 3. HMAC-SHA512
    const hmac = crypto.createHmac("sha512", AYO_PRIVATE_KEY);
    hmac.update(queryString);
    return hmac.digest("hex");
}

// --- HTTP Helper ---

/**
 * Ayo API requires `token` and `signature` in the request body for ALL
 * endpoints, including the ones documented as "GET".
 *
 * Because Bun / Node native `fetch` does NOT support sending a body on GET requests,
 * we use `axios` which allows it.
 */

interface AyoRequestOptions {
    endpoint: string;
    method?: "GET" | "POST";
    bodyParams?: Record<string, string>;
}

export async function ayoRequest<T = unknown>(
    options: AyoRequestOptions
): Promise<AyoApiResponse<T>> {
    const { endpoint, method = "GET", bodyParams = {} } = options;

    // Build payload – token is always required
    const payload: Record<string, string> = {
        token: AYO_API_TOKEN,
        ...bodyParams,
    };

    // Generate signature from payload (without the signature key itself)
    const signature = generateSignature(payload);
    payload.signature = signature;

    const url = `${AYO_BASE_URL}${endpoint}`;

    const finalUrl = method === "GET"
        ? `${url}?${Object.keys(payload).map(k => `${k}=${encodeURIComponent(String(payload[k]))}`).join('&')}`
        : url;

    logger.info({ url: finalUrl, method, payload: Object.keys(payload) }, "Ayo API request");

    try {
        const response = await axios({
            method,
            url,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            ...(method === "GET" ? { params: payload } : { data: payload })
        });

        const data = response.data as AyoApiResponse<T>;
        logger.info({ rawResponseBody: data }, "Ayo API response");
        return data;
    } catch (error) {
        if (error instanceof AxiosError) {
            logger.error(
                {
                    status: error.response?.status,
                    body: error.response?.data,
                    message: error.message,
                },
                "Ayo API request failed"
            );
            // Convert error object to string explicitly
            const errorDetails = JSON.stringify(error.response?.data || error.message);
            throw new Error(`Ayo API error: HTTP ${error.response?.status} – ${errorDetails}`);
        } else {
            const errorDetails = error instanceof Error ? error.message : String(error);
            logger.error({ error: errorDetails }, "Ayo API unknown error");
            throw new Error(`Ayo API unknown error: ${errorDetails}`);
        }
    }
}

// --- Specific API Methods ---

/**
 * GET /list-fields – Retrieve active venue fields from Ayo.
 * Token + signature are sent as query-string parameters.
 */
export async function getVenueFields(): Promise<AyoField[]> {
    const result = await ayoRequest<AyoField[]>({
        endpoint: `/list-fields`,
    });

    if (result.error !== false || !result.data) {
        const errorMsg = result.message || JSON.stringify(result);
        throw new Error(`Failed to get venue fields: ${errorMsg}`);
    }

    return result.data;
}

/**
 * GET /list-bookings/:venue_code – Retrieve bookings from Ayo.
 * Token + signature are sent as query-string parameters.
 */
export async function getBookings(
    filters: Record<string, string> = {}
): Promise<unknown[]> {
    const result = await ayoRequest<unknown[]>({
        endpoint: `/list-bookings/${AYO_VENUE_CODE}`,
        bodyParams: filters,
    });

    if (result.error !== false || !result.data) {
        const errorMsg = result.message || JSON.stringify(result);
        throw new Error(`Failed to get bookings: ${errorMsg}`);
    }

    return result.data;
}
