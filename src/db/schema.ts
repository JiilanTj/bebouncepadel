import { pgTable, uuid, text, timestamp, varchar, boolean, index, decimal, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const Role = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  KASIR: "KASIR",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["OWNER", "ADMIN", "KASIR"] })
    .notNull()
    .default("ADMIN"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Product Categories table
export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index("product_category_name_idx").on(table.name),
    slugIdx: index("product_category_slug_idx").on(table.slug),
  })
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;

// Menu Categories table
export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index("menu_category_name_idx").on(table.name),
    slugIdx: index("menu_category_slug_idx").on(table.slug),
  })
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type NewMenuCategory = typeof menuCategories.$inferInsert;

export const ProductType = {
  SELL: "SELL",
  RENT: "RENT",
} as const;

export type ProductType = (typeof ProductType)[keyof typeof ProductType];

// Products table
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Selling or Rental price
    costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
    stock: integer("stock").notNull().default(0),
    sku: text("sku").unique(),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    type: text("type", { enum: ["SELL", "RENT"] }).notNull(),
    productCategoryId: uuid("product_category_id")
      .notNull()
      .references(() => productCategories.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index("product_name_idx").on(table.name),
    slugIdx: index("product_slug_idx").on(table.slug),
    categoryIdx: index("product_category_idx").on(table.productCategoryId),
    typeIdx: index("product_type_idx").on(table.type),
  })
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Menus table (Food & Beverage)
export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
    stock: integer("stock"), // null means unlimited
    sku: text("sku").unique(),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    menuCategoryId: uuid("menu_category_id")
      .notNull()
      .references(() => menuCategories.id),
    isAvailable: boolean("is_available").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index("menu_name_idx").on(table.name),
    slugIdx: index("menu_slug_idx").on(table.slug),
    categoryIdx: index("menu_category_idx").on(table.menuCategoryId),
    availableIdx: index("menu_available_idx").on(table.isAvailable),
  })
);

export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;

// Relations
export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(productCategories, {
    fields: [products.productCategoryId],
    references: [productCategories.id],
  }),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ many }) => ({
  menus: many(menus),
}));

export const menusRelations = relations(menus, ({ one }) => ({
  category: one(menuCategories, {
    fields: [menus.menuCategoryId],
    references: [menuCategories.id],
  }),
}));

// Table Status Enum
export const TableStatus = {
  EMPTY: "EMPTY",
  OCCUPIED: "OCCUPIED",
} as const;

export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

// Tables table (for F&B / POS)
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name"),
    status: text("status", { enum: ["EMPTY", "OCCUPIED"] })
      .notNull()
      .default("EMPTY"),
    capacity: integer("capacity"),
    location: text("location"),
    currentCustomerName: text("current_customer_name"),
    currentCustomerPhone: text("current_customer_phone"),
    occupiedAt: timestamp("occupied_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    codeIdx: index("table_code_idx").on(table.code),
    statusIdx: index("table_status_idx").on(table.status),
    locationIdx: index("table_location_idx").on(table.location),
  })
);

export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;

// Transaction Enums
export const TransactionType = {
  POS: "POS",
  RENTAL: "RENTAL",
  BOOKING: "BOOKING",
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const PaymentMethod = {
  CASH: "CASH",
  QRIS: "QRIS",
  TRANSFER: "TRANSFER",
  OTHER: "OTHER",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const TransactionStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const ItemType = {
  PRODUCT: "PRODUCT",
  MENU: "MENU",
  BOOKING: "BOOKING",
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

// Transactions table
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    type: text("type", { enum: ["POS", "RENTAL", "BOOKING"] }).notNull(),
    tableId: uuid("table_id").references(() => tables.id),
    customerName: text("customer_name"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull(),
    changeAmount: decimal("change_amount", { precision: 10, scale: 2 }).notNull(),
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    fineAmount: decimal("fine_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    paymentMethod: text("payment_method", { enum: ["CASH", "QRIS", "TRANSFER", "OTHER"] }).notNull(),
    status: text("status", { enum: ["PENDING", "PAID", "CANCELLED", "COMPLETED"] })
      .notNull()
      .default("PENDING"),
    createdBy: uuid("created_by")
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    invoiceIdx: index("transaction_invoice_idx").on(table.invoiceNumber),
    typeIdx: index("transaction_type_idx").on(table.type),
    statusIdx: index("transaction_status_idx").on(table.status),
    tableIdx: index("transaction_table_idx").on(table.tableId),
    createdAtIdx: index("transaction_created_at_idx").on(table.createdAt),
  })
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Transaction Items table
export const transactionItems = pgTable(
  "transaction_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    itemType: text("item_type", { enum: ["PRODUCT", "MENU", "BOOKING"] }).notNull(),
    productId: uuid("product_id").references(() => products.id),
    menuId: uuid("menu_id").references(() => menus.id),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    expectedReturnAt: timestamp("expected_return_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    transactionIdx: index("item_transaction_idx").on(table.transactionId),
    productIdx: index("item_product_idx").on(table.productId),
    menuIdx: index("item_menu_idx").on(table.menuId),
  })
);

export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;

// Relations for Transactions
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  table: one(tables, {
    fields: [transactions.tableId],
    references: [tables.id],
  }),
  creator: one(users, {
    fields: [transactions.createdBy],
    references: [users.id],
  }),
  items: many(transactionItems),
  booking: many(bookings), // Update to many since one-to-one is handled via field mapping if needed, but many is safer for relations
}));

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
  menu: one(menus, {
    fields: [transactionItems.menuId],
    references: [menus.id],
  }),
}));

