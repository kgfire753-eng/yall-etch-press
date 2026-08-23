import { body, cleanFields, json, requireAuth, sql, toItem } from "./_lib.js";

export default async function handler(req, res) {
  try {
    // Anyone can see the shop
    if (req.method === "GET") {
      var rows = await sql`
        select id, name, price, description, photo_url, sold, created_at
        from items
        order by created_at desc
      `;
      return json(res, 200, { items: rows.map(toItem) });
    }

    if (req.method === "POST") {
      if (!(await requireAuth(req, res))) return;

      var input = body(req);
      var checked = cleanFields(input);
      if (checked.error) return json(res, 400, { error: checked.error });
      var v = checked.value;

      var photoUrl = input.photoUrl ? String(input.photoUrl) : null;
      var photoPath = input.photoPathname ? String(input.photoPathname) : null;

      var created = await sql`
        insert into items (name, price, description, photo_url, photo_pathname, sold)
        values (${v.name}, ${v.price}, ${v.desc}, ${photoUrl}, ${photoPath}, ${v.sold})
        returning id, name, price, description, photo_url, sold, created_at
      `;
      return json(res, 201, { item: toItem(created[0]) });
    }

    return json(res, 405, { error: "Method not allowed." });
  } catch (err) {
    console.log("[v0] items error:", err && err.message);
    return json(res, 500, { error: "Couldn't reach the shop database. Please try again." });
  }
}
