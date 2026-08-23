import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

export const sql = neon(process.env.DATABASE_URL);

const COOKIE = "yge_session";
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
const HASH_KEY = "admin_password_hash";

/* ---------- password hashing (scrypt) ---------- */

export function hashPassword(password, salt) {
  var useSalt = salt || crypto.randomBytes(16).toString("hex");
  var derived = crypto.scryptSync(String(password), useSalt, 64).toString("hex");
  return useSalt + ":" + derived;
}

function samePassword(password, stored) {
  if (!stored || stored.indexOf(":") === -1) return false;
  var salt = stored.split(":")[0];
  var candidate = Buffer.from(hashPassword(password, salt));
  var expected = Buffer.from(stored);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/* ---------- stored password ---------- */

// The password lives in the settings table so it can be changed from the site.
// ADMIN_PASSWORD seeds it on first login, then the database copy wins.
async function storedHash() {
  var rows = await sql`select value from settings where key = ${HASH_KEY}`;
  return rows.length ? rows[0].value : "";
}

export async function saveHash(hash) {
  await sql`
    insert into settings (key, value) values (${HASH_KEY}, ${hash})
    on conflict (key) do update set value = excluded.value
  `;
}

export async function checkPassword(password) {
  if (!password) return false;
  var current = await storedHash();

  if (!current) {
    var seed = process.env.ADMIN_PASSWORD;
    if (!seed || password !== seed) return false;
    await saveHash(hashPassword(password)); // remember it for next time
    return true;
  }

  return samePassword(password, current);
}

/* ---------- sessions (signed httpOnly cookie) ---------- */

// Signing key is tied to the current password, so changing the password
// automatically logs out every existing session.
async function signingKey() {
  var current = await storedHash();
  return crypto
    .createHash("sha256")
    .update(String(process.env.ADMIN_PASSWORD || "") + "|" + current)
    .digest();
}

async function sign(value) {
  var key = await signingKey();
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

export async function makeSessionCookie() {
  var expires = String(Date.now() + SESSION_MS);
  var token = expires + "." + (await sign(expires));
  return (
    COOKIE +
    "=" +
    token +
    "; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=" +
    Math.floor(SESSION_MS / 1000)
  );
}

export function clearSessionCookie() {
  return COOKIE + "=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0";
}

export async function isAuthed(req) {
  var header = req.headers.cookie || "";
  var match = header.match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!match) return false;

  var parts = decodeURIComponent(match[1]).split(".");
  if (parts.length !== 2) return false;

  var expires = parts[0];
  var provided = parts[1];
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;

  var expected = await sign(expires);
  var a = Buffer.from(provided);
  var b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------- request helpers ---------- */

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

export async function requireAuth(req, res) {
  if (await isAuthed(req)) return true;
  json(res, 401, { error: "Please unlock with your password first." });
  return false;
}

export function body(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

/* ---------- item shaping / validation ---------- */

export function toItem(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    desc: row.description || "",
    photo: row.photo_url || "",
    sold: row.sold === true,
    created: row.created_at,
  };
}

// Returns { value } on success or { error } on failure.
export function cleanFields(input) {
  var name = String(input.name == null ? "" : input.name).trim();
  if (!name) return { error: "Please give the item a name." };
  if (name.length > 120) return { error: "Name is too long (120 characters max)." };

  var price = Number(input.price);
  if (!isFinite(price) || price < 0) return { error: "Enter a price of 0 or more." };
  if (price > 999999) return { error: "That price is too high." };

  var desc = String(input.desc == null ? "" : input.desc).trim();
  if (desc.length > 2000) return { error: "Description is too long (2000 characters max)." };

  return { value: { name: name, price: price.toFixed(2), desc: desc, sold: input.sold === true } };
}
