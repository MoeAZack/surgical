import express from "express";
import path from "path";
import fs from "fs/promises";
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), "db.json");

// --- Auth config ---------------------------------------------------------
const MASTER_KEY = process.env.MASTER_KEY || "MoeAZack";
const SESSION_SECRET = process.env.SESSION_SECRET || `surgical-sess::${MASTER_KEY}`;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CRON_SECRET = process.env.CRON_SECRET || "";

const MAX_AUDIT_ENTRIES = 1000;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024; // 6MB raw per photo

// Default lists
const DEFAULT_SURGEONS = ["Dr. A", "Dr. B"];
const DEFAULT_PROCEDURES = [
  "Liposuction", "Abdominoplasty", "Breast Augmentation", "Breast Reduction", "Mastopexy",
  "Augmentation-Mastopexy", "Gynecomastia Correction", "Fat Transfer / BBL", "Brachioplasty",
  "Thigh Lift", "Rhinoplasty", "Blepharoplasty", "Facelift / Neck Lift", "Otoplasty", "Brow Lift",
  "Chin Augmentation", "Lip Lift", "Fat Grafting (Face)", "Body Lift", "Mommy Makeover", "Labiaplasty",
  "Surgical Scar Revision", "Basal Cell Carcinoma Excision", "Melanoma Excision", "Skin Grafting",
  "Local Flap Reconstruction", "Carpal Tunnel Release", "Trigger Finger Release",
  "Breast Reconstruction (Implant)", "Breast Reconstruction (Flap)", "Panniculectomy", "Septoplasty",
  "Mentoplasty", "Other"
];
const DEFAULT_CHECKLIST = [
  "Consent signed", "Pre-op photos taken", "Pre-op labs reviewed", "Prophylactic antibiotics", "Post-op instructions given"
];
const DEFAULT_COMPLICATIONS = [
  "Seroma", "Hematoma", "Infection", "Wound Dehiscence", "Capsular Contracture", "Implant Rupture/Malposition",
  "Fat Necrosis", "Skin/Flap Necrosis", "Asymmetry/Contour Irregularity", "Hypertrophic Scar/Keloid", "DVT/PE",
  "Fat Embolism", "Epidermolysis", "Suture Spit", "Delayed Wound Healing", "Allergic Reaction (Tape/Suture/Prep)",
  "Paresthesia / Nerve Injury", "Chronic Pain", "Areolar/Nipple Sensation Loss", "Nipple-Areola Complex Necrosis",
  "Stretching of Scar", "Hyperpigmentation / Discoloration", "Pneumothorax", "Pruritus (Severe)",
  "Anesthesia Complication", "Surgical Site Bleeding", "Syncope / Vasovagal", "Other"
];
const FU_STATUS = ["—", "Good", "Issue noted", "Concern — review", "Missed"];
const OUTCOMES = ["Ongoing", "Success", "Failure", "Recurrence", "Reoperation", "Lost to follow-up", "Deceased"];
const APPT_TYPES = ["Wound check", "Drain removal", "Suture removal", "Dressing change", "1-week review", "Consultation", "Other"];
const APPT_STATUS = ["Scheduled", "Done", "No-show", "Cancelled"];

const DEFAULT_CONFIG = { DrainAlertDays: 7, FU1: 1, FU2: 3, FU3: 6, FU4: 12, practiceName: "", defaultRowsPerPage: 10 };

interface Database {
  operations: any[];
  drains: any[];
  complications: any[];
  followup: any[];
  checks: any[];
  appointments: any[];
  photos: any[];
  lists: any;
  config: any;
  user: string;
  audit?: any[];
  masterKeys?: any[];
}

const INITIAL_DB: Database = {
  operations: [], drains: [], complications: [], followup: [], checks: [], appointments: [], photos: [],
  lists: {
    surgeons: DEFAULT_SURGEONS, procedures: DEFAULT_PROCEDURES, checklistItems: DEFAULT_CHECKLIST,
    complications: DEFAULT_COMPLICATIONS, fuStatus: FU_STATUS, outcomes: OUTCOMES, apptTypes: APPT_TYPES, apptStatus: APPT_STATUS
  },
  config: DEFAULT_CONFIG,
  user: "moezaka@gmail.com",
  masterKeys: []
};

