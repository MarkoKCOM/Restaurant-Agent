import { createHmac, randomUUID } from "node:crypto";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createSignedSuperAdminToken() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return "";

  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url({
    id: randomUUID(),
    email: "debug-cli-super-admin@openseat.local",
    restaurantId: null,
    role: "super_admin",
    iat: now,
    exp: now + 60 * 10,
  });
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}
