import * as api from "./api-client.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const restaurantName = `Hermes Onboarding ${suffix}`;
  const ownerEmail = `owner+${suffix}@example.com`;
  const ownerPassword = `Welcome-${suffix}`;

  const signupPayload = {
    owner: {
      name: `Owner ${suffix}`,
      email: ownerEmail,
      password: ownerPassword,
    },
    restaurant: {
      name: restaurantName,
      cuisineType: "Mediterranean",
      phone: `+972509${suffix.slice(-4).padStart(4, "0")}`,
      address: `Test Street ${suffix}, Ra'anana`,
      package: "starter" as const,
      locale: "he" as const,
      timezone: "Asia/Jerusalem",
      operatingHours: {
        sun: { open: "17:00", close: "23:00" },
        mon: { open: "17:00", close: "23:00" },
        tue: { open: "17:00", close: "23:00" },
        wed: { open: "17:00", close: "23:00" },
        thu: { open: "17:00", close: "23:00" },
        fri: { open: "12:00", close: "15:00" },
        sat: null,
      },
    },
    tables: [
      { name: "T1", minSeats: 2, maxSeats: 4, zone: "main" },
      { name: "Bar 1", minSeats: 1, maxSeats: 2, zone: "bar" },
    ],
  };

  await api.healthCheck();

  const signup = await api.signupRestaurant(signupPayload);
  const createdRestaurant = signup.restaurant as { id?: string; name?: string } | null;

  assert(typeof signup.token === "string" && signup.token.length > 0, "Signup did not return a token");
  assert(signup.role === "admin", `Expected admin role from signup, got ${String(signup.role)}`);
  assert(createdRestaurant?.id, "Signup did not return a restaurant id");
  assert(createdRestaurant?.name === restaurantName, `Expected restaurant name ${restaurantName}, got ${String(createdRestaurant?.name)}`);

  const restaurantId = createdRestaurant.id;
  const ownerToken = signup.token as string;

  const ownerTablesResponse = await api.listTablesWithToken(restaurantId, ownerToken);
  const ownerTables = (ownerTablesResponse.tables as Array<{ name?: string }> | undefined) ?? [];
  assert(ownerTables.length === 2, `Expected 2 initial tables, got ${ownerTables.length}`);
  assert(ownerTables.some((table) => table.name === "T1"), "Initial table T1 missing");
  assert(ownerTables.some((table) => table.name === "Bar 1"), "Initial table Bar 1 missing");

  const ownerLogin = await api.loginWithCredentials(ownerEmail, ownerPassword);
  const loginRestaurant = ownerLogin.restaurant as { id?: string } | null;
  assert(ownerLogin.role === "admin", `Expected admin role from login, got ${String(ownerLogin.role)}`);
  assert(loginRestaurant?.id === restaurantId, "Owner login did not return the newly created restaurant");

  const publicRestaurant = await api.getRestaurant(restaurantId);
  assert(publicRestaurant.name === restaurantName, "Public restaurant lookup returned the wrong restaurant name");
  assert(typeof publicRestaurant.slug === "string" && publicRestaurant.slug.startsWith("hermes-onboarding"), `Unexpected slug: ${String(publicRestaurant.slug)}`);

  const adminRestaurants = await api.listAdminRestaurants();
  assert(Array.isArray(adminRestaurants), "Admin restaurant list did not return an array");
  assert(
    adminRestaurants.some(
      (restaurant) => typeof restaurant === "object" && restaurant !== null && "id" in restaurant && restaurant.id === restaurantId,
    ),
    "Super-admin restaurant list did not include the new tenant",
  );

  console.log(`Self-serve onboarding OK: ${restaurantName} (${restaurantId})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
