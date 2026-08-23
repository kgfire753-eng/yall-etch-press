import { del } from "@vercel/blob";
import { body, cleanFields, json, requireAuth, sql, toItem } from "../_lib.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Photos live in Blob storage, so removing a row means removing its file too.
async function dropPhoto(pathname) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch (err) {
    console.log("[v0] blob delete failed:", err && err.message);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "PATCH" && req.method !== "DELETE") {
      return json(res, 405, { error: "Method not allowed." });
    }
    if (!(await requireAuth(req, res))) return;

    var id = String(req.query.id || "");
    if (!UUID.test(id)) return json(res, 400, { error: "That item id isn't valid." });

    var existing = await sql`select photo_pathname from items where id = ${id}`;
    if (!existing.length) return json(res, 404, { error: "That item no longer exists." });
    var oldPath = existing[0].photo_pathname;

    if (req.method === "DELETE") {
      await sql`delete from items where id = ${id}`;
      await dropPhoto(oldPath);
      return json(res, 200, { ok: true });
    }

    var input = body(req);

    // Quick toggle: flip the SOLD flag without resubmitting the whole item.
    if (input.sold !== undefined && input.name === undefined) {
      var flipped = await sql`
        update items set sold = ${input.sold === true} where id = ${id}
        returning id, name, price, description, photo_url, sold, created_at
      `;
      return json(res, 200, { item: toItem(flipped[0]) });
    }

    var checked = cleanFields(input);
    if (checked.error) return json(res, 400, { error: checked.error });
    var v = checked.value;

    // photo omitted = keep as-is, "" = remove, new url = replace
    var keepPhoto = input.photoUrl === undefined;
    var photoUrl = keepPhoto ? undefined : input.photoUrl ? String(input.photoUrl) : null;
    var photoPath = keepPhoto
      ? undefined
      : input.photoPathname
        ? String(input.photoPathname)
        : null;

    var updated;
    if (keepPhoto) {
      updated = await sql`
        update items
        set name = ${v.name}, price = ${v.price}, description = ${v.desc}, sold = ${v.sold}
        where id = ${id}
        returning id, name, price, description, photo_url, sold, created_at
      `;
    } else {
      updated = await sql`
        update items
        set name = ${v.name}, price = ${v.price}, description = ${v.desc}, sold = ${v.sold},
            photo_url = ${photoUrl}, photo_pathname = ${photoPath}
        where id = ${id}
        returning id, name, price, description, photo_url, sold, created_at
      `;
      if (oldPath && oldPath !== photoPath) await dropPhoto(oldPath);
    }

    return json(res, 200, { item: toItem(updated[0]) });
  } catch (err) {
    console.log("[v0] item update error:", err && err.message);
    return json(res, 500, { error: "Couldn't save that change. Please try again." });
  }
}