// Product Sell Record Status
export const ProductSellStatus = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
} as const;

export type ProductSellStatus = (typeof ProductSellStatus)[keyof typeof ProductSellStatus];

// Product Sell Records table
export const productSellRecords = pgTable(
  "product_sell_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    status: text("status", { enum: ["ACTIVE", "CANCELLED"] })
      .notNull()
      .default("ACTIVE"),
    soldAt: timestamp("sold_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    transactionIdx: index("sell_record_transaction_idx").on(table.transactionId),
    productIdx: index("sell_record_product_idx").on(table.productId),
    statusIdx: index("sell_record_status_idx").on(table.status),
    soldAtIdx: index("sell_record_sold_at_idx").on(table.soldAt),
  })
);

export type ProductSellRecord = typeof productSellRecords.$inferSelect;
export type NewProductSellRecord = typeof productSellRecords.$inferInsert;

// Product Rent Record Status
export const ProductRentStatus = {
  ACTIVE: "ACTIVE",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
} as const;

export type ProductRentStatus = (typeof ProductRentStatus)[keyof typeof ProductRentStatus];

// Product Rent Records table
export const productRentRecords = pgTable(
  "product_rent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    status: text("status", { enum: ["ACTIVE", "RETURNED", "CANCELLED"] })
      .notNull()
      .default("ACTIVE"),
    rentedAt: timestamp("rented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expectedReturnAt: timestamp("expected_return_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    transactionIdx: index("rent_record_transaction_idx").on(table.transactionId),
    productIdx: index("rent_record_product_idx").on(table.productId),
    statusIdx: index("rent_record_status_idx").on(table.status),
    rentedAtIdx: index("rent_record_rented_at_idx").on(table.rentedAt),
  })
);

export type ProductRentRecord = typeof productRentRecords.$inferSelect;
export type NewProductRentRecord = typeof productRentRecords.$inferInsert;

// Relations for Sell Records
export const productSellRecordsRelations = relations(productSellRecords, ({ one }) => ({
  transaction: one(transactions, {
    fields: [productSellRecords.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [productSellRecords.productId],
    references: [products.id],
  }),
}));

// Relations for Rent Records
export const productRentRecordsRelations = relations(productRentRecords, ({ one }) => ({
  transaction: one(transactions, {
    fields: [productRentRecords.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [productRentRecords.productId],
    references: [products.id],
  }),
}));

// Inventory Enums
export const InventoryType = {
  ASSET: "ASSET",
  CONSUMABLE: "CONSUMABLE",
} as const;

export type InventoryType = (typeof InventoryType)[keyof typeof InventoryType];

export const InventoryCondition = {
  GOOD: "GOOD",
  DAMAGED: "DAMAGED",
  NEED_REPAIR: "NEED_REPAIR",
  BROKEN: "BROKEN",
} as const;

export type InventoryCondition = (typeof InventoryCondition)[keyof typeof InventoryCondition];

export const InventoryStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DISPOSED: "DISPOSED",
} as const;

export type InventoryStatus = (typeof InventoryStatus)[keyof typeof InventoryStatus];

// Inventories table
export const inventories = pgTable(
  "inventories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    type: text("type", { enum: ["ASSET", "CONSUMABLE"] }).notNull(),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit"),
    condition: text("condition", { enum: ["GOOD", "DAMAGED", "NEED_REPAIR", "BROKEN"] })
      .notNull()
      .default("GOOD"),
    status: text("status", { enum: ["ACTIVE", "INACTIVE", "DISPOSED"] })
      .notNull()
      .default("ACTIVE"),
    ownerName: text("owner_name"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    location: text("location"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index("inventory_name_idx").on(table.name),
    slugIdx: index("inventory_slug_idx").on(table.slug),
    typeIdx: index("inventory_type_idx").on(table.type),
    conditionIdx: index("inventory_condition_idx").on(table.condition),
    statusIdx: index("inventory_status_idx").on(table.status),
  })
);

