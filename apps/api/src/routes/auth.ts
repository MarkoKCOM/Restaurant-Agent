import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  DASHBOARD_ACCESS_BY_ROLE,
  DEFAULT_FEATURES,
  DEFAULT_VISIBLE_PAGES,
  selfServeSignupSchema,
  type DashboardRole,
} from "@openseat/domain";
import { z } from "zod";
import { db } from "../db/index.js";
import { adminUsers, restaurants, tables } from "../db/schema.js";
import { env } from "../env.js";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
}).strict();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toDashboardRole(role: string): DashboardRole | null {
  return role === "admin" || role === "employee" || role === "super_admin" ? role : null;
}

function signAuthToken(user: typeof adminUsers.$inferSelect, role: DashboardRole): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      restaurantId: user.restaurantId ?? null,
      role,
    },
    env.JWT_SECRET,
    { expiresIn: "24h" },
  );
}

async function loadRestaurant(restaurantId: string | null) {
  if (!restaurantId) {
    return null;
  }

  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  return restaurant ?? null;
}

async function buildAuthResponse(
  user: typeof adminUsers.$inferSelect,
  restaurantOverride?: typeof restaurants.$inferSelect | null,
) {
  const role = toDashboardRole(user.role);
  if (!role) {
    throw new Error("Invalid role configuration");
  }

  const restaurant = restaurantOverride === undefined
    ? await loadRestaurant(user.restaurantId ?? null)
    : restaurantOverride;

  return {
    token: signAuthToken(user, role),
    role,
    restaurant: restaurant
      ? { id: restaurant.id, name: restaurant.name }
      : null,
    dashboardAccess: DASHBOARD_ACCESS_BY_ROLE[role],
  };
}

function slugifyRestaurantName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "restaurant";
}

type RestaurantSlugLookup = Pick<typeof db, "select">;

async function generateUniqueRestaurantSlug(
  tx: RestaurantSlugLookup,
  restaurantName: string,
): Promise<string> {
  const baseSlug = slugifyRestaurantName(restaurantName);
  const existingRows = await tx.select({ slug: restaurants.slug }).from(restaurants);
  const existingSlugs = new Set(existingRows.map((row) => row.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function buildWidgetConfig(restaurantName: string, locale: "he" | "en") {
  return {
    primaryColor: "#d97706",
    welcomeText:
      locale === "he"
        ? `הזמנת שולחן ל-${restaurantName}`
        : `Book a table at ${restaurantName}`,
  };
}

function buildDashboardConfig(locale: "he" | "en") {
  return {
    language: locale,
    visiblePages: [...DEFAULT_VISIBLE_PAGES],
    features: { ...DEFAULT_FEATURES },
  };
}

function getErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const parsedBody = loginSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const email = normalizeEmail(parsedBody.data.email);
    const { password } = parsedBody.data;

    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    try {
      return await buildAuthResponse(user);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      request.log.error({ error }, "Failed to build login auth response");
      return reply.status(500).send({ error: message === "Invalid role configuration" ? message : "Unable to log in" });
    }
  });

  app.post("/signup", async (request, reply) => {
    const parsedBody = selfServeSignupSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid signup payload",
        details: parsedBody.error.flatten(),
      });
    }

    const { owner, restaurant, tables: initialTables } = parsedBody.data;
    const email = normalizeEmail(owner.email);

    const [existingUser] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (existingUser) {
      return reply.status(409).send({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(owner.password, 10);

    try {
      const { createdUser, createdRestaurant } = await db.transaction(async (tx) => {
        const slug = await generateUniqueRestaurantSlug(tx, restaurant.name);

        const [createdRestaurant] = await tx
          .insert(restaurants)
          .values({
            name: restaurant.name,
            slug,
            cuisineType: restaurant.cuisineType,
            address: restaurant.address,
            phone: restaurant.phone,
            email,
            timezone: restaurant.timezone,
            locale: restaurant.locale,
            operatingHours: restaurant.operatingHours,
            package: restaurant.package,
            widgetConfig: buildWidgetConfig(restaurant.name, restaurant.locale),
            dashboardConfig: buildDashboardConfig(restaurant.locale),
          })
          .returning();

        if (!createdRestaurant) {
          throw new Error("Failed to create restaurant");
        }

        const [createdUser] = await tx
          .insert(adminUsers)
          .values({
            restaurantId: createdRestaurant.id,
            role: "admin",
            email,
            passwordHash,
            name: owner.name,
          })
          .returning();

        if (!createdUser) {
          throw new Error("Failed to create admin user");
        }

        await tx.insert(tables).values(
          initialTables.map((table) => ({
            restaurantId: createdRestaurant.id,
            name: table.name,
            minSeats: table.minSeats,
            maxSeats: table.maxSeats,
            zone: table.zone,
            combinableWith: [],
            isActive: true,
          })),
        );

        return { createdUser, createdRestaurant };
      });

      reply.code(201);
      return buildAuthResponse(createdUser, createdRestaurant);
    } catch (error: unknown) {
      const errorCode = getErrorCode(error);
      request.log.error({ error }, "Failed to complete self-serve signup");

      if (errorCode === "23505") {
        return reply.status(409).send({ error: "Signup conflicted with an existing account or restaurant. Please try again." });
      }

      return reply.status(500).send({ error: "Unable to complete signup" });
    }
  });
}
