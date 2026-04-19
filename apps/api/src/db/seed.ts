import "dotenv/config";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../env.js";
import { db } from "./index.js";
import { adminUsers, guests, reservations, restaurants, tables } from "./schema.js";

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
          primaryColor: "#C41E3A",
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

  // 4) Seed reservations for today and tomorrow
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  const allGuests = await db
    .select()
    .from(guests)
    .where(eq(guests.restaurantId, restaurantId));

  const allTables = await db
    .select()
    .from(tables)
    .where(eq(tables.restaurantId, restaurantId));

  const existingReservations = await db
    .select()
    .from(reservations)
    .where(eq(reservations.restaurantId, restaurantId));

  if (existingReservations.length === 0 && allGuests.length > 0 && allTables.length > 0) {
    const reservationSeeds = [
      // Today
      {
        guestIdx: 0,
        tableIdx: 0,
        date: toDateStr(today),
        timeStart: "18:00",
        timeEnd: "20:00",
        partySize: 2,
        status: "confirmed" as const,
      },
      {
        guestIdx: 1,
        tableIdx: 2,
        date: toDateStr(today),
        timeStart: "19:00",
        timeEnd: "21:00",
        partySize: 4,
        status: "confirmed" as const,
      },
      {
        guestIdx: 2,
        tableIdx: 5,
        date: toDateStr(today),
        timeStart: "20:00",
        timeEnd: "22:00",
        partySize: 6,
        status: "pending" as const,
      },
      {
        guestIdx: 0,
        tableIdx: 4,
        date: toDateStr(today),
        timeStart: "20:30",
        timeEnd: "22:30",
        partySize: 4,
        status: "seated" as const,
      },
      {
        guestIdx: 1,
        tableIdx: 1,
        date: toDateStr(today),
        timeStart: "21:00",
        timeEnd: "23:00",
        partySize: 2,
        status: "confirmed" as const,
      },
      // Tomorrow
      {
        guestIdx: 2,
        tableIdx: 7,
        date: toDateStr(tomorrow),
        timeStart: "18:30",
        timeEnd: "20:30",
        partySize: 8,
        status: "confirmed" as const,
      },
      {
        guestIdx: 0,
        tableIdx: 3,
        date: toDateStr(tomorrow),
        timeStart: "19:30",
        timeEnd: "21:30",
        partySize: 3,
        status: "pending" as const,
      },
      {
        guestIdx: 1,
        tableIdx: 6,
        date: toDateStr(tomorrow),
        timeStart: "20:00",
        timeEnd: "22:00",
        partySize: 5,
        status: "confirmed" as const,
      },
    ];

    await db.insert(reservations).values(
      reservationSeeds.map((r) => ({
        restaurantId,
        guestId: allGuests[r.guestIdx].id,
        date: r.date,
        timeStart: r.timeStart,
        timeEnd: r.timeEnd,
        partySize: r.partySize,
        tableIds: [allTables[r.tableIdx].id],
        status: r.status,
        source: "web" as const,
      })),
    );
  }

  // 5) Admin user
  const adminEmail = "admin@bff.co.il";
  const configuredPassword = env.ADMIN_SEED_PASSWORD;
  const [existingAdmin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, adminEmail))
    .limit(1);

  if (!existingAdmin) {
    const adminPassword = configuredPassword ?? crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.insert(adminUsers).values({
      restaurantId,
      role: "admin",
      email: adminEmail,
      passwordHash,
      name: "BFF Admin",
    });

    console.log("=".repeat(50));
    console.log("Admin user created:");
    console.log(`  Email:    ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    if (configuredPassword) {
      console.log("  Source:   ADMIN_SEED_PASSWORD env var");
    }
    console.log("=".repeat(50));
  } else if (configuredPassword) {
    const passwordMatches = await bcrypt.compare(
      configuredPassword,
      existingAdmin.passwordHash,
    );

    if (!passwordMatches) {
      const passwordHash = await bcrypt.hash(configuredPassword, 10);
      await db
        .update(adminUsers)
        .set({ passwordHash })
        .where(eq(adminUsers.id, existingAdmin.id));

      console.log("Admin user password synced from ADMIN_SEED_PASSWORD:", adminEmail);
    } else {
      console.log("Admin user already synced with ADMIN_SEED_PASSWORD:", adminEmail);
    }
  } else {
    console.log("Admin user already exists:", adminEmail);
  }

  const superAdminEmail = env.SUPER_ADMIN_SEED_EMAIL;
  const superAdminPassword = env.SUPER_ADMIN_SEED_PASSWORD;
  const superAdminName = env.SUPER_ADMIN_SEED_NAME ?? "Platform Admin";

  if (superAdminEmail && superAdminPassword) {
    const [existingSuperAdmin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, superAdminEmail))
      .limit(1);

    const passwordHash = await bcrypt.hash(superAdminPassword, 10);

    if (!existingSuperAdmin) {
      await db.insert(adminUsers).values({
        restaurantId: null,
        role: "super_admin",
        email: superAdminEmail,
        passwordHash,
        name: superAdminName,
      });
      console.log("Super admin created:", superAdminEmail);
    } else {
      await db
        .update(adminUsers)
        .set({
          restaurantId: null,
          role: "super_admin",
          passwordHash,
          name: superAdminName,
        })
        .where(eq(adminUsers.id, existingSuperAdmin.id));
      console.log("Super admin synced from env:", superAdminEmail);
    }
  }

  const employeeSeedEmail = env.EMPLOYEE_SEED_EMAIL;
  const employeeSeedPassword = env.EMPLOYEE_SEED_PASSWORD;
  const employeeSeedName = env.EMPLOYEE_SEED_NAME ?? "BFF Employee";

  if (employeeSeedEmail && employeeSeedPassword) {
    const [existingEmployee] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, employeeSeedEmail))
      .limit(1);

    const passwordHash = await bcrypt.hash(employeeSeedPassword, 10);

    if (!existingEmployee) {
      await db.insert(adminUsers).values({
        restaurantId,
        role: "employee",
        email: employeeSeedEmail,
        passwordHash,
        name: employeeSeedName,
      });
      console.log("Employee user created:", employeeSeedEmail);
    } else {
      await db
        .update(adminUsers)
        .set({
          restaurantId,
          role: "employee",
          passwordHash,
          name: employeeSeedName,
        })
        .where(eq(adminUsers.id, existingEmployee.id));
      console.log("Employee user synced from env:", employeeSeedEmail);
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
