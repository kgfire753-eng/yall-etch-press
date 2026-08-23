import {
  body,
  checkPassword,
  clearSessionCookie,
  hashPassword,
  isAuthed,
  json,
  makeSessionCookie,
  saveHash,
} from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return json(res, 200, { authed: await isAuthed(req) });
    }

    // Log in
    if (req.method === "POST") {
      var password = body(req).password;
      if (!(await checkPassword(password))) {
        return json(res, 401, { error: "Wrong password. Try again." });
      }
      res.setHeader("Set-Cookie", await makeSessionCookie());
      return json(res, 200, { authed: true });
    }

    // Change password (must already be logged in)
    if (req.method === "PUT") {
      if (!(await isAuthed(req))) {
        return json(res, 401, { error: "Please unlock with your password first." });
      }
      var data = body(req);
      if (!(await checkPassword(data.current))) {
        return json(res, 401, { error: "That current password isn't right." });
      }
      var next = String(data.next == null ? "" : data.next);
      if (next.length < 8) {
        return json(res, 400, { error: "Use at least 8 characters." });
      }
      await saveHash(hashPassword(next));
      // Changing the password invalidates the old signing key, so re-issue.
      res.setHeader("Set-Cookie", await makeSessionCookie());
      return json(res, 200, { authed: true });
    }

    // Log out
    if (req.method === "DELETE") {
      res.setHeader("Set-Cookie", clearSessionCookie());
      return json(res, 200, { authed: false });
    }

    return json(res, 405, { error: "Method not allowed." });
  } catch (err) {
    console.log("[v0] session error:", err && err.message);
    return json(res, 500, { error: "Something went wrong. Please try again." });
  }
}
