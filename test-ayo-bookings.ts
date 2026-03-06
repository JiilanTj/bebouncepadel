import { getBookings } from "./src/lib/ayo-client";

async function run() {
    try {
        console.log("Fetching bookings from Ayo API...");
        const response = await getBookings();

        console.log(JSON.stringify(response, null, 2));
    } catch (err) {
        console.error("Failed to fetch bookings:", err);
    }
}

run();
