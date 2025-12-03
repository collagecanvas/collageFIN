// ===== Collage Canvas Backend (Express + SQLite) =====
require("dotenv").config();

const express  = require("express");
const path     = require("path");
const fs       = require("fs");
const Database = require("better-sqlite3");

// ===== Google Login (GIS token verify) =====
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app  = express();
const PORT = process.env.PORT || 4000;

// ===== PATHS & SETUP =====
const ROOT_DIR   = path.join(__dirname, "..");
const DB_PATH    = path.join(__dirname, "db", "collagecanvas.db");
const OUTPUT_DIR = path.join(__dirname, "collageoutput");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// ===== MIDDLEWARE =====
app.use(express.json({ limit: "15mb" }));

app.use((req, res, next) => {
  // Use the policy you need. 'same-origin' is the most restrictive/secure.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); 
  next();
});

app.use(express.static(ROOT_DIR));
app.use("/collageoutput", express.static(OUTPUT_DIR));


// ===== HELPER FUNCTIONS =====
function listFilesIn(dirName) {
  const abs = path.join(ROOT_DIR, dirName);
  let files = [];
  try {
    files = fs.readdirSync(abs);
  } catch {
    files = [];
  }

  return files
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
    .map((file, index) => ({
      id: `${dirName}_${index}_${file}`,
      label: file,
      src: `/${dirName}/${file}`,
    }));
}

function normalizeImageUrlToFilename(imageUrl) {
  if (!imageUrl) return null;
  let s = String(imageUrl).trim().replace(/\\/g, "/");
  const lastSlash = s.lastIndexOf("/");
  if (lastSlash !== -1) s = s.slice(lastSlash + 1);
  return s || null;
}