export type Inventory = typeof inventories.$inferSelect;
export type NewInventory = typeof inventories.$inferInsert;

// Inventory Adjustment Type
export const AdjustmentType = {
  ADD: "ADD",
  REMOVE: "REMOVE",
  CORRECTION: "CORRECTION",
} as const;

export type AdjustmentType = (typeof AdjustmentType)[keyof typeof AdjustmentType];

// Inventory Adjustments table
export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inventoryId: uuid("inventory_id")
      .notNull()
      .references(() => inventories.id, { onDelete: "cascade" }),
    changeType: text("change_type", { enum: ["ADD", "REMOVE", "CORRECTION"] }).notNull(),
    quantityBefore: integer("quantity_before").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    changeAmount: integer("change_amount").notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    inventoryIdx: index("adjustment_inventory_idx").on(table.inventoryId),
    createdAtIdx: index("adjustment_created_at_idx").on(table.createdAt),
  })
);

export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect;
export type NewInventoryAdjustment = typeof inventoryAdjustments.$inferInsert;

// Relations for Inventories
export const inventoriesRelations = relations(inventories, ({ many }) => ({
  adjustments: many(inventoryAdjustments),
}));

// Relations for Inventory Adjustments
export const inventoryAdjustmentsRelations = relations(inventoryAdjustments, ({ one }) => ({
  inventory: one(inventories, {
    fields: [inventoryAdjustments.inventoryId],
    references: [inventories.id],
  }),
  creator: one(users, {
    fields: [inventoryAdjustments.createdBy],
    references: [users.id],
  }),
}));

// Settings table
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessName: text("business_name"),
  businessEmail: text("business_email"),
  businessPhone: text("business_phone"),
  businessAddress: text("business_address"),
  businessMapLink: text("business_map_link"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  twitterUrl: text("twitter_url"),
  heroImageKey: text("hero_image_key"),

  heroImageUrl: text("hero_image_url"),
  weekdayOpen: varchar("weekday_open", { length: 5 }), // HH:MM
  weekdayClose: varchar("weekday_close", { length: 5 }), // HH:MM
  weekendOpen: varchar("weekend_open", { length: 5 }), // HH:MM
  weekendClose: varchar("weekend_close", { length: 5 }), // HH:MM
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Settings = typeof settings.$inferSelect;

// Facilities table
export const facilities = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 255 }).notNull().unique(), // e.g. "masjid", "cafe"
  icon: varchar("icon", { length: 50 }), // lucide icon name
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").default(0),
  isVisible: boolean("is_visible").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;

export const CourtType = {
  INDOOR: "INDOOR",
  OUTDOOR: "OUTDOOR",
} as const;

export type CourtType = (typeof CourtType)[keyof typeof CourtType];

export const CourtStatus = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE",
} as const;

export type CourtStatus = (typeof CourtStatus)[keyof typeof CourtStatus];

// Courts table
export const courts = pgTable("courts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ayoFieldId: text("ayo_field_id"), // Optional integration ID
  name: text("name").notNull(),
  slug: text("slug").unique(),
  type: text("type", { enum: ["INDOOR", "OUTDOOR"] }).notNull(),
  surface: text("surface").notNull(), // e.g. "Synthetic Grass", "Acrylic"
  status: text("status", { enum: ["ACTIVE", "MAINTENANCE", "INACTIVE"] })
    .notNull()
    .default("ACTIVE"),
  pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }).notNull(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Booking Enums
export const BookingStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PaymentStatus = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// Bookings table
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNumber: text("booking_number").notNull().unique(),
    courtId: uuid("court_id")
      .notNull()
      .references(() => courts.id),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    durationHours: decimal("duration_hours", { precision: 10, scale: 2 }).notNull(),
    pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    paymentStatus: text("payment_status", { enum: ["UNPAID", "PARTIAL", "PAID"] })
      .notNull()
      .default("UNPAID"),
    bookingStatus: text("booking_status", { enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] })
      .notNull()
      .default("PENDING"),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bookingNumberIdx: index("booking_number_idx").on(table.bookingNumber),
    courtIdx: index("booking_court_idx").on(table.courtId),
    statusIdx: index("booking_status_idx").on(table.bookingStatus),
    paymentStatusIdx: index("booking_payment_status_idx").on(table.paymentStatus),
    startTimeIdx: index("booking_start_time_idx").on(table.startTime),
  })
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type Court = typeof courts.$inferSelect;
export type NewCourt = typeof courts.$inferInsert;

