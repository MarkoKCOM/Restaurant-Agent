import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const eqIndex = token.indexOf("=");
    if (eqIndex >= 0) {
      args[token.slice(2, eqIndex)] = token.slice(eqIndex + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

function asString(value, fallback) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

const args = parseArgs(process.argv.slice(2));

const sourceSlug = asString(args["source-slug"], process.env.PILOT_SOURCE_SLUG ?? "bff-raanana");
const targetSlug = asString(args["target-slug"], process.env.PILOT_TARGET_SLUG ?? "bff-v2");
const targetName = asString(args["target-name"], process.env.PILOT_TARGET_NAME ?? "BFF v2");
const adminEmail = asString(args["admin-email"], process.env.PILOT_ADMIN_EMAIL ?? "admin+bffv2@bff.co.il");
const adminPassword = asString(args["admin-password"], process.env.PILOT_ADMIN_PASSWORD ?? "BFFv2Admin!2026");
const adminName = asString(args["admin-name"], process.env.PILOT_ADMIN_NAME ?? "BFF v2 Admin");
const superAdminEmail = asString(args["super-admin-email"], process.env.PILOT_SUPER_ADMIN_EMAIL ?? "milhemsione@gmail.com");
const superAdminPassword = asString(args["super-admin-password"], process.env.PILOT_SUPER_ADMIN_PASSWORD ?? "OpenSeatSuper!2026");
const superAdminName = asString(args["super-admin-name"], process.env.PILOT_SUPER_ADMIN_NAME ?? "Sione Super Admin");
const resetData = Boolean(args["reset-data"]);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Check /home/jake/openseat/.env");
}

const sql = postgres(databaseUrl, { max: 1 });

async function upsertAdmin(tx, { email, password, name, role, restaurantId }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await tx`
    select id
    from admin_users
    where email = ${email}
    limit 1
  `;

  if (existing.length > 0) {
    await tx`
      update admin_users
      set restaurant_id = ${restaurantId},
          role = ${role},
          password_hash = ${passwordHash},
          name = ${name}
      where email = ${email}
    `;
    return { email, action: "updated", role, restaurantId };
  }

  await tx`
    insert into admin_users (restaurant_id, role, email, password_hash, name)
    values (${restaurantId}, ${role}, ${email}, ${passwordHash}, ${name})
  `;

  return { email, action: "created", role, restaurantId };
}

async function clearSandboxData(tx, restaurantId) {
  await tx`
    delete from challenge_progress
    where guest_id in (
      select id from guests where restaurant_id = ${restaurantId}
    )
    or challenge_id in (
      select id from challenges where restaurant_id = ${restaurantId}
    )
  `;

  await tx`delete from reward_claims where restaurant_id = ${restaurantId}`;
  await tx`delete from loyalty_transactions where restaurant_id = ${restaurantId}`;
  await tx`delete from visit_logs where restaurant_id = ${restaurantId}`;
  await tx`delete from engagement_jobs where restaurant_id = ${restaurantId}`;
  await tx`delete from campaigns where restaurant_id = ${restaurantId}`;
  await tx`delete from challenges where restaurant_id = ${restaurantId}`;
  await tx`delete from rewards where restaurant_id = ${restaurantId}`;
  await tx`delete from conversations where restaurant_id = ${restaurantId}`;
  await tx`delete from waitlist where restaurant_id = ${restaurantId}`;
  await tx`delete from reservations where restaurant_id = ${restaurantId}`;
  await tx`delete from guests where restaurant_id = ${restaurantId}`;
}

async function cloneTablesIfMissing(tx, sourceRestaurantId, targetRestaurantId) {
  const existing = await tx`
    select id from tables where restaurant_id = ${targetRestaurantId}
  `;

  if (existing.length > 0) {
    return { copied: 0, skipped: true };
  }

  const sourceTables = await tx`
    select id, name, min_seats, max_seats, zone, combinable_with, is_active
    from tables
    where restaurant_id = ${sourceRestaurantId}
    order by name asc
  `;

  const idMap = new Map(sourceTables.map((table) => [table.id, crypto.randomUUID()]));

  for (const table of sourceTables) {
    const combinableWith = Array.isArray(table.combinable_with)
      ? table.combinable_with.map((id) => idMap.get(id)).filter(Boolean)
      : [];

    await tx`
      insert into tables (id, restaurant_id, name, min_seats, max_seats, zone, combinable_with, is_active)
      values (
        ${idMap.get(table.id)},
        ${targetRestaurantId},
        ${table.name},
        ${table.min_seats},
        ${table.max_seats},
        ${table.zone ?? "main"},
        ${combinableWith},
        ${table.is_active}
      )
    `;
  }

  return { copied: sourceTables.length, skipped: false };
}

async function main() {
  const result = await sql.begin(async (tx) => {
    const sourceRows = await tx`
      select *
      from restaurants
      where slug = ${sourceSlug}
      limit 1
    `;

    const source = sourceRows[0];
    if (!source) {
      throw new Error(`Source restaurant not found for slug: ${sourceSlug}`);
    }

    const targetRows = await tx`
      select *
      from restaurants
      where slug = ${targetSlug}
      limit 1
    `;

    const sourceWidgetConfig = source.widget_config && typeof source.widget_config === "object"
      ? source.widget_config
      : {};

    const widgetConfig = {
      ...sourceWidgetConfig,
      welcomeText: `הזמנת שולחן ל-${targetName}`,
    };

    const descriptionBase = source.description
      ? `${source.description} Sandbox tenant for onboarding and dashboard switching.`
      : "Sandbox tenant for onboarding and dashboard switching.";

    let targetId;
    let restaurantAction;

    if (targetRows[0]) {
      targetId = targetRows[0].id;
      restaurantAction = "updated";

      await tx`
        update restaurants
        set name = ${targetName},
            description = ${descriptionBase},
            cuisine_type = ${source.cuisine_type},
            address = ${source.address},
            phone = ${source.phone},
            email = ${source.email},
            website = ${source.website},
            timezone = ${source.timezone},
            locale = ${source.locale},
            operating_hours = ${source.operating_hours},
            special_dates = ${source.special_dates},
            agent_config = ${source.agent_config},
            package = ${source.package},
            whatsapp_number = ${source.whatsapp_number},
            owner_phone = ${source.owner_phone},
            owner_whatsapp = ${source.owner_whatsapp},
            google_place_id = null,
            widget_config = ${widgetConfig},
            dashboard_config = ${source.dashboard_config},
            updated_at = now()
        where id = ${targetId}
      `;
    } else {
      const inserted = await tx`
        insert into restaurants (
          name,
          slug,
          description,
          cuisine_type,
          address,
          phone,
          email,
          website,
          timezone,
          locale,
          operating_hours,
          special_dates,
          agent_config,
          package,
          whatsapp_number,
          owner_phone,
          owner_whatsapp,
          google_place_id,
          widget_config,
          dashboard_config
        )
        values (
          ${targetName},
          ${targetSlug},
          ${descriptionBase},
          ${source.cuisine_type},
          ${source.address},
          ${source.phone},
          ${source.email},
          ${source.website},
          ${source.timezone},
          ${source.locale},
          ${source.operating_hours},
          ${source.special_dates},
          ${source.agent_config},
          ${source.package},
          ${source.whatsapp_number},
          ${source.owner_phone},
          ${source.owner_whatsapp},
          ${null},
          ${widgetConfig},
          ${source.dashboard_config}
        )
        returning id
      `;

      targetId = inserted[0].id;
      restaurantAction = "created";
    }

    if (resetData) {
      await clearSandboxData(tx, targetId);
    }

    const tableClone = await cloneTablesIfMissing(tx, source.id, targetId);

    const tenantAdmin = await upsertAdmin(tx, {
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: "admin",
      restaurantId: targetId,
    });

    const superAdmin = await upsertAdmin(tx, {
      email: superAdminEmail,
      password: superAdminPassword,
      name: superAdminName,
      role: "super_admin",
      restaurantId: null,
    });

    const counts = {
      guests: Number((await tx`select count(*)::int as count from guests where restaurant_id = ${targetId}`)[0].count),
      reservations: Number((await tx`select count(*)::int as count from reservations where restaurant_id = ${targetId}`)[0].count),
      rewards: Number((await tx`select count(*)::int as count from rewards where restaurant_id = ${targetId}`)[0].count),
      waitlist: Number((await tx`select count(*)::int as count from waitlist where restaurant_id = ${targetId}`)[0].count),
      tables: Number((await tx`select count(*)::int as count from tables where restaurant_id = ${targetId}`)[0].count),
    };

    return {
      source: { id: source.id, slug: source.slug, name: source.name },
      target: { id: targetId, slug: targetSlug, name: targetName, action: restaurantAction },
      resetData,
      tableClone,
      tenantAdmin,
      superAdmin,
      counts,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

try {
  await main();
} finally {
  await sql.end({ timeout: 5 });
}