function newId(): string {
  return randomUUID();
}

function toList(arr: any, legacy: any): string[] {
  if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
  if (legacy != null && String(legacy).trim()) return [String(legacy).trim()];
  return [];
}

// --- Auth helpers --------------------------------------------------------
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signToken(payload: Record<string, any>): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token: string | undefined): Record<string, any> | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function hashKey(salt: string, key: string): string {
  return createHmac("sha256", salt).update(key).digest("hex");
}

function normalizeRole(role: any): "full" | "readonly" {
  return role === "readonly" ? "readonly" : "full";
}

// Returns match info for a provided key against the env master key and stored keys.
function checkKey(db: Database, key: string): { ok: boolean; primary: boolean; label?: string; keyId?: string; role?: "full" | "readonly" } {
  if (constantTimeEqual(key, MASTER_KEY)) return { ok: true, primary: true, label: "Primary" };
  for (const k of db.masterKeys || []) {
    if (k && k.salt && k.hash && constantTimeEqual(k.hash, hashKey(k.salt, key))) {
      return { ok: true, primary: false, label: k.label, keyId: k.id, role: normalizeRole(k.role) };
    }
  }
  return { ok: false, primary: false };
}

// Login rate limiter
const loginAttempts = new Map<string, { count: number; until: number }>();
function loginBlocked(ip: string): boolean {
  const rec = loginAttempts.get(ip);
  return !!rec && rec.until > Date.now();
}
function recordLoginFail(ip: string) {
  const rec = loginAttempts.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 8) {
    rec.until = Date.now() + 10 * 60 * 1000;
    rec.count = 0;
  }
  loginAttempts.set(ip, rec);
}

// In-memory cache of valid secondary keys (id -> role), so per-request auth
// doesn't need a full DB read every time, while still catching a revoked key
// within a few seconds instead of waiting out the token's 30-day expiry.
// Invalidated immediately whenever a key is added/removed/edited.
let keyCache: { byId: Map<string, "full" | "readonly">; loadedAt: number } | null = null;
const KEY_CACHE_TTL_MS = 5000;

async function getKeyCache(): Promise<Map<string, "full" | "readonly">> {
  if (keyCache && Date.now() - keyCache.loadedAt < KEY_CACHE_TTL_MS) return keyCache.byId;
  const db = await readDB();
  const byId = new Map<string, "full" | "readonly">();
  (db.masterKeys || []).forEach((k: any) => byId.set(k.id, normalizeRole(k.role)));
  keyCache = { byId, loadedAt: Date.now() };
  return byId;
}
function invalidateKeyCache() {
  keyCache = null;
}

