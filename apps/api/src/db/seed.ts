import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "./index.js";
import { guests, restaurants, tables } from "./schema.js";

async function seedBffRaanana() {
  // 1) Restaurant
  const slug = "bff-raanana";

  const [existingRestaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.slug, slug))
    .limit(1);

  const operatingHours = {
    sun: { open: "17:30", close: "00:30" },
    mon: { open: "17:30", close: "01:00" },
    tue: { open: "17:30", close: "01:00" },
    wed: { open: "17:30", close: "01:00" },
    thu: { open: "17:30", close: "01:00" },
    fri: { open: "11:00", close: "16:00" },
    sat: { open: "19:00", close: "01:00" },
  } as const;

  let restaurantId: string;

  if (existingRestaurant) {
    restaurantId = existingRestaurant.id;
  } else {
    const [created] = await db
      .insert(restaurants)
      .values({
        name: "BFF Ra'anana",
        slug,
        description:
          "Kosher neighborhood bar & grill in Ra'anana with burgers, smoked meats, and cocktails.",
        cuisineType: "Bar & Grill",
        address: "Ahuza St 130, Ash Center, Ra'anana, Israel",
        phone: "+972 9-965-2241",
        email: "bffraanana@gmail.com",
        website: "https://bffraanana.wixsite.com/mysite",
        timezone: "Asia/Jerusalem",
        locale: "he",
        operatingHours,
        widgetConfig: {
          primaryColor: "#d97706",
          welcomeText: "הזמנת שולחן ל-BFF רעננה",
        },
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create BFF Ra'anana restaurant record");
    }

    restaurantId = created.id;
  }

  // 2) Tables
  const existingTables = await db
    .select()
    .from(tables)
    .where(eq(tables.restaurantId, restaurantId));

  if (existingTables.length === 0) {
    const tableSeeds = [
      { name: "T1", minSeats: 2, maxSeats: 2 },
      { name: "T2", minSeats: 2, maxSeats: 2 },
      { name: "T3", minSeats: 2, maxSeats: 4 },
      { name: "T4", minSeats: 2, maxSeats: 4 },
      { name: "T5", minSeats: 4, maxSeats: 4 },
      { name: "T6", minSeats: 4, maxSeats: 6 },
      { name: "T7", minSeats: 4, maxSeats: 6 },
      { name: "T8", minSeats: 4, maxSeats: 8 },
      { name: "T9", minSeats: 4, maxSeats: 10 },
      { name: "T10", minSeats: 6, maxSeats: 12 },
    ];

    await db.insert(tables).values(
      tableSeeds.map((t) => ({
        restaurantId,
        name: t.name,
        minSeats: t.minSeats,
        maxSeats: t.maxSeats,
        zone: "main",
        combinableWith: [],
        isActive: true,
      })),
    );
  }

  // 3) Guests
  const guestSeeds = [
    {
      name: "Test Guest One",
      phone: "+972501111111",
      email: "guest1@example.com",
    },
    {
      name: "Test Guest Two",
      phone: "+972502222222",
      email: "guest2@example.com",
    },
    {
      name: "Regular BFF",
      phone: "+972503333333",
      email: "regular@example.com",
    },
  ];

  for (const seed of guestSeeds) {
    const [existingGuest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.restaurantId, restaurantId), eq(guests.phone, seed.phone)))
      .limit(1);

    if (!existingGuest) {
      await db.insert(guests).values({
        restaurantId,
        name: seed.name,
        phone: seed.phone,
        email: seed.email,
        language: "he",
        source: "web",
      });
    }
  }

  return restaurantId;
}

async function main() {
  const restaurantId = await seedBffRaanana();
  console.log("Seeded BFF Ra'anana data for restaurant", restaurantId);
}

main().catch((err) => {
  console.error("Error while seeding database", err);
  process.exit(1);
});