function mapCollageRow(row) {
  if (!row) return null;
  const filename = normalizeImageUrlToFilename(row.image_url);
  return {
    id: row.id,
    ownerUserID: row.owner_user_id,
    imageUrl: filename ? `/collageoutput/${filename}` : null,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    likeCount: typeof row.likeCount === "number" ? row.likeCount : 0,
    likedByViewer: !!row.likedByViewer,
  };
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ===== API: /api/auth/signup =====
app.post("/api/auth/signup", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const normEmail = String(email).trim().toLowerCase();

  try {
    const exists = db
      .prepare("SELECT id FROM users WHERE LOWER(email) = ?")
      .get(normEmail);
    if (exists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const now = new Date().toISOString();
    const displayName = normEmail.split("@")[0];
    const randomPart =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const userId = "user_" + randomPart;

    db.prepare(
      `
      INSERT INTO users (
        id, password, email, display_name, avatar_url, bio, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(userId, password, normEmail, displayName, null, null, now, now);

    try {
      db.prepare(
        `
        INSERT INTO auth_accounts (user_id, provider, provider_user_id, created_at)
        VALUES (?, ?, ?, ?)
      `
      ).run(userId, "local", normEmail, now);
    } catch {
      // ignore auth_accounts error
    }

    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    res.status(201).json(mapUserRow(row));
  } catch (err) {
    console.error("[auth/signup] failed", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});


// ===== API: /api/auth/login =====
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const normEmail = String(email).trim().toLowerCase();
    const row = db
      .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
      .get(normEmail);

    if (!row || String(row.password).trim() !== String(password).trim()) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(mapUserRow(row));
  } catch (err) {
    console.error("[auth/login] failed", err);
    res.status(500).json({ error: "Login failed" });
  }
});


// ===== API: /api/assets =====
app.get("/api/assets", (req, res) => {
  res.json({
    backgrounds: listFilesIn("media/background"),
    images: listFilesIn("media/images"),
    thumbnails: listFilesIn("thumbnail"),
  });
});


// ===== API: /api/profile/:id =====
app.get("/api/profile/:id", (req, res) => {
  const userId = req.params.id;

  try {
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!userRow) {
      return res.status(404).json({ error: "User not found" });
    }

    // no more stats — just basic profile info
    res.json({
      user: mapUserRow(userRow),
      lastLogin: userRow.updated_at || userRow.created_at,
      authProvider: "Email",
      status: "Active",
    });
  } catch (err) {
    console.error("[GET /api/profile/:id] failed", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});


// ===== API: /api/profile/:id (PUT) =====
app.put("/api/profile/:id", (req, res) => {
  const userId = req.params.id;
  const body   = req.body || {};



  // accept both snake_case and camelCase just in case
  const displayRaw = body.display_name ?? body.displayName ?? "";
  const emailRaw   = body.email ?? body.newEmail ?? "";
  const bioRaw     = body.bio ?? body.profileBio ?? "";

  try {
    // 1) load existing row
    const existing = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId);

    if (!existing) {
      console.warn("[PUT /api/profile/:id] no user row for id", userId);
      return res.status(404).json({ error: "User not found" });
    }

    // 2) resolve new values (fallback to existing if empty)
    const newDisplayName =
      typeof displayRaw === "string" && displayRaw.trim()
        ? displayRaw.trim()
        : existing.display_name;

    let newEmail =
      typeof emailRaw === "string" && emailRaw.trim()
        ? emailRaw.trim().toLowerCase()
        : existing.email;

    const newBio =
      typeof bioRaw === "string"
        ? bioRaw.trim()
        : existing.bio;

    // 3) email uniqueness check if changed
    if (newEmail && newEmail !== existing.email) {
      const conflict = db
        .prepare(
          "SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?"
        )
        .get(newEmail.toLowerCase(), userId);

      if (conflict) {
        console.warn(
          "[PUT /api/profile/:id] email in use by",
          conflict.id
        );
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    const now = new Date().toISOString();

    // 4) update row
    const result = db.prepare(
      `
      UPDATE users
         SET email        = ?,
             display_name = ?,
             bio          = ?,
             updated_at   = ?
       WHERE id = ?
    `
    ).run(newEmail, newDisplayName, newBio, now, userId);

    if (result.changes === 0) {
      console.warn("[PUT /api/profile/:id] UPDATE affected 0 rows");
      return res.status(404).json({ error: "User not found" });
    }

    const updatedRow = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId);

    console.log("[PUT /api/profile/:id] updated row =", updatedRow);

    res.json(mapUserRow(updatedRow));
  } catch (err) {
    console.error("[PUT /api/profile/:id] failed", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});



// ===== API: /api/collages (GET) =====
app.get("/api/collages", (req, res) => {
  const { visibility, owner, likedBy, viewer } = req.query;

  const params = [];
  let sql = `
    SELECT
      c.*,
      IFNULL((
        SELECT SUM(l.count) FROM likes l WHERE l.collage_id = c.id
      ), 0) AS likeCount,
      CASE
        WHEN ? IS NOT NULL AND EXISTS (
          SELECT 1 FROM likes lv
          WHERE lv.collage_id = c.id
            AND lv.user_id = ?
            AND lv.count > 0
        )
        THEN 1 ELSE 0
      END AS likedByViewer
    FROM collages c
  `;

  params.push(viewer || null);
  params.push(viewer || null);

  const where = [];

  if (visibility) {
    where.push("c.visibility = ?");
    params.push(visibility);
  }

  if (owner) {
    where.push("c.owner_user_id = ?");
    params.push(owner);
  }

  if (likedBy) {
    where.push(`
      EXISTS (
        SELECT 1 FROM likes l2
        WHERE l2.collage_id = c.id
          AND l2.user_id = ?
          AND l2.count > 0
      )
    `);
    params.push(likedBy);
  }

  if (where.length > 0) {
    sql += " WHERE " + where.join(" AND ");
  }

  sql += " ORDER BY c.created_at DESC";

  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(mapCollageRow));
  } catch (err) {
    console.error("[GET /api/collages] failed", err);
    res.status(500).json({ error: "Failed to fetch collages" });
  }
});


// ===== API: /api/collages (POST) =====
app.post("/api/collages", (req, res) => {
  const { imageData, visibility, ownerUserID } = req.body || {};
  if (!imageData || !visibility || !ownerUserID) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const id = "collage_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  const matches = /^data:image\/\w+;base64,(.+)$/.exec(imageData);
  if (!matches) return res.status(400).json({ error: "Invalid image data" });

  const buffer = Buffer.from(matches[1], "base64");
  const filename = id + ".png";
  const filePath = path.join(OUTPUT_DIR, filename);
  const now = new Date().toISOString();

  try {
    fs.writeFileSync(filePath, buffer);
  } catch {
    return res.status(500).json({ error: "Failed to save image" });
  }

  try {
    db.prepare(
      `
      INSERT INTO collages (
        id, owner_user_id, image_url, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(id, ownerUserID, filename, visibility, now, now);

    const row = db.prepare("SELECT * FROM collages WHERE id = ?").get(id);
    res.status(201).json(mapCollageRow(row));
  } catch (err) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
    res.status(500).json({ error: "Failed to save collage metadata" });
  }
});

// ===== API: /api/collages/:id/like (POST) =====
// toggle like/unlike for this user on a collage (count is treated as 0/1 per user).
app.post("/api/collages/:id/like", (req, res) => {
  const collageId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // make sure collage exists
    const exists = db
      .prepare("SELECT 1 FROM collages WHERE id = ?")
      .get(collageId);
    if (!exists) {
      return res.status(404).json({ error: "Collage not found" });
    }

    // current like row (if any) for this user + collage
    const existing = db
      .prepare("SELECT count FROM likes WHERE user_id = ? AND collage_id = ?")
      .get(userId, collageId);

    let newCount;

    if (!existing) {
      // first time → like
      newCount = 1;
      db.prepare(
        "INSERT INTO likes (user_id, collage_id, count) VALUES (?, ?, ?)"
      ).run(userId, collageId, newCount);
    } else {
      // toggle: if >0 → unlike (0), else like (1)
      newCount = existing.count > 0 ? 0 : 1;
      db.prepare(
        "UPDATE likes SET count = ? WHERE user_id = ? AND collage_id = ?"
      ).run(newCount, userId, collageId);
    }

    // total likes for this collage (sum of all users' 0/1)
    const likeRow = db
      .prepare(
        "SELECT IFNULL(SUM(count), 0) AS likeCount FROM likes WHERE collage_id = ?"
      )
      .get(collageId);

    const likeCount =
      likeRow && typeof likeRow.likeCount === "number"
        ? likeRow.likeCount
        : 0;

    const liked = newCount > 0;

    res.json({ liked, likeCount });
  } catch (err) {
    console.error("[POST /api/collages/:id/like] failed", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});



// ===== API: /api/collages/:id (PUT) =====
app.put("/api/collages/:id", (req, res) => {
  const collageId = req.params.id;
  const { visibility } = req.body || {};
  if (!visibility) return res.status(400).json({ error: "Invalid input" });

  const now = new Date().toISOString();

  try {
    const result = db.prepare(
      "UPDATE collages SET visibility = ?, updated_at = ? WHERE id = ?"
    ).run(visibility, now, collageId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const row = db.prepare("SELECT * FROM collages WHERE id = ?").get(collageId);
    res.json(mapCollageRow(row));
  } catch {
    res.status(500).json({ error: "Failed to update collage" });
  }
});


// ===== API: /api/collages/:id (DELETE) =====
app.delete("/api/collages/:id", (req, res) => {
  const collageId = req.params.id;

  try {
    const row = db.prepare("SELECT * FROM collages WHERE id = ?").get(collageId);
    if (!row) return res.status(404).json({ error: "Not found" });

    const filename = normalizeImageUrlToFilename(row.image_url);
    if (filename) {
      const imgPath = path.join(OUTPUT_DIR, filename);
      try {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      } catch {}
    }

    const result = db.prepare("DELETE FROM collages WHERE id = ?").run(collageId);
    if (result.changes === 0) return res.status(404).json({ error: "Not found" });

    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete collage" });
  }
});



// ===== HANDLE BINDER ======

// ===== API: /api/binders (GET) =====
app.get("/api/binders", (req, res) => {
  const { owner, visibility } = req.query;
  const params = [];

  let sql = `
    SELECT
      b.*,
      (
        SELECT COUNT(*)
        FROM binder_collages bc
        WHERE bc.binder_id = b.id
      ) AS page_count
    FROM binders b
  `;

  const where = [];
  if (owner) {
    where.push("b.owner_user_id = ?");
    params.push(owner);
  }
  if (visibility) {
    where.push("b.visibility = ?");
    params.push(visibility);
  }
  if (where.length) {
    sql += " WHERE " + where.join(" AND ");
  }
  sql += " ORDER BY b.created_at DESC";

  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    console.error("[GET /api/binders] failed", err);
    res.status(500).json({ error: "Failed to fetch binders" });
  }
});


// ===== API: /api/binders/:id/pages (GET) =====
app.get("/api/binders/:id/pages", (req, res) => {
  const binderId = req.params.id;
  try {
    const rows = db
      .prepare(
        "SELECT binder_id, collage_id, position FROM binder_collages WHERE binder_id = ? ORDER BY position ASC"
      )
      .all(binderId);
    res.json(rows);
  } catch (err) {
    console.error("[GET /api/binders/:id/pages] failed", err);
    res.status(500).json({ error: "Failed to fetch binder pages" });
  }
});

// ===== API: /api/binders/:id/collages (GET) =====
app.get("/api/binders/:id/collages", (req, res) => {
  const binderId = req.params.id;

  try {
    const rows = db
      .prepare(
        `
        SELECT
          c.*
        FROM binder_collages bc
        JOIN collages c ON c.id = bc.collage_id
        WHERE bc.binder_id = ?
        ORDER BY bc.position ASC
      `
      )
      .all(binderId);
      
    const collages = rows.map(mapCollageRow);
    res.json(collages);
  } catch (err) {
    console.error("[GET /api/binders/:id/collages] failed", err);
    res.status(500).json({ error: "Failed to fetch binder collages" });
  }
});


// ===== API: /api/binders/:id (PUT) =====
app.put("/api/binders/:id", (req, res) => {
  const binderId = req.params.id;

  
  const {
    owner_user_id,
    ownerUserId,
    cover_collage_id,
    coverCollageId,
    visibility,
    pages,
  } = req.body || {};

  const ownerId = ownerUserId || owner_user_id;
  const coverId = coverCollageId || cover_collage_id || null;
  const vis = visibility || "private";

  // minimal validation: need an owner + an array of page IDs
  if (!ownerId || !Array.isArray(pages)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const now = new Date().toISOString();

  try {
    // upsert binder header
    const existing = db
      .prepare("SELECT id FROM binders WHERE id = ?")
      .get(binderId);

    if (existing) {
      db.prepare(
        `
        UPDATE binders
           SET owner_user_id   = ?,
               cover_collage_id = ?,
               visibility       = ?,
               updated_at       = ?
         WHERE id = ?
      `
      ).run(ownerId, coverId, vis, now, binderId);
    } else {
      db.prepare(
        `
        INSERT INTO binders (id, owner_user_id, cover_collage_id, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(binderId, ownerId, coverId, vis, now, now);
    }

    // replace pages mapping
    db.prepare("DELETE FROM binder_collages WHERE binder_id = ?").run(binderId);

    const insertStmt = db.prepare(
      "INSERT INTO binder_collages (binder_id, collage_id, position) VALUES (?, ?, ?)"
    );

    pages.forEach((collageId, index) => {
      insertStmt.run(binderId, collageId, index);
    });

    res.json({
      id: binderId,
      owner_user_id: ownerId,
      cover_collage_id: coverId,
      visibility: vis,
      pages,
    });
  } catch (err) {
    console.error("[PUT /api/binders/:id] failed", err);
    res.status(500).json({ error: "Failed to save binder" });
  }
});

// ===== API: DELETE /api/binders/:id =====
app.delete("/api/binders/:id", (req, res) => {
  const binderId = req.params.id;

  try {
    // delete children first
    db.prepare("DELETE FROM binder_collages WHERE binder_id = ?").run(binderId);

    // delete binder header
    db.prepare("DELETE FROM binders WHERE id = ?").run(binderId);

    res.json({ success: true, id: binderId });
  } catch (err) {
    console.error("[DELETE /api/binders/:id] failed", err);
    res.status(500).json({ error: "Failed to delete binder" });
  }
});


// ===== FALLBACK (Express 5-safe) =====
app.use((req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});


// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`Collage Canvas backend listening on http://localhost:${PORT}`);
});



// ===== GOOGLE ID TOKEN LOGIN =====

// API: /api/auth/google
app.post("/api/auth/google", async (req, res) => {
  const { credential, mode } = req.body || {}; 
  if (!credential) {
    return res.status(400).json({ error: "Missing credential" });
  }

  try {
    // 1) Verify Google ID token from client
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleSub = payload.sub;
    const email     = payload.email || null;
    const name      = payload.name  || email || "Google user";
    const picture   = payload.picture || null;

    if (!googleSub) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    // 2) Find existing user by provider_user_id
    let row = db.prepare(`
      SELECT u.*
      FROM auth_accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.provider = 'google'
        AND a.provider_user_id = ?
    `).get(googleSub);

    // 3) If not exist → create user + auth account
    if (!row) {
      const userId = "user_google_" + googleSub;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, email, display_name, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email, name, picture, now, now);

      db.prepare(`
        INSERT INTO auth_accounts (user_id, provider, provider_user_id, created_at)
        VALUES (?, 'google', ?, ?)
      `).run(userId, googleSub, now);

      row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    }

    // 4) Return user JSON to front end
    const user = mapUserRow(row);
    return res.json({ user });

  } catch (err) {
    console.error("[POST /api/auth/google] failed", err);
    return res.status(500).json({ error: "Google login failed" });
  }
});