// --- DB read/write -------------------------------------------------------
async function readDB(): Promise<Database> {
  let db: Database;
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    db = JSON.parse(data);
  } catch (error) {
    const seed: Database = JSON.parse(JSON.stringify(INITIAL_DB));
    await writeDB(seed);
    return seed;
  }

  if (!db.lists) db.lists = JSON.parse(JSON.stringify(INITIAL_DB.lists));
  if (!db.config) db.config = { ...INITIAL_DB.config };
  for (const key of ["operations", "complications", "followup", "appointments", "drains", "checks", "audit", "masterKeys", "photos"] as const) {
    if (!Array.isArray((db as any)[key])) (db as any)[key] = [];
  }
  if (!db.user) db.user = INITIAL_DB.user;
  // config defaults
  db.config = { ...DEFAULT_CONFIG, ...db.config };

  const clean = (rows: any[]) => {
    rows.forEach((r) => {
      if (r && typeof r === "object") {
        if (!r.id) r.id = newId();
        if ("_row" in r) delete r._row;
      }
    });
  };
  clean(db.operations); clean(db.complications); clean(db.followup);
  clean(db.appointments); clean(db.drains); clean(db.checks); clean(db.photos);

  // Backfill role on legacy access keys (pre-role rows default to full access).
  (db.masterKeys || []).forEach((k: any) => {
    if (k && !k.role) k.role = "full";
  });

  // Migrate operations: single Procedure/Surgeon strings -> arrays + derived joined strings.
  db.operations.forEach((o) => {
    o.Procedures = toList(o.Procedures, o.Procedure);
    o.Surgeons = toList(o.Surgeons, o.Surgeon);
    o.Procedure = o.Procedures.join(", ");
    o.Surgeon = o.Surgeons.join(", ");
  });

  // Migrate ancillary rows from patient-keyed to case-keyed (OperationID). Maps
  // a legacy row to the FIRST operation for its PatientID.
  const firstOpFor = (pid: string) => db.operations.find((o) => o.PatientID === pid);
  const migrate = (rows: any[]) => rows.forEach((r) => {
    if (!r.OperationID && r.PatientID) {
      const op = firstOpFor(r.PatientID);
      if (op) r.OperationID = op.id;
    }
    // keep a denormalized PatientID for display where we have the op
    if (r.OperationID && !r.PatientID) {
      const op = db.operations.find((o) => o.id === r.OperationID);
      if (op) r.PatientID = op.PatientID;
    }
  });
  migrate(db.drains); migrate(db.followup); migrate(db.checks); migrate(db.complications); migrate(db.photos);

  // Sync default catalog additions.
  if (!Array.isArray(db.lists.procedures)) db.lists.procedures = [...DEFAULT_PROCEDURES];
  else DEFAULT_PROCEDURES.forEach((p) => { if (!db.lists.procedures.includes(p)) db.lists.procedures.push(p); });
  if (!Array.isArray(db.lists.complications)) db.lists.complications = [...DEFAULT_COMPLICATIONS];
  else DEFAULT_COMPLICATIONS.forEach((c) => { if (!db.lists.complications.includes(c)) db.lists.complications.push(c); });

  return db;
}

// Serialized atomic writer
let writeChain: Promise<void> = Promise.resolve();
async function persist(db: Database): Promise<void> {
  const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), "utf-8");
  await fs.rename(tmpPath, DB_FILE);
}
function writeDB(db: Database): Promise<void> {
  const attempt = writeChain.then(() => persist(db), () => persist(db));
  writeChain = attempt.then(() => undefined, () => undefined);
  return attempt;
}

// Who is acting on this request, for attribution (audit log, CreatedBy, etc).
// Falls back to the practice display email only if somehow no session exists.
function actorOf(req: express.Request, db: Database): string {
  return (req as any).session?.sub || db.user || INITIAL_DB.user;
}

function logAudit(db: Database, who: string, action: string, details: string) {
  if (!Array.isArray(db.audit)) db.audit = [];
  db.audit.push({ id: newId(), Timestamp: new Date().toISOString(), User: who, Action: action, Details: details });
  if (db.audit.length > MAX_AUDIT_ENTRIES) db.audit = db.audit.slice(db.audit.length - MAX_AUDIT_ENTRIES);
}

function makeComplication(comp: any, operationId: string, patientId: string) {
  return {
    id: newId(),
    OperationID: operationId,
    PatientID: patientId,
    Complication: comp.Complication || "Other",
    Grade: comp.Grade || "",
    DateDetected: comp.DateDetected || new Date().toISOString().split("T")[0],
    Management: comp.Management || "",
    Resolved: "No",
    ResolvedDate: ""
  };
}

// Public db payload: strip secret master keys (hash/salt), keep id/label/role/createdAt via /api/keys instead.
function publicDB(db: Database) {
  const { masterKeys, ...rest } = db;
  return rest;
}

function photosDir(): string {
  return path.join(path.dirname(DB_FILE), "photos");
}

app.use(express.json({ limit: "12mb" }));

// --- Auth routes & guard -------------------------------------------------
app.post("/api/login", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (loginBlocked(ip)) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  const key = req.body?.key;
  if (!key) {
    recordLoginFail(ip);
    return res.status(401).json({ error: "Invalid master key." });
  }
  const db = await readDB();
  const result = checkKey(db, key);
  if (!result.ok) {
    recordLoginFail(ip);
    return res.status(401).json({ error: "Invalid master key." });
  }
  const payload: Record<string, any> = { sub: result.label || "user", primary: result.primary, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS };
  if (!result.primary) {
    payload.keyId = result.keyId;
    payload.role = result.role;
  }
  const token = signToken(payload);
  res.json({ token, primary: result.primary, label: result.label, role: result.primary ? "full" : result.role });
});

