import { put } from "@vercel/blob";
import { body, json, requireAuth } from "./_lib.js";

const MAX_BYTES = 3 * 1024 * 1024; // photos are resized in the browser first
const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
    if (!(await requireAuth(req, res))) return;

    var dataUrl = String(body(req).dataUrl || "");
    var match = dataUrl.match(/^data:([a-z/+.-]+);base64,(.+)$/i);
    if (!match) return json(res, 400, { error: "That photo couldn't be read." });

    var mime = match[1].toLowerCase();
    var ext = TYPES[mime];
    if (!ext) return json(res, 400, { error: "Use a JPG, PNG, WEBP or GIF image." });

    var buffer = Buffer.from(match[2], "base64");
    if (!buffer.length) return json(res, 400, { error: "That photo couldn't be read." });
    if (buffer.length > MAX_BYTES) return json(res, 413, { error: "That photo is too large." });

    var blob = await put("items/photo." + ext, buffer, {
      access: "public",
      contentType: mime,
      addRandomSuffix: true,
    });

    return json(res, 200, { url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.log("[v0] upload error:", err && err.message);
    return json(res, 500, { error: "Couldn't upload that photo. Please try again." });
  }
}