// Relations update
export const bookingsRelations = relations(bookings, ({ one }) => ({
  court: one(courts, {
    fields: [bookings.courtId],
    references: [courts.id],
  }),
  transaction: one(transactions, {
    fields: [bookings.transactionId],
    references: [transactions.id],
  }),
  creator: one(users, {
    fields: [bookings.createdBy],
    references: [users.id],
  }),
}));

export const courtsRelations = relations(courts, ({ many }) => ({
  bookings: many(bookings),
}));

// Order Request Status Enum
export const OrderRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  PREPARING: "PREPARING",
  SERVED: "SERVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderRequestStatus = (typeof OrderRequestStatus)[keyof typeof OrderRequestStatus];

// Order Requests table (F&B orders from public)
export const orderRequests = pgTable(
  "order_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id),
    customerName: text("customer_name").notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    status: text("status", { enum: ["PENDING", "APPROVED", "PREPARING", "SERVED", "REJECTED", "CANCELLED"] })
      .notNull()
      .default("PENDING"),
    notes: text("notes"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderNumberIdx: index("order_request_number_idx").on(table.orderNumber),
    tableIdx: index("order_request_table_idx").on(table.tableId),
    statusIdx: index("order_request_status_idx").on(table.status),
    transactionIdx: index("order_request_transaction_idx").on(table.transactionId),
    createdAtIdx: index("order_request_created_at_idx").on(table.createdAt),
  })
);

export type OrderRequest = typeof orderRequests.$inferSelect;
export type NewOrderRequest = typeof orderRequests.$inferInsert;

// Order Request Items table
export const orderRequestItems = pgTable(
  "order_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderRequestId: uuid("order_request_id")
      .notNull()
      .references(() => orderRequests.id, { onDelete: "cascade" }),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderRequestIdx: index("order_request_item_order_idx").on(table.orderRequestId),
    menuIdx: index("order_request_item_menu_idx").on(table.menuId),
  })
);

export type OrderRequestItem = typeof orderRequestItems.$inferSelect;
export type NewOrderRequestItem = typeof orderRequestItems.$inferInsert;

// Relations for Order Requests
export const orderRequestsRelations = relations(orderRequests, ({ one, many }) => ({
  table: one(tables, {
    fields: [orderRequests.tableId],
    references: [tables.id],
  }),
  approver: one(users, {
    fields: [orderRequests.approvedBy],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [orderRequests.transactionId],
    references: [transactions.id],
  }),
  items: many(orderRequestItems),
}));

export const orderRequestItemsRelations = relations(orderRequestItems, ({ one }) => ({
  orderRequest: one(orderRequests, {
    fields: [orderRequestItems.orderRequestId],
    references: [orderRequests.id],
  }),
  menu: one(menus, {
    fields: [orderRequestItems.menuId],
    references: [menus.id],
  }),
}));

// Notification Types
export const NotificationType = {
  ORDER_REQUEST: "ORDER_REQUEST",
  BOOKING: "BOOKING",
  TRANSACTION: "TRANSACTION",
  SYSTEM: "SYSTEM",
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// Notifications table
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", { enum: ["ORDER_REQUEST", "BOOKING", "TRANSACTION", "SYSTEM"] }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: text("data"), // JSON string for additional data
    isRead: boolean("is_read").notNull().default(false),
    userId: uuid("user_id").references(() => users.id), // null = broadcast to all
    orderRequestId: uuid("order_request_id").references(() => orderRequests.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("notification_user_idx").on(table.userId),
    isReadIdx: index("notification_is_read_idx").on(table.isRead),
    typeIdx: index("notification_type_idx").on(table.type),
    createdAtIdx: index("notification_created_at_idx").on(table.createdAt),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// Relations for Notifications
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  orderRequest: one(orderRequests, {
    fields: [notifications.orderRequestId],
    references: [orderRequests.id],
  }),
}));