// Cron backup authenticates via CRON_SECRET.
app.post("/api/cron/backup", async (req, res) => {
  if (!CRON_SECRET || req.headers["x-cron-secret"] !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  try {
    const db = await readDB();
    const dir = path.join(path.dirname(DB_FILE), "backups");
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().split("T")[0];
    await fs.writeFile(path.join(dir, `db-${stamp}.json`), JSON.stringify(db, null, 2), "utf-8");
    res.json({ ok: true, file: `backups/db-${stamp}.json` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Session guard for everything else under /api: verifies the token, then for
// secondary (non-primary) sessions confirms the specific key hasn't been
// revoked and enforces the read-only role (blocks non-GET methods).
app.use("/api", async (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });

  if (payload.primary) {
    payload.role = "full";
  } else {
    const cache = await getKeyCache();
    const liveRole = payload.keyId ? cache.get(payload.keyId) : undefined;
    if (!liveRole) return res.status(401).json({ error: "This access key has been revoked." });
    payload.role = liveRole; // always trust the live role, not the token's stale copy
  }

  if (payload.role === "readonly" && req.method !== "GET") {
    return res.status(403).json({ error: "This access key is read-only." });
  }

  (req as any).session = payload;
  next();
});

app.get("/api/me", (req, res) => {
  const s = (req as any).session || {};
  res.json({ ok: true, user: INITIAL_DB.user, primary: !!s.primary, label: s.sub, role: s.role || "full" });
});

// --- Master key management (primary session only) ------------------------
function requirePrimary(req: express.Request, res: express.Response): boolean {
  if (!(req as any).session?.primary) {
    res.status(403).json({ error: "Only the primary master key can manage access keys." });
    return false;
  }
  return true;
}

function publicKeys(db: Database) {
  return (db.masterKeys || []).map((k) => ({ id: k.id, label: k.label, role: normalizeRole(k.role), createdAt: k.createdAt }));
}

app.get("/api/keys", async (req, res) => {
  if (!requirePrimary(req, res)) return;
  const db = await readDB();
  res.json({ keys: publicKeys(db) });
});

app.post("/api/keys", async (req, res) => {
  if (!requirePrimary(req, res)) return;
  const { label, key, role } = req.body || {};
  if (!key || String(key).length < 4) return res.status(400).json({ error: "Key must be at least 4 characters." });
  const db = await readDB();
  if (constantTimeEqual(key, MASTER_KEY) || checkKey(db, key).ok) {
    return res.status(400).json({ error: "That key already exists." });
  }
  const salt = randomBytes(16).toString("hex");
  db.masterKeys = db.masterKeys || [];
  db.masterKeys.push({
    id: newId(), label: (label || "Account").toString().slice(0, 40), salt, hash: hashKey(salt, key),
    role: normalizeRole(role), createdAt: new Date().toISOString()
  });
  logAudit(db, actorOf(req, db), "Add Access Key", `Added ${normalizeRole(role)} access key '${label || "Account"}'`);
  await writeDB(db);
  invalidateKeyCache();
  res.json({ keys: publicKeys(db) });
});

app.patch("/api/keys/:id", async (req, res) => {
  if (!requirePrimary(req, res)) return;
  const db = await readDB();
  const target = (db.masterKeys || []).find((k) => k.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Key not found." });
  if (req.body?.role !== undefined) target.role = normalizeRole(req.body.role);
  if (req.body?.label !== undefined) target.label = String(req.body.label).slice(0, 40);
  logAudit(db, actorOf(req, db), "Update Access Key", `Updated key '${target.label}' (role: ${target.role})`);
  await writeDB(db);
  invalidateKeyCache();
  res.json({ keys: publicKeys(db) });
});

app.delete("/api/keys/:id", async (req, res) => {
  if (!requirePrimary(req, res)) return;
  const db = await readDB();
  const target = (db.masterKeys || []).find((k) => k.id === req.params.id);
  db.masterKeys = (db.masterKeys || []).filter((k) => k.id !== req.params.id);
  logAudit(db, actorOf(req, db), "Remove Access Key", `Removed access key '${target ? target.label : "unknown"}'`);
  await writeDB(db);
  invalidateKeyCache();
  res.json({ keys: publicKeys(db) });
});

// --- Data routes ---------------------------------------------------------
app.get("/api/all", async (req, res) => {
  try {
    const db = await readDB();
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/operations", async (req, res) => {
  try {
    const op = req.body;
    const db = await readDB();
    if (!op.PatientID) return res.status(400).json({ error: "Patient ID is required." });
    const who = actorOf(req, db);

    const procedures = toList(op.Procedures, op.Procedure);
    const surgeons = toList(op.Surgeons, op.Surgeon);
    const opId = newId();

    const newOp = {
      id: opId, PatientID: op.PatientID, Age: op.Age ?? "", OperationDate: op.OperationDate || "",
      Procedures: procedures, Surgeons: surgeons, Procedure: procedures.join(", "), Surgeon: surgeons.join(", "),
      DrainPlaced: op.DrainPlaced ? "Yes" : "No", Notes: op.Notes || "", CreatedAt: new Date().toISOString(), CreatedBy: who
    };
    db.operations.push(newOp);

    // Each case gets its own follow-up timeline.
    db.followup.push({ id: newId(), OperationID: opId, PatientID: op.PatientID, M1: "—", M3: "—", M6: "—", M12: "—", FinalOutcome: "Ongoing" });

    let inlineComps = 0;
    if (Array.isArray(op.complications)) {
      op.complications.forEach((c: any) => {
        if (c && (c.Complication || c.Grade || c.Management)) {
          db.complications.push(makeComplication(c, opId, op.PatientID));
          inlineComps++;
        }
      });
    }

    logAudit(db, who, "Create Operation", `Added case for ${op.PatientID} (${newOp.Procedure || "—"} by ${newOp.Surgeon || "—"})${inlineComps ? ` + ${inlineComps} complication(s)` : ""}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/operations", async (req, res) => {
  try {
    const op = req.body;
    const db = await readDB();
    if (!op.PatientID) return res.status(400).json({ error: "Patient ID is required." });
    const who = actorOf(req, db);

    const index = db.operations.findIndex((o) => o.id === op.id);
    if (index === -1) return res.status(404).json({ error: "This case no longer exists — refresh and try again." });

    const currentOp = db.operations[index];
    const oldPatientID = currentOp.PatientID;
    const procedures = toList(op.Procedures, op.Procedure);
    const surgeons = toList(op.Surgeons, op.Surgeon);

    db.operations[index] = {
      ...currentOp, PatientID: op.PatientID, Age: op.Age ?? "", OperationDate: op.OperationDate || "",
      Procedures: procedures, Surgeons: surgeons, Procedure: procedures.join(", "), Surgeon: surgeons.join(", "),
      DrainPlaced: op.DrainPlaced ? "Yes" : "No", Notes: op.Notes || ""
    };

    // Keep denormalized PatientID in sync on this case's ancillary rows + patient-level appointments.
    if (String(op.PatientID).toLowerCase() !== String(oldPatientID).toLowerCase()) {
      const newPid = op.PatientID;
      [db.drains, db.complications, db.followup, db.checks, db.photos].forEach((rows) =>
        rows.forEach((r) => { if (r.OperationID === op.id) r.PatientID = newPid; })
      );
      db.appointments.forEach((a) => { if (a.PatientID === oldPatientID) a.PatientID = newPid; });
    }

    if (!op.DrainPlaced) db.drains = db.drains.filter((d) => d.OperationID !== op.id);

    logAudit(db, who, "Update Operation", `Updated case for patient ID ${op.PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete one case by id and its case-level ancillary data (including photos on disk).
app.delete("/api/operations/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();
    const who = actorOf(req, db);
    const target = db.operations.find((o) => o.id === id);
    if (!target) return res.status(404).json({ error: "Case not found." });
    const pid = target.PatientID;

    const photosToDelete = db.photos.filter((p) => p.OperationID === id);

    db.operations = db.operations.filter((o) => o.id !== id);
    db.drains = db.drains.filter((d) => d.OperationID !== id);
    db.complications = db.complications.filter((c) => c.OperationID !== id);
    db.followup = db.followup.filter((f) => f.OperationID !== id);
    db.checks = db.checks.filter((ch) => ch.OperationID !== id);
    db.photos = db.photos.filter((p) => p.OperationID !== id);

    // Appointments are patient-level; only purge when the patient has no cases left.
    const patientHasOtherCases = db.operations.some((o) => o.PatientID === pid);
    if (!patientHasOtherCases) db.appointments = db.appointments.filter((a) => a.PatientID !== pid);

    logAudit(db, who, "Delete Operation", `Deleted case ${id} for patient ID ${pid}`);
    await writeDB(db);

    // Best-effort file cleanup after the DB write succeeds.
    for (const p of photosToDelete) {
      try { await fs.unlink(path.join(photosDir(), p.id)); } catch { /* already gone */ }
    }

    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drains/remove", async (req, res) => {
  try {
    const { OperationID } = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    const op = db.operations.find((o) => o.id === OperationID);
    if (!op) return res.status(404).json({ error: "Case not found." });
    if (!db.drains.some((d) => d.OperationID === OperationID)) {
      db.drains.push({ id: newId(), OperationID, PatientID: op.PatientID, RemovedDate: new Date().toISOString().split("T")[0], RemovedBy: who });
    }
    logAudit(db, who, "Remove Drain", `Marked drain removed for case ${OperationID} (${op.PatientID})`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drains/undo", async (req, res) => {
  try {
    const { OperationID } = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    db.drains = db.drains.filter((d) => d.OperationID !== OperationID);
    logAudit(db, who, "Undo Drain Removal", `Undid drain removal for case ${OperationID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complications", async (req, res) => {
  try {
    const comp = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    const op = db.operations.find((o) => o.id === comp.OperationID);
    if (!op) return res.status(400).json({ error: "A valid case is required for the complication." });
    const newComp = makeComplication(comp, op.id, op.PatientID);
    db.complications.push(newComp);
    logAudit(db, who, "Add Complication", `Logged '${newComp.Complication}' (Clavien ${newComp.Grade}) for ${op.PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/complications", async (req, res) => {
  try {
    const comp = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    const index = db.complications.findIndex((c) => c.id === comp.id);
    if (index === -1) return res.status(404).json({ error: "This complication no longer exists — refresh and try again." });
    const existing = db.complications[index];
    const wasResolved = existing.Resolved === "Yes";
    db.complications[index] = {
      ...existing, Complication: comp.Complication || "Other", Grade: comp.Grade || "", DateDetected: comp.DateDetected || "",
      Management: comp.Management || "", Resolved: comp.Resolved ? "Yes" : "No",
      ResolvedDate: comp.Resolved ? (wasResolved ? existing.ResolvedDate : new Date().toISOString().split("T")[0]) : ""
    };
    logAudit(db, who, "Update Complication", `Updated complication for ${db.complications[index].PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();
    const who = actorOf(req, db);
    const target = db.complications.find((c) => c.id === id);
    db.complications = db.complications.filter((c) => c.id !== id);
    logAudit(db, who, "Delete Complication", `Deleted complication for ${target ? target.PatientID : "Unknown"}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complications/resolve/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();
    const who = actorOf(req, db);
    const index = db.complications.findIndex((c) => c.id === id);
    if (index !== -1) {
      db.complications[index].Resolved = "Yes";
      db.complications[index].ResolvedDate = new Date().toISOString().split("T")[0];
    }
    const pId = index !== -1 ? db.complications[index].PatientID : "Unknown";
    logAudit(db, who, "Resolve Complication", `Marked complication resolved for ${pId}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/followup", async (req, res) => {
  try {
    const { OperationID, field, value } = req.body;
    const ALLOWED = ["M1", "M3", "M6", "M12", "FinalOutcome"];
    if (!ALLOWED.includes(field)) return res.status(400).json({ error: "Invalid follow-up field." });
    const db = await readDB();
    const who = actorOf(req, db);
    const op = db.operations.find((o) => o.id === OperationID);
    if (!op) return res.status(400).json({ error: "A valid case is required." });
    let rec = db.followup.find((f) => f.OperationID === OperationID);
    if (!rec) {
      rec = { id: newId(), OperationID, PatientID: op.PatientID, M1: "—", M3: "—", M6: "—", M12: "—", FinalOutcome: "Ongoing" };
      db.followup.push(rec);
    }
    rec[field] = value;
    logAudit(db, who, "Update Follow-up", `Set ${field}='${value}' for ${op.PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checks", async (req, res) => {
  try {
    const { OperationID, item, done } = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    const op = db.operations.find((o) => o.id === OperationID);
    if (!op) return res.status(400).json({ error: "A valid case is required." });
    const index = db.checks.findIndex((c) => c.OperationID === OperationID && c.Item === item);
    if (done && index === -1) db.checks.push({ id: newId(), OperationID, PatientID: op.PatientID, Item: item, Done: "Yes" });
    else if (!done && index !== -1) db.checks.splice(index, 1);
    logAudit(db, who, done ? "Check Item Done" : "Check Item Undo", `${done ? "Checked" : "Unchecked"} '${item}' for ${op.PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/appointments", async (req, res) => {
  try {
    const appt = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    if (!appt.PatientID) return res.status(400).json({ error: "Patient ID / Name is required." });
    if (!appt.Date) return res.status(400).json({ error: "Date is required." });
    db.appointments.push({
      id: newId(), PatientID: appt.PatientID, Date: appt.Date, Time: appt.Time || "", Type: appt.Type || "Other",
      Notes: appt.Notes || "", Status: "Scheduled", CreatedBy: who
    });
    logAudit(db, who, "Create Appointment", `Scheduled ${appt.Type} on ${appt.Date} for ${appt.PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/appointments/status", async (req, res) => {
  try {
    const { id, status } = req.body;
    const db = await readDB();
    const who = actorOf(req, db);
    const appt = db.appointments.find((a) => a.id === id);
    if (appt) {
      appt.Status = status;
      logAudit(db, who, "Update Appointment Status", `Set status '${status}' for ${appt.PatientID}`);
    }
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();
    const who = actorOf(req, db);
    const target = db.appointments.find((a) => a.id === id);
    db.appointments = db.appointments.filter((a) => a.id !== id);
    logAudit(db, who, "Delete Appointment", `Deleted ${target ? target.Type : "appointment"} for ${target ? target.PatientID : "Unknown"}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/lists/save", async (req, res) => {
  try {
    const { type, items } = req.body;
    const db = await readDB();
    if (!Array.isArray(items)) return res.status(400).json({ error: "Items must be a list." });
    if (type === "surgeons") db.lists.surgeons = items;
    else if (type === "procedures") db.lists.procedures = items;
    else if (type === "checklist") db.lists.checklistItems = items;
    else if (type === "complications") db.lists.complications = items;
    else return res.status(400).json({ error: "Unknown list type." });
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/config/save", async (req, res) => {
  try {
    const config = req.body;
    const db = await readDB();
    db.config = {
      ...db.config,
      DrainAlertDays: Number(config.DrainAlertDays) || db.config.DrainAlertDays,
      FU1: Number(config.FU1) || db.config.FU1,
      FU2: Number(config.FU2) || db.config.FU2,
      FU3: Number(config.FU3) || db.config.FU3,
      FU4: Number(config.FU4) || db.config.FU4,
      practiceName: config.practiceName !== undefined ? String(config.practiceName).slice(0, 60) : db.config.practiceName,
      defaultRowsPerPage: [5, 10, 25, 50].includes(Number(config.defaultRowsPerPage)) ? Number(config.defaultRowsPerPage) : db.config.defaultRowsPerPage
    };
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/backup/download", async (req, res) => {
  try {
    const db = await readDB();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=surgical_case_tracker_backup.json");
    res.send(JSON.stringify(db, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/backup/upload", async (req, res) => {
  try {
    const newDb = req.body;
    if (!newDb || !Array.isArray(newDb.operations) || !Array.isArray(newDb.complications) || !newDb.lists || !newDb.config) {
      return res.status(400).json({ error: "Invalid backup file structure." });
    }
    const current = await readDB();
    // Preserve existing master keys unless the backup explicitly carries them.
    const merged = { ...INITIAL_DB, ...newDb, masterKeys: Array.isArray(newDb.masterKeys) ? newDb.masterKeys : current.masterKeys };
    await writeDB(merged as Database);
    invalidateKeyCache();
    const updatedDb = await readDB();
    res.json(publicDB(updatedDb));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- CSV / Excel-compatible export ----------------------------------------
function csvEscape(v: any): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

app.get("/api/export/csv", async (req, res) => {
  try {
    const db = await readDB();
    const header = [
      "Patient ID", "Age", "Operation Date", "Procedures", "Surgeons", "Drain Placed", "Drain Removed Date",
      "Complications", "Open Complications", "Checklist Progress", "Follow-up Outcome", "Notes", "Created By", "Created At"
    ];
    const checklistTotal = db.lists.checklistItems.length;
    const rows = db.operations.map((o) => {
      const drain = db.drains.find((d) => d.OperationID === o.id);
      const comps = db.complications.filter((c) => c.OperationID === o.id);
      const openComps = comps.filter((c) => c.Resolved !== "Yes").length;
      const fu = db.followup.find((f) => f.OperationID === o.id);
      const checklistDone = db.checks.filter((c) => c.OperationID === o.id && c.Done === "Yes").length;
      return [
        o.PatientID, o.Age, o.OperationDate, o.Procedure, o.Surgeon,
        o.DrainPlaced, drain ? drain.RemovedDate : "",
        comps.map((c) => c.Complication).join("; "), openComps,
        `${checklistDone}/${checklistTotal}`,
        fu ? fu.FinalOutcome : "Ongoing",
        o.Notes || "", o.CreatedBy || "", o.CreatedAt || ""
      ].map(csvEscape).join(",");
    });
    const csv = [header.map(csvEscape).join(","), ...rows].join("\r\n");
    const stamp = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="surgical_cases_export_${stamp}.csv"`);
    // UTF-8 BOM so Excel correctly detects encoding (important for Arabic text).
    res.send("﻿" + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Photos ---------------------------------------------------------------
app.post("/api/photos", async (req, res) => {
  try {
    const { OperationID, filename, mimeType, dataBase64 } = req.body || {};
    if (!OperationID || !dataBase64) return res.status(400).json({ error: "A case and image data are required." });
    if (!mimeType || !String(mimeType).startsWith("image/")) return res.status(400).json({ error: "Only image files are supported." });

    const db = await readDB();
    const who = actorOf(req, db);
    const op = db.operations.find((o) => o.id === OperationID);
    if (!op) return res.status(400).json({ error: "A valid case is required." });

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid image data." });
    }
    if (buffer.length === 0) return res.status(400).json({ error: "Invalid image data." });
    if (buffer.length > MAX_PHOTO_BYTES) return res.status(400).json({ error: "Image must be under 6MB." });

    const id = newId();
    await fs.mkdir(photosDir(), { recursive: true });
    await fs.writeFile(path.join(photosDir(), id), buffer);

    const meta = {
      id, OperationID, PatientID: op.PatientID,
      filename: (filename || "photo").toString().slice(0, 120),
      mimeType, size: buffer.length, uploadedAt: new Date().toISOString(), uploadedBy: who
    };
    db.photos.push(meta);
    logAudit(db, who, "Upload Photo", `Uploaded photo '${meta.filename}' for ${op.PatientID}`);
    await writeDB(db);
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/photos/:id", async (req, res) => {
  try {
    const db = await readDB();
    const meta = db.photos.find((p) => p.id === req.params.id);
    if (!meta) return res.status(404).json({ error: "Photo not found." });
    const buf = await fs.readFile(path.join(photosDir(), meta.id));
    res.setHeader("Content-Type", meta.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buf);
  } catch (err: any) {
    res.status(404).json({ error: "Photo not found." });
  }
});

app.delete("/api/photos/:id", async (req, res) => {
  try {
    const db = await readDB();
    const who = actorOf(req, db);
    const meta = db.photos.find((p) => p.id === req.params.id);
    db.photos = db.photos.filter((p) => p.id !== req.params.id);
    logAudit(db, who, "Delete Photo", meta ? `Deleted photo '${meta.filename}' for ${meta.PatientID}` : "Deleted photo");
    await writeDB(db);
    if (meta) {
      try { await fs.unlink(path.join(photosDir(), meta.id)); } catch { /* already gone */ }
    }
    res.json(publicDB(db));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite / static
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
