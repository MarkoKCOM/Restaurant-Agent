import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminUsers, restaurants } from "../db/schema.js";
import { env } from "../env.js";

export async function authRoutes(app: FastifyInstance) {
  // POST /login
  app.post("/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

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

    let restaurant = null;
    if (user.restaurantId) {
      const [row] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, user.restaurantId))
        .limit(1);
      restaurant = row ?? null;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        restaurantId: user.restaurantId ?? null,
        role: user.role ?? "admin",
      },
      env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return {
      token,
      role: user.role ?? "admin",
      restaurant: restaurant
        ? { id: restaurant.id, name: restaurant.name }
        : null,
    };
  });
}
