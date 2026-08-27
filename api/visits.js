import { json, sql } from "./_lib.js";

const COOKIE = "yge_visited";
const WINDOW_HOURS = 24; // one browser counts once per day

function alreadyCounted(req) {
  var header = req.headers.cookie || "";
  return new RegExp("(?:^|;\\s*)" + COOKIE + "=1").test(header);
}

function markCounted() {
  return (
    COOKIE +
    "=1; Secure; SameSite=None; Path=/; Max-Age=" +
    WINDOW_HOURS * 60 * 60
  );
}

export default async function handler(req, res) {
  try {
    // Just read the number without adding to it.
    if (req.method === "GET") {
      var rows = await sql`select total from visits where id = 1`;
      return json(res, 200, { total: rows.length ? Number(rows[0].total) : 0 });
    }

    if (req.method === "POST") {
      // A repeat view from the same browser shouldn't inflate the count.
      if (alreadyCounted(req)) {
        var current = await sql`select total from visits where id = 1`;
        return json(res, 200, {
          total: current.length ? Number(current[0].total) : 0,
          counted: false,
        });
      }

      // Atomic bump, so two people landing at once can't overwrite each other.
      var bumped = await sql`
        insert into visits (id, total) values (1, 1)
        on conflict (id) do update set total = visits.total + 1
        returning total
      `;

      res.setHeader("Set-Cookie", markCounted());
      return json(res, 200, { total: Number(bumped[0].total), counted: true });
    }

    return json(res, 405, { error: "Method not allowed." });
  } catch (err) {
    console.log("[v0] visits error:", err && err.message);
    return json(res, 500, { error: "Couldn't reach the visit counter." });
  }
}
