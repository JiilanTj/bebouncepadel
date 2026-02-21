import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import type { Context } from "hono";
import { Workbook } from "exceljs";

import { db } from "../db/index.js";
import {
    transactions,
    bookings,
    productRentRecords,
    tables,
    TableStatus,
    courts,
    products,
    menus,
} from "../db/schema.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

/**
 * Get helper for date ranges
 */
function getDateRange(daysAgo: number = 0) {
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setDate(end.getDate() - daysAgo);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

/**
 * GET /stats/dashboard
 */
export async function getDashboardStats(c: Context) {
    try {
        const today = getDateRange(0);
        const yesterday = getDateRange(1);

        // 1. Revenue Today & Trend
        const revenueTodayQuery = await db
            .select({ total: sql<string>`sum(total_amount)` })
            .from(transactions)
            .where(
                and(
                    gte(transactions.createdAt, today.start),
                    lte(transactions.createdAt, today.end),
                    sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                )
            );

        const revenueYesterdayQuery = await db
            .select({ total: sql<string>`sum(total_amount)` })
            .from(transactions)
            .where(
                and(
                    gte(transactions.createdAt, yesterday.start),
                    lte(transactions.createdAt, yesterday.end),
                    sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                )
            );

        const revenueToday = parseFloat(revenueTodayQuery[0]?.total || "0");
        const revenueYesterday = parseFloat(revenueYesterdayQuery[0]?.total || "0");

        let revenueTrend = "0%";
        if (revenueYesterday > 0) {
            const diff = ((revenueToday - revenueYesterday) / revenueYesterday) * 100;
            revenueTrend = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`;
        } else if (revenueToday > 0) {
            revenueTrend = "+100%";
        }

        // 2. Bookings Today & Trend
        const bookingsTodayQuery = await db
            .select({ count: sql<number>`count(*)` })
            .from(bookings)
            .where(
                and(
                    gte(bookings.startTime, today.start),
                    lte(bookings.startTime, today.end),
                    sql`${bookings.bookingStatus} IN ('CONFIRMED', 'COMPLETED')`
                )
            );

        const bookingsYesterdayQuery = await db
            .select({ count: sql<number>`count(*)` })
            .from(bookings)
            .where(
                and(
                    gte(bookings.startTime, yesterday.start),
                    lte(bookings.startTime, yesterday.end),
                    sql`${bookings.bookingStatus} IN ('CONFIRMED', 'COMPLETED')`
                )
            );

        const bookingsTodayCount = bookingsTodayQuery[0]?.count || 0;
        const bookingsYesterdayCount = bookingsYesterdayQuery[0]?.count || 0;

        let bookingsTrend = "0%";
        if (bookingsYesterdayCount > 0) {
            const diff = ((bookingsTodayCount - bookingsYesterdayCount) / bookingsYesterdayCount) * 100;
            bookingsTrend = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`;
        } else if (bookingsTodayCount > 0) {
            bookingsTrend = "+100%";
        }

        // 3. Active Rentals
        const activeRentalsQuery = await db
            .select({ count: sql<number>`count(*)` })
            .from(productRentRecords)
            .where(eq(productRentRecords.status, "ACTIVE"));
        const activeRentalsCount = activeRentalsQuery[0]?.count || 0;

        // 4. Occupied Tables
        const occupiedTablesQuery = await db
            .select({ count: sql<number>`count(*)` })
            .from(tables)
            .where(and(eq(tables.status, TableStatus.OCCUPIED), eq(tables.isActive, true)));
        const occupiedTablesCount = occupiedTablesQuery[0]?.count || 0;

        // 5. Revenue Chart (Last 7 Days)
        const revenueChart = [];
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        for (let i = 6; i >= 0; i--) {
            const dayRange = getDateRange(i);
            const dayRevenueQuery = await db
                .select({ total: sql<string>`sum(total_amount)` })
                .from(transactions)
                .where(
                    and(
                        gte(transactions.createdAt, dayRange.start),
                        lte(transactions.createdAt, dayRange.end),
                        sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                    )
                );

            revenueChart.push({
                day: days[dayRange.start.getDay()],
                revenue: parseFloat(dayRevenueQuery[0]?.total || "0"),
            });
        }

        // 6. Next Booking
        const nextBooking = await db.query.bookings.findFirst({
            where: and(
                gte(bookings.startTime, new Date()),
                eq(bookings.bookingStatus, "CONFIRMED")
            ),
            orderBy: [bookings.startTime],
            with: {
                court: true,
            },
        });

        // 7. Low Stock Alert (Threshold < 5)
        const lowStockProducts = await db
            .select({ count: sql<number>`count(*)` })
            .from(products)
            .where(and(lte(products.stock, 5), eq(products.isActive, true)));

        const lowStockMenus = await db
            .select({ count: sql<number>`count(*)` })
            .from(menus)
            .where(and(lte(menus.stock, 5), eq(menus.isActive, true)));

        const lowStockCount = (lowStockProducts[0]?.count || 0) + (lowStockMenus[0]?.count || 0);

        // 8. Peak Hour Today
        const peakHourQuery = await db
            .select({
                hour: sql<number>`EXTRACT(HOUR FROM ${bookings.startTime})`,
                count: sql<number>`count(*)`
            })
            .from(bookings)
            .where(
                and(
                    gte(bookings.startTime, today.start),
                    lte(bookings.startTime, today.end)
                )
            )
            .groupBy(sql`EXTRACT(HOUR FROM ${bookings.startTime})`)
            .orderBy(sql`count(*) DESC`)
            .limit(1);

        const peakHourValue = peakHourQuery[0]
            ? `${peakHourQuery[0].hour}:00 - ${Number(peakHourQuery[0].hour) + 1}:00`
            : "Not enough data";

        return success(c, {
            totalRevenueToday: revenueToday,
            revenueTrend,
            revenueTrendUp: revenueToday >= revenueYesterday,
            totalBookingsToday: bookingsTodayCount,
            bookingsTrend,
            bookingsTrendUp: bookingsTodayCount >= bookingsYesterdayCount,
            activeRentals: activeRentalsCount,
            occupiedTables: occupiedTablesCount,
            revenueChart,
            nextBooking: nextBooking ? {
                courtName: nextBooking.court?.name,
                time: nextBooking.startTime,
            } : null,
            lowStockCount,
            peakHourToday: peakHourValue
        });
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch dashboard stats");
        return errorResponse(c, "Failed to fetch dashboard stats", 500);
    }
}

/**
 * GET /stats/reports
 */
export async function getReportsStats(c: Context) {
    try {
        const query = c.req.query();
        const startDateParam = query.startDate;
        const endDateParam = query.endDate;

        const now = new Date();
        // Default to current month if no dates provided
        let startOfRange = new Date(now.getFullYear(), now.getMonth(), 1);
        let endOfRange = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        if (startDateParam) {
            startOfRange = new Date(startDateParam);
            startOfRange.setHours(0, 0, 0, 0); // Ensure start of day
        }

        if (endDateParam) {
            endOfRange = new Date(endDateParam);
            endOfRange.setHours(23, 59, 59, 999); // Ensure end of day
        }

        // 1. Revenue In Range (Replaces Monthly Revenue Card Value)
        const revenueInRangeQuery = await db
            .select({ total: sql<string>`sum(total_amount)` })
            .from(transactions)
            .where(
                and(
                    gte(transactions.createdAt, startOfRange),
                    lte(transactions.createdAt, endOfRange),
                    sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                )
            );
        const revenueInRange = parseFloat(revenueInRangeQuery[0]?.total || "0");

        // Weekly revenue (Keep "This Week" for context, or could be last 7 days of range)
        // Let's keep it as "Live Last 7 Days" for now as per dashboard convention
        const startOfThisWeek = new Date();
        startOfThisWeek.setDate(now.getDate() - 7);
        const weeklyRevenueQuery = await db
            .select({ total: sql<string>`sum(total_amount)` })
            .from(transactions)
            .where(
                and(
                    gte(transactions.createdAt, startOfThisWeek),
                    sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                )
            );
        const weeklyRevenue = parseFloat(weeklyRevenueQuery[0]?.total || "0");

        // 2. Total Bookings in Range
        const bookingsInRangeQuery = await db
            .select({ count: sql<number>`count(*)` })
            .from(bookings)
            .where(
                and(
                    gte(bookings.startTime, startOfRange),
                    lte(bookings.startTime, endOfRange),
                    sql`${bookings.bookingStatus} IN ('CONFIRMED', 'COMPLETED')`
                )
            );
        const totalBookingsInRange = bookingsInRangeQuery[0]?.count || 0;

        // 3. Average Booking Value
        const avgBookingValue = totalBookingsInRange > 0 ? revenueInRange / totalBookingsInRange : 0;

        // 4. Revenue by Source (In Range)
        const revenueBySourceQuery = await db
            .select({
                type: transactions.type,
                total: sql<string>`sum(total_amount)`
            })
            .from(transactions)
            .where(
                and(
                    gte(transactions.createdAt, startOfRange),
                    lte(transactions.createdAt, endOfRange),
                    sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                )
            )
            .groupBy(transactions.type);

        const sourceData = revenueBySourceQuery.map(row => ({
            name: row.type === "POS" ? "POS Sales" :
                row.type === "RENTAL" ? "Rentals" : "Court Bookings",
            value: parseFloat(row.total),
            color: row.type === "POS" ? "var(--status-info)" :
                row.type === "RENTAL" ? "var(--status-warning)" : "var(--brand)"
        }));

        const totalRevenueSource = sourceData.reduce((acc, curr) => acc + curr.value, 0);
        const revenueBySource = sourceData.map(s => ({
            ...s,
            percentage: totalRevenueSource > 0 ? Math.round((s.value / totalRevenueSource) * 100) : 0
        }));

        // 5. Bookings by Court (In Range)
        const bookingsByCourtQuery = await db
            .select({
                courtName: courts.name,
                count: sql<number>`count(*)`
            })
            .from(bookings)
            .leftJoin(courts, eq(bookings.courtId, courts.id))
            .where(
                and(
                    gte(bookings.startTime, startOfRange),
                    lte(bookings.startTime, endOfRange)
                )
            )
            .groupBy(courts.name)
            .orderBy(sql`count(*) DESC`);

        const bookingsByCourt = bookingsByCourtQuery.map(row => ({
            name: row.courtName || "Unknown",
            bookings: Number(row.count)
        }));

        // 6. Insights
        const topCourt = bookingsByCourt[0]?.name || "None";

        const peakHourOverallQuery = await db
            .select({
                hour: sql<number>`EXTRACT(HOUR FROM ${bookings.startTime})`,
                count: sql<number>`count(*)`
            })
            .from(bookings)
            .where(
                and(
                    gte(bookings.startTime, startOfRange),
                    lte(bookings.startTime, endOfRange)
                )
            )
            .groupBy(sql`EXTRACT(HOUR FROM ${bookings.startTime})`)
            .orderBy(sql`count(*) DESC`)
            .limit(1);

        const peakHour = peakHourOverallQuery[0]
            ? `${peakHourOverallQuery[0].hour}:00`
            : "N/A";

        // 7. Revenue Chart (Daily in Range, capped at 31 days just in case to prevent overload, or last 7 days of range)
        // Let's do daily breakdown for the range.
        const revenueChart = [];
        const iterDate = new Date(startOfRange);
        // Safety cap
        let dayCount = 0;
        const MAX_DAYS = 90;

        while (iterDate <= endOfRange && dayCount < MAX_DAYS) {
            const dayStart = new Date(iterDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(iterDate);
            dayEnd.setHours(23, 59, 59, 999);

            const dayRevenueQuery = await db
                .select({ total: sql<string>`sum(total_amount)` })
                .from(transactions)
                .where(
                    and(
                        gte(transactions.createdAt, dayStart),
                        lte(transactions.createdAt, dayEnd),
                        sql`${transactions.status} IN ('PAID', 'COMPLETED')`
                    )
                );

            // Format day as "Tue 15"
            const dayName = dayStart.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

            revenueChart.push({
                day: dayName,
                revenue: parseFloat(dayRevenueQuery[0]?.total || "0"),
            });

            iterDate.setDate(iterDate.getDate() + 1);
            dayCount++;
        }

        return success(c, {
            weeklyRevenue,
            monthlyRevenue: revenueInRange,
            totalBookingsThisMonth: totalBookingsInRange,
            averageBookingValue: avgBookingValue,
            revenueBySource,
            bookingsByCourt,
            topCourt,
            peakHour,
            revenueChart
        });
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch reports stats");
        return errorResponse(c, "Failed to fetch reports stats", 500);
    }
}

export async function exportReports(c: Context) {
    try {
        const query = c.req.query();
        const startDateParam = query.startDate;
        const endDateParam = query.endDate;

        const now = new Date();
        let startOfRange = new Date(now.getFullYear(), now.getMonth(), 1);
        let endOfRange = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        if (startDateParam) {
            startOfRange = new Date(startDateParam);
            startOfRange.setHours(0, 0, 0, 0);
        }

        if (endDateParam) {
            endOfRange = new Date(endDateParam);
            endOfRange.setHours(23, 59, 59, 999);
        }

        // Fetch Data for Export (Super Complete Version)
        const transactionsList = await db.query.transactions.findMany({
            where: and(
                gte(transactions.createdAt, startOfRange),
                lte(transactions.createdAt, endOfRange),
                sql`${transactions.status} IN ('PAID', 'COMPLETED')`
            ),
            orderBy: [desc(transactions.createdAt)],
            with: {
                creator: true, // Cashier
                items: {
                    with: {
                        product: true,
                        menu: true
                    }
                },
                booking: {
                    with: {
                        court: true
                    }
                }
            }
        });

        // Summary Calculations
        const totalRevenue = transactionsList.reduce((sum, t) => sum + Number(t.totalAmount), 0);
        const totalTransactions = transactionsList.length;

        // Generate Excel
        const workbook = new Workbook();

        // --- Sheet 1: Summary ---
        const summarySheet = workbook.addWorksheet("Summary");
        summarySheet.columns = [
            { header: "Metric", key: "metric", width: 30 },
            { header: "Value", key: "value", width: 30 },
        ];
        summarySheet.addRow({ metric: "Report Generated At", value: new Date().toLocaleString() });
        summarySheet.addRow({ metric: "Period Start", value: startOfRange.toLocaleDateString() });
        summarySheet.addRow({ metric: "Period End", value: endOfRange.toLocaleDateString() });
        summarySheet.addRow({});
        summarySheet.addRow({ metric: "Total Revenue", value: totalRevenue });
        summarySheet.addRow({ metric: "Total Transactions", value: totalTransactions });

        // Styling Summary
        summarySheet.getRow(1).font = { bold: true, size: 12 };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

        // --- Sheet 2: Transactions (Master List) ---
        const txSheet = workbook.addWorksheet("Transactions");
        txSheet.columns = [
            { header: "Date", key: "date", width: 12 },
            { header: "Time", key: "time", width: 10 },
            { header: "Invoice #", key: "invoice", width: 20 },
            { header: "Type", key: "type", width: 12 },
            { header: "Customer", key: "customer", width: 20 },
            { header: "Status", key: "status", width: 12 },
            { header: "Method", key: "method", width: 12 },
            { header: "Total", key: "total", width: 15 },
            { header: "Paid", key: "paid", width: 15 },
            { header: "Change", key: "change", width: 15 },
            { header: "Cashier", key: "cashier", width: 15 },
        ];
        txSheet.getRow(1).font = { bold: true };
        txSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };

        // --- Sheet 3: Line Items (Detailed Breakdown) ---
        const itemsSheet = workbook.addWorksheet("Line Items");
        itemsSheet.columns = [
            { header: "Invoice #", key: "invoice", width: 20 },
            { header: "Date", key: "date", width: 12 },
            { header: "Item Type", key: "itemType", width: 15 },
            { header: "Item Name", key: "itemName", width: 30 },
            { header: "Qty", key: "qty", width: 8 },
            { header: "Unit Price", key: "price", width: 15 },
            { header: "Subtotal", key: "subtotal", width: 15 },
        ];
        itemsSheet.getRow(1).font = { bold: true };
        itemsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };

        // --- Populate Data ---
        transactionsList.forEach(tx => {
            const date = new Date(tx.createdAt);

            // Populate Transactions Sheet
            txSheet.addRow({
                date: date.toLocaleDateString(),
                time: date.toLocaleTimeString(),
                invoice: tx.invoiceNumber,
                type: tx.type,
                customer: tx.customerName || "Guest",
                status: tx.status,
                method: tx.paymentMethod,
                total: Number(tx.totalAmount),
                paid: Number(tx.paidAmount),
                change: Number(tx.changeAmount),
                cashier: tx.creator?.name || "System",
            });

            // Populate Line Items Sheet
            // 1. Transaction Items (Products/Menus)
            tx.items.forEach(item => {
                let name = "Unknown Item";
                if (item.product) name = item.product.name;
                else if (item.menu) name = item.menu.name;

                itemsSheet.addRow({
                    invoice: tx.invoiceNumber,
                    date: date.toLocaleDateString(),
                    itemType: item.itemType,
                    itemName: name,
                    qty: item.quantity,
                    price: Number(item.unitPrice),
                    subtotal: Number(item.subtotal)
                });
            });

            // 2. Bookings (if any linked directly or via type)
            if (tx.booking && Array.isArray(tx.booking)) {
                tx.booking.forEach(b => {
                    itemsSheet.addRow({
                        invoice: tx.invoiceNumber,
                        date: date.toLocaleDateString(),
                        itemType: "BOOKING",
                        itemName: `Court Booking: ${b.court?.name || 'Unknown'} (${new Date(b.startTime).toLocaleTimeString()} - ${new Date(b.endTime).toLocaleTimeString()})`,
                        qty: Number(b.durationHours), // Duration as qty
                        price: Number(b.pricePerHour),
                        subtotal: Number(b.totalPrice)
                    });
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();

        c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        c.header("Content-Disposition", `attachment; filename="report-${startOfRange.toISOString().split('T')[0]}.xlsx"`);

        return c.body(buffer as unknown as ArrayBuffer);

    } catch (err) {
        logger.error({ error: err }, "Failed to export report");
        return errorResponse(c, "Failed to export report", 500);
    }
}
