import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import {
  transactions,
  transactionItems,
  products,
  menus,
  tables,
  productSellRecords,
  productRentRecords,
  TransactionType,
  TransactionStatus,
  TableStatus,
  ItemType,
  ProductSellStatus,
  ProductRentStatus,
  NotificationType,
} from "../db/schema.js";
import {
  createTransactionSchema,
  payTransactionSchema,
} from "../validators/transaction.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { createNotification } from "./notification.controller.js";

// Generate invoice number: INV-YYYYMMDD-XXXX
async function generateInvoiceNumber(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

  // Get count of transactions today
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        gte(transactions.createdAt, startOfDay),
        lte(transactions.createdAt, endOfDay)
      )
    );

  const count = (countResult[0]?.count ?? 0) + 1;
  const sequence = count.toString().padStart(4, "0");

  return `INV-${dateStr}-${sequence}`;
}

// POST /transactions
export async function createTransaction(c: Context) {
  try {
    const body = await c.req.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { type, tableId, customerName, paymentMethod, paidAmount, depositAmount, items } = validation.data;
    const user = c.get("user");

    // Validate table if provided
    if (tableId) {
      const table = await db.query.tables.findFirst({
        where: eq(tables.id, tableId),
      });
      if (!table) {
        return errorResponse(c, "Table not found", 404);
      }
      if (!table.isActive) {
        return errorResponse(c, "Table is not active", 400);
      }
    }

    // Start database transaction
    let totalAmount = 0;
    const result = await db.transaction(async (tx) => {
      const processedItems = [];
      const productSellItems: Array<{ productId: string; quantity: number; unitPrice: string; subtotal: string }> = [];
      const productRentItems: Array<{ productId: string; quantity: number; unitPrice: string; subtotal: string; expectedReturnAt?: Date; notes?: string }> = [];

      // Process each item
      for (const item of items) {
        if (item.itemType === ItemType.PRODUCT) {
          // Fetch product
          const product = await tx.query.products.findFirst({
            where: eq(products.id, item.id),
          });

          if (!product) {
            throw new Error(`Product not found: ${item.id}`);
          }

          if (!product.isActive) {
            throw new Error(`Product is not active: ${product.name}`);
          }

          // Check stock for SELL type or RENTAL transaction
          if (product.type === "SELL" || type === TransactionType.RENTAL) {
            if (product.stock < item.quantity) {
              throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
            }

            // Reduce stock
            await tx
              .update(products)
              .set({
                stock: product.stock - item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.id));
          }

          const unitPrice = parseFloat(product.price);
          const subtotal = unitPrice * item.quantity;
          totalAmount += subtotal;

          processedItems.push({
            itemType: ItemType.PRODUCT,
            productId: item.id,
            menuId: null,
            quantity: item.quantity,
            unitPrice: unitPrice.toString(),
            subtotal: subtotal.toString(),
            expectedReturnAt: item.expectedReturnAt ? new Date(item.expectedReturnAt) : null,
            notes: item.notes || null,
          });

          // Track for sell/rent record creation
          if (product.type === "SELL") {
            productSellItems.push({
              productId: item.id,
              quantity: item.quantity,
              unitPrice: unitPrice.toString(),
              subtotal: subtotal.toString(),
            });
          } else if (product.type === "RENT") {
            productRentItems.push({
              productId: item.id,
              quantity: item.quantity,
              unitPrice: unitPrice.toString(),
              subtotal: subtotal.toString(),
              expectedReturnAt: item.expectedReturnAt ? new Date(item.expectedReturnAt) : undefined,
              notes: item.notes,
            });
          }
        } else if (item.itemType === ItemType.MENU) {
          // Fetch menu
          const menu = await tx.query.menus.findFirst({
            where: eq(menus.id, item.id),
          });

          if (!menu) {
            throw new Error(`Menu not found: ${item.id}`);
          }

          if (!menu.isActive) {
            throw new Error(`Menu is not active: ${menu.name}`);
          }

          // Check stock if menu has stock limit
          if (menu.stock !== null && menu.stock !== undefined) {
            if (menu.stock < item.quantity) {
              throw new Error(`Insufficient stock for ${menu.name}. Available: ${menu.stock}`);
            }

            // Reduce stock
            await tx
              .update(menus)
              .set({
                stock: menu.stock - item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(menus.id, item.id));
          }

          const unitPrice = parseFloat(menu.price);
          const subtotal = unitPrice * item.quantity;
          totalAmount += subtotal;

          processedItems.push({
            itemType: ItemType.MENU,
            productId: null,
            menuId: item.id,
            quantity: item.quantity,
            unitPrice: unitPrice.toString(),
            subtotal: subtotal.toString(),
          });
        }
      }

      // Calculate change
      const changeAmount = paidAmount - totalAmount;
      if (changeAmount < 0) {
        throw new Error("Insufficient payment amount");
      }

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber();

      // Determine initial status
      const status = TransactionStatus.PAID;

      // Create transaction
      const [transaction] = await tx
        .insert(transactions)
        .values({
          invoiceNumber,
          type,
          tableId: tableId || null,
          customerName: customerName || null,
          totalAmount: totalAmount.toString(),
          paidAmount: paidAmount.toString(),
          changeAmount: changeAmount.toString(),
          depositAmount: (depositAmount || 0).toString(),
          paymentMethod,
          status,
          createdBy: user.userId,
        })
        .returning();

      // Create transaction items
      const insertedItems = [];
      for (const item of processedItems) {
        const [insertedItem] = await tx
          .insert(transactionItems)
          .values({
            transactionId: transaction!.id,
            ...item,
          })
          .returning();
        insertedItems.push(insertedItem);
      }

      // Create product sell records for SELL products
      for (const sellItem of productSellItems) {
        await tx.insert(productSellRecords).values({
          transactionId: transaction!.id,
          productId: sellItem.productId,
          quantity: sellItem.quantity,
          unitPrice: sellItem.unitPrice,
          subtotal: sellItem.subtotal,
          status: ProductSellStatus.ACTIVE,
        });
      }

      // Create product rent records for RENT products
      for (const rentItem of productRentItems) {
        await tx.insert(productRentRecords).values({
          transactionId: transaction!.id,
          productId: rentItem.productId,
          quantity: rentItem.quantity,
          unitPrice: rentItem.unitPrice,
          subtotal: rentItem.subtotal,
          status: ProductRentStatus.ACTIVE,
          expectedReturnAt: rentItem.expectedReturnAt,
          notes: rentItem.notes,
        });
      }

      // Update table status if table provided
      if (tableId) {
        await tx
          .update(tables)
          .set({
            status: TableStatus.OCCUPIED,
            currentCustomerName: customerName || null,
            occupiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tables.id, tableId));
      }

      return { transaction, items: insertedItems };
    });

    // Create notification based on transaction type
    if (result.transaction) {
      const isRental = type === TransactionType.RENTAL;
      // For POS type, check if it contains MENU items (POS) or PRODUCT items (Store Product)
      const hasMenu = items.some(item => item.itemType === ItemType.MENU);

      let notificationTitle = "Transaksi Baru";
      let actionText = "transaksi";

      if (isRental) {
        notificationTitle = "Rental Product Baru";
        actionText = "penyewaan alat";
      } else if (hasMenu) {
        notificationTitle = "Pembelian Menu baru";
        actionText = "pembelian menu";
      } else {
        notificationTitle = "Sell Product Baru";
        actionText = "pembelian produk";
      }

      const notificationMessage = `${customerName || "Customer"} melakukan ${actionText} sebesar Rp ${totalAmount.toLocaleString("id-ID")}`;

      await createNotification({
        type: NotificationType.TRANSACTION,
        title: notificationTitle,
        message: notificationMessage,
        data: {
          transactionId: result.transaction.id,
          invoiceNumber: result.transaction.invoiceNumber,
          customerName: result.transaction.customerName,
          totalAmount: totalAmount.toFixed(2),
          type: result.transaction.type,
        },
      });
    }

    return success(
      c,
      {
        transaction: result.transaction,
        items: result.items,
      },
      "Transaction created successfully",
      201
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create transaction";
    logger.error({ error: err }, "Failed to create transaction");
    return errorResponse(c, errorMessage, 500);
  }
}

// GET /transactions
export async function getAllTransactions(c: Context) {
  try {
    const type = c.req.query("type");
    const status = c.req.query("status");
    const date = c.req.query("date");
    const tableId = c.req.query("tableId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");

    const offset = (page - 1) * limit;

    const conditions = [];

    if (tableId) {
      conditions.push(eq(transactions.tableId, tableId));
    }

    if (type) {
      conditions.push(eq(transactions.type, type as "POS" | "RENTAL"));
    }

    if (status) {
      conditions.push(eq(transactions.status, status as "PENDING" | "PAID" | "CANCELLED" | "COMPLETED"));
    }

    if (startDate || endDate) {
      if (startDate) {
        conditions.push(gte(transactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(transactions.createdAt, new Date(endDate)));
      }
    } else if (date) {
      const queryDate = new Date(date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      conditions.push(
        and(
          gte(transactions.createdAt, queryDate),
          lte(transactions.createdAt, nextDay)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get transactions with items
    const data = await db.query.transactions.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(transactions.createdAt)],
      with: {
        items: {
          with: {
            product: true,
            menu: true,
          },
        },
        table: true,
      },
    });

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return success(c, {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    }, "Transactions retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch transactions");
    return errorResponse(c, "Failed to fetch transactions", 500);
  }
}

// GET /transactions/:id
export async function getTransactionById(c: Context) {
  try {
    const id = c.req.param("id");

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      with: {
        items: {
          with: {
            product: true,
            menu: true,
          },
        },
        table: true,
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      return errorResponse(c, "Transaction not found", 404);
    }

    return success(c, transaction, "Transaction retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch transaction");
    return errorResponse(c, "Failed to fetch transaction", 500);
  }
}

// PATCH /transactions/:id/cancel
export async function cancelTransaction(c: Context) {
  try {
    const id = c.req.param("id");

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      with: {
        items: true,
      },
    });

    if (!transaction) {
      return errorResponse(c, "Transaction not found", 404);
    }

    if (transaction.status === TransactionStatus.CANCELLED) {
      return errorResponse(c, "Transaction is already cancelled", 400);
    }

    // Start database transaction for stock restoration
    await db.transaction(async (tx) => {
      // Restore stock for each item
      for (const item of transaction!.items) {
        if (item.itemType === ItemType.PRODUCT && item.productId) {
          const product = await tx.query.products.findFirst({
            where: eq(products.id, item.productId),
          });

          if (product) {
            await tx
              .update(products)
              .set({
                stock: product.stock + item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));
          }
        } else if (item.itemType === ItemType.MENU && item.menuId) {
          const menu = await tx.query.menus.findFirst({
            where: eq(menus.id, item.menuId),
          });

          // Only restore if menu had stock tracking
          if (menu && menu.stock !== null && menu.stock !== undefined) {
            await tx
              .update(menus)
              .set({
                stock: menu.stock + item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(menus.id, item.menuId));
          }
        }
      }

      // Update sell records status to CANCELLED
      await tx
        .update(productSellRecords)
        .set({ status: ProductSellStatus.CANCELLED })
        .where(eq(productSellRecords.transactionId, id));

      // Update rent records status to CANCELLED
      await tx
        .update(productRentRecords)
        .set({ status: ProductRentStatus.CANCELLED })
        .where(eq(productRentRecords.transactionId, id));

      // Update transaction status
      await tx
        .update(transactions)
        .set({
          status: TransactionStatus.CANCELLED,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id));

      // Clear table if table was associated
      if (transaction.tableId) {
        await tx
          .update(tables)
          .set({
            status: TableStatus.EMPTY,
            currentCustomerName: null,
            currentCustomerPhone: null,
            occupiedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(tables.id, transaction.tableId));
      }
    });

    return success(c, { id }, "Transaction cancelled successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to cancel transaction");
    return errorResponse(c, "Failed to cancel transaction", 500);
  }
}

// PATCH /transactions/:id/complete
export async function completeTransaction(c: Context) {
  try {
    const id = c.req.param("id");

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });

    if (!transaction) {
      return errorResponse(c, "Transaction not found", 404);
    }

    if (transaction.type !== TransactionType.RENTAL) {
      return errorResponse(c, "Only rental transactions can be completed", 400);
    }

    if (transaction.status === TransactionStatus.COMPLETED) {
      return errorResponse(c, "Transaction is already completed", 400);
    }

    if (transaction.status === TransactionStatus.CANCELLED) {
      return errorResponse(c, "Cannot complete cancelled transaction", 400);
    }

    // Start database transaction for restoring rental stock
    await db.transaction(async (tx) => {
      // Get all items to restore stock
      const items = await tx.query.transactionItems.findMany({
        where: eq(transactionItems.transactionId, id),
      });

      // Restore stock for rental items ONLY
      for (const item of items) {
        if (item.itemType === ItemType.PRODUCT && item.productId) {
          const product = await tx.query.products.findFirst({
            where: eq(products.id, item.productId),
          });

          // ONLY restore if the product type is RENT
          // We don't want to restore SELL products (like snacks/drinks)
          if (product && product.type === "RENT") {
            await tx
              .update(products)
              .set({
                stock: product.stock + item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(products.id, item.productId));
          }
        }
      }

      // Update rent records to RETURNED
      await tx
        .update(productRentRecords)
        .set({
          status: ProductRentStatus.RETURNED,
          returnedAt: new Date(),
        })
        .where(eq(productRentRecords.transactionId, id));

      // Update transaction status
      await tx
        .update(transactions)
        .set({
          status: TransactionStatus.COMPLETED,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id));

      // Clear table if associated
      if (transaction.tableId) {
        await tx
          .update(tables)
          .set({
            status: TableStatus.EMPTY,
            currentCustomerName: null,
            currentCustomerPhone: null,
            occupiedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(tables.id, transaction.tableId));
      }
    });

    return success(c, { id }, "Transaction completed successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to complete transaction");
    return errorResponse(c, "Failed to complete transaction", 500);
  }
}

// PATCH /transactions/:id/pay
export async function payTransaction(c: Context) {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = payTransactionSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { paymentMethod, paidAmount } = validation.data;

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });

    if (!transaction) {
      return errorResponse(c, "Transaction not found", 404);
    }

    if (transaction.status === TransactionStatus.PAID) {
      return errorResponse(c, "Transaction is already paid", 400);
    }

    if (transaction.status === TransactionStatus.CANCELLED) {
      return errorResponse(c, "Cannot pay cancelled transaction", 400);
    }

    const totalAmountNum = parseFloat(transaction.totalAmount);
    const changeAmount = paidAmount - totalAmountNum;

    if (changeAmount < 0) {
      return errorResponse(c, "Insufficient paid amount", 400);
    }

    const [updated] = await db
      .update(transactions)
      .set({
        status: TransactionStatus.PAID,
        paymentMethod,
        paidAmount: paidAmount.toString(),
        changeAmount: changeAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    return success(c, updated, "Transaction paid successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to pay transaction");
    return errorResponse(c, "Failed to pay transaction", 500);
  }
}

