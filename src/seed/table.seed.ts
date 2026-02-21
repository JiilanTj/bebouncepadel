import { db } from "../db/index.js";
import { tables, TableStatus } from "../db/schema.js";

const defaultTables = [
  // Indoor tables
  { code: "T01", name: "Table 1", capacity: 4, location: "indoor" },
  { code: "T02", name: "Table 2", capacity: 4, location: "indoor" },
  { code: "T03", name: "Table 3", capacity: 4, location: "indoor" },
  { code: "T04", name: "Table 4", capacity: 4, location: "indoor" },
  { code: "T05", name: "Table 5", capacity: 4, location: "indoor" },
  { code: "T06", name: "Table 6", capacity: 4, location: "indoor" },
  
  // Outdoor tables
  { code: "T07", name: "Table 7", capacity: 4, location: "outdoor" },
  { code: "T08", name: "Table 8", capacity: 4, location: "outdoor" },
  { code: "T09", name: "Table 9", capacity: 6, location: "outdoor" },
  { code: "T10", name: "Table 10", capacity: 6, location: "outdoor" },
  
  // VIP rooms
  { code: "VIP-01", name: "VIP Room 1", capacity: 8, location: "vip" },
  { code: "VIP-02", name: "VIP Room 2", capacity: 8, location: "vip" },
  { code: "VIP-03", name: "VIP Room 3", capacity: 10, location: "vip" },
];

export async function seedTables() {
  console.log("Seeding tables...");
  
  for (const tableData of defaultTables) {
    try {
      // Check if table already exists
      const existing = await db.query.tables.findFirst({
        where: (tables, { eq }) => eq(tables.code, tableData.code),
      });
      
      if (existing) {
        console.log(`  ⚠️  Table ${tableData.code} already exists, skipping`);
        continue;
      }
      
      // Insert table with EMPTY status (default)
      await db.insert(tables).values({
        ...tableData,
        status: TableStatus.EMPTY,
        currentCustomerName: null,
        currentCustomerPhone: null,
        occupiedAt: null,
        isActive: true,
      });
      
      console.log(`  ✅ Table ${tableData.code} created`);
    } catch (error) {
      console.error(`  ❌ Failed to create table ${tableData.code}:`, error);
    }
  }
  
  console.log("Table seeding completed!");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
