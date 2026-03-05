import crypto from "crypto";
import axios from "axios";

const AYO_BASE_URL = "https://sandbox.ayodev.xyz/api/v2/third-party";
const AYO_VENUE_CODE = "goilM13uFh";
const AYO_API_TOKEN = "0amBvABpjtDnkbPu9rryELXlL7gJm1elfMd5kPoRaHFEa1w7rBztdmbdEyfJ";
const AYO_PRIVATE_KEY = "tmiatqsYdAZYvrlj1gB5DAxjzJV5HsT1JPrqE3RHA31VXJxAozyBP5sxgaCtzZb5ba45K42QGbEjrn67fbBbKXvTXUUsSl4VOha3AAtIAcZzax2kuc771OjjVOSsE6Wuc4mTnPhfVZso8zLEagh1PSkTmBRXtYVLLhX2j0d43nSlbXH2UyjM9qGWAJPa1Pl";

function generateSignature(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key] ?? "")}`)
        .join("&");

    console.log("String to sign:", queryString);
    const hmac = crypto.createHmac("sha512", AYO_PRIVATE_KEY);
    hmac.update(queryString);
    return hmac.digest("hex");
}

async function test() {
    const payload: any = { token: AYO_API_TOKEN };
    const signature = generateSignature(payload);
    payload.signature = signature;

    console.log("Payload:", payload);

    try {
        const response = await axios({
            method: "GET",
            url: `${AYO_BASE_URL}/list-fields`,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            data: payload,
        });

        console.log("Success:", response.data);
    } catch (e: any) {
        console.error("Error:", e.response?.status, e.response?.data || e.message);
    }
}

test();
