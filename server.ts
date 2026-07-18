import express from "express";
import path from "path";
import fs from "fs/promises";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), "db.json");

// --- Auth config ---------------------------------------------------------
// Master key defaults to the value the user uses across their trackers; can be
// overridden with the MASTER_KEY env var on the deployment.
const MASTER_KEY = process.env.MASTER_KEY || "MoeAZack";
// Secret used to sign session tokens. Deriving a stable default from the master
// key keeps sessions valid across restarts even if SESSION_SECRET is unset.
const SESSION_SECRET = process.env.SESSION_SECRET || `surgical-sess::${MASTER_KEY}`;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CRON_SECRET = process.env.CRON_SECRET || "";

// Cap the audit trail so the JSON store cannot grow without bound.
const MAX_AUDIT_ENTRIES = 1000;

// Default lists
const DEFAULT_SURGEONS = ["Dr. A", "Dr. B"];
const DEFAULT_PROCEDURES = [
  "Liposuction",
  "Abdominoplasty",
  "Breast Augmentation",
  "Breast Reduction",
  "Mastopexy",
  "Augmentation-Mastopexy",
  "Gynecomastia Correction",
  "Fat Transfer / BBL",
  "Brachioplasty",
  "Thigh Lift",
  "Rhinoplasty",
  "Blepharoplasty",
  "Facelift / Neck Lift",
  "Otoplasty",
  "Brow Lift",
  "Chin Augmentation",
  "Lip Lift",
  "Fat Grafting (Face)",
  "Body Lift",
  "Mommy Makeover",
  "Labiaplasty",
  "Surgical Scar Revision",
  "Basal Cell Carcinoma Excision",
  "Melanoma Excision",
  "Skin Grafting",
  "Local Flap Reconstruction",
  "Carpal Tunnel Release",
  "Trigger Finger Release",
  "Breast Reconstruction (Implant)",
  "Breast Reconstruction (Flap)",
  "Panniculectomy",
  "Septoplasty",
  "Mentoplasty",
  "Other"
];
const DEFAULT_CHECKLIST = [
  "Consent signed",
  "Pre-op photos taken",
  "Pre-op labs reviewed",
  "Prophylactic antibiotics",
  "Post-op instructions given"
];
const DEFAULT_COMPLICATIONS = [
  "Seroma",
  "Hematoma",
  "Infection",
  "Wound Dehiscence",
  "Capsular Contracture",
  "Implant Rupture/Malposition",
  "Fat Necrosis",
  "Skin/Flap Necrosis",
  "Asymmetry/Contour Irregularity",
  "Hypertrophic Scar/Keloid",
  "DVT/PE",
  "Fat Embolism",
  "Epidermolysis",
  "Suture Spit",
  "Delayed Wound Healing",
  "Allergic Reaction (Tape/Suture/Prep)",
  "Paresthesia / Nerve Injury",
  "Chronic Pain",
  "Areolar/Nipple Sensation Loss",
  "Nipple-Areola Complex Necrosis",
  "Stretching of Scar",
  "Hyperpigmentation / Discoloration",
  "Pneumothorax",
  "Pruritus (Severe)",
  "Anesthesia Complication",
  "Surgical Site Bleeding",
  "Syncope / Vasovagal",
  "Other"
];
const FU_STATUS = ["—", "Good", "Issue noted", "Concern — review", "Missed"];
const OUTCOMES = ["Ongoing", "Success", "Failure", "Recurrence", "Reoperation", "Lost to follow-up", "Deceased"];
const APPT_TYPES = [
  "Wound check",
  "Drain removal",
  "Suture removal",
  "Dressing change",
  "1-week review",
  "Consultation",
  "Other"
];
const APPT_STATUS = ["Scheduled", "Done", "No-show", "Cancelled"];

const DEFAULT_CONFIG = { DrainAlertDays: 7, FU1: 1, FU2: 3, FU3: 6, FU4: 12 };

interface Database {
  operations: any[];
  drains: any[];
  complications: any[];
  followup: any[];
  checks: any[];
  appointments: any[];
  lists: {
    surgeons: string[];
    procedures: string[];
    checklistItems: string[];
    complications: string[];
    fuStatus: string[];
    outcomes: string[];
    apptTypes: string[];
    apptStatus: string[];
  };
  config: {
    DrainAlertDays: number;
    FU1: number;
    FU2: number;
    FU3: number;
    FU4: number;
  };
  user: string;
  audit?: any[];
}

const INITIAL_DB: Database = {
  operations: [],
  drains: [],
  complications: [],
  followup: [],
  checks: [],
  appointments: [],
  lists: {
    surgeons: DEFAULT_SURGEONS,
    procedures: DEFAULT_PROCEDURES,
    checklistItems: DEFAULT_CHECKLIST,
    complications: DEFAULT_COMPLICATIONS,
    fuStatus: FU_STATUS,
    outcomes: OUTCOMES,
    apptTypes: APPT_TYPES,
    apptStatus: APPT_STATUS
  },
  config: DEFAULT_CONFIG,
  user: "moezaka@gmail.com"
};

function newId(): string {
  return randomUUID();
}

// Normalise procedures/surgeons to a clean string[] from either the array form
// or the legacy single-string form.
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

// Simple in-memory login rate limiter (per IP): 8 failures -> 10 min lockout.
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
  if (!Array.isArray(db.operations)) db.operations = [];
  if (!Array.isArray(db.complications)) db.complications = [];
  if (!Array.isArray(db.followup)) db.followup = [];
  if (!Array.isArray(db.appointments)) db.appointments = [];
  if (!Array.isArray(db.drains)) db.drains = [];
  if (!Array.isArray(db.checks)) db.checks = [];
  if (!Array.isArray(db.audit)) db.audit = [];
  if (!db.user) db.user = INITIAL_DB.user;

  const clean = (rows: any[]) => {
    rows.forEach((r) => {
      if (r && typeof r === "object") {
        if (!r.id) r.id = newId();
        if ("_row" in r) delete r._row;
      }
    });
  };
  clean(db.operations);
  clean(db.complications);
  clean(db.followup);
  clean(db.appointments);
  clean(db.drains);
  clean(db.checks);

  // Migrate legacy single Procedure/Surgeon strings to Procedures[]/Surgeons[]
  // and keep derived joined display strings.
  db.operations.forEach((o) => {
    o.Procedures = toList(o.Procedures, o.Procedure);
    o.Surgeons = toList(o.Surgeons, o.Surgeon);
    o.Procedure = o.Procedures.join(", ");
    o.Surgeon = o.Surgeons.join(", ");
  });

  if (!Array.isArray(db.lists.procedures)) {
    db.lists.procedures = [...DEFAULT_PROCEDURES];
  } else {
    DEFAULT_PROCEDURES.forEach((p) => {
      if (!db.lists.procedures.includes(p)) db.lists.procedures.push(p);
    });
  }

  if (!Array.isArray(db.lists.complications)) {
    db.lists.complications = [...DEFAULT_COMPLICATIONS];
  } else {
    DEFAULT_COMPLICATIONS.forEach((c) => {
      if (!db.lists.complications.includes(c)) db.lists.complications.push(c);
    });
  }

  return db;
}

// Serialized, atomic DB writer.
let writeChain: Promise<void> = Promise.resolve();

async function persist(db: Database): Promise<void> {
  const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
  const payload = JSON.stringify(db, null, 2);
  await fs.writeFile(tmpPath, payload, "utf-8");
  await fs.rename(tmpPath, DB_FILE);
}

function writeDB(db: Database): Promise<void> {
  const attempt = writeChain.then(
    () => persist(db),
    () => persist(db)
  );
  writeChain = attempt.then(
    () => undefined,
    () => undefined
  );
  return attempt;
}

function logAudit(db: Database, action: string, details: string) {
  if (!Array.isArray(db.audit)) db.audit = [];
  db.audit.push({
    id: newId(),
    Timestamp: new Date().toISOString(),
    User: db.user || INITIAL_DB.user,
    Action: action,
    Details: details
  });
  if (db.audit.length > MAX_AUDIT_ENTRIES) {
    db.audit = db.audit.slice(db.audit.length - MAX_AUDIT_ENTRIES);
  }
}

// Build a complication record from an intake payload.
function makeComplication(comp: any, patientId: string) {
  return {
    id: newId(),
    PatientID: patientId,
    Complication: comp.Complication || "Other",
    Grade: comp.Grade || "",
    DateDetected: comp.DateDetected || new Date().toISOString().split("T")[0],
    Management: comp.Management || "",
    Resolved: "No",
    ResolvedDate: ""
  };
}

app.use(express.json({ limit: "10mb" }));

// --- Auth routes & guard -------------------------------------------------
app.post("/api/login", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (loginBlocked(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  }
  const key = req.body?.key;
  if (!key || !constantTimeEqual(key, MASTER_KEY)) {
    recordLoginFail(ip);
    return res.status(401).json({ error: "Invalid master key." });
  }
  const token = signToken({ sub: "master", iat: Date.now(), exp: Date.now() + SESSION_TTL_MS });
  res.json({ token });
});

// Cron backup route authenticates via CRON_SECRET, not the session token.
app.post("/api/cron/backup", async (req, res) => {
  if (!CRON_SECRET || req.headers["x-cron-secret"] !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const db = await readDB();
    const dir = path.join(path.dirname(DB_FILE), "backups");
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().split("T")[0];
    const file = path.join(dir, `db-${stamp}.json`);
    await fs.writeFile(file, JSON.stringify(db, null, 2), "utf-8");
    res.json({ ok: true, file: `backups/db-${stamp}.json` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Everything else under /api requires a valid session token.
app.use("/api", (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/api/me", (req, res) => {
  res.json({ ok: true, user: INITIAL_DB.user });
});

// --- Data routes ---------------------------------------------------------
app.get("/api/all", async (req, res) => {
  try {
    const db = await readDB();
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/operations", async (req, res) => {
  try {
    const op = req.body;
    const db = await readDB();

    if (!op.PatientID) {
      return res.status(400).json({ error: "Patient ID is required." });
    }

    const procedures = toList(op.Procedures, op.Procedure);
    const surgeons = toList(op.Surgeons, op.Surgeon);

    const newOp = {
      id: newId(),
      PatientID: op.PatientID,
      Age: op.Age ?? "",
      OperationDate: op.OperationDate || "",
      Procedures: procedures,
      Surgeons: surgeons,
      Procedure: procedures.join(", "),
      Surgeon: surgeons.join(", "),
      DrainPlaced: op.DrainPlaced ? "Yes" : "No",
      Notes: op.Notes || "",
      CreatedAt: new Date().toISOString(),
      CreatedBy: db.user
    };

    db.operations.push(newOp);

    // Seed a follow-up record for this patient if none exists yet.
    if (!db.followup.some((f) => f.PatientID === op.PatientID)) {
      db.followup.push({
        id: newId(),
        PatientID: op.PatientID,
        M1: "—",
        M3: "—",
        M6: "—",
        M12: "—",
        FinalOutcome: "Ongoing"
      });
    }

    // Optional complications logged inline during intake.
    let inlineComps = 0;
    if (Array.isArray(op.complications)) {
      op.complications.forEach((c: any) => {
        if (c && (c.Complication || c.Grade || c.Management)) {
          db.complications.push(makeComplication(c, op.PatientID));
          inlineComps++;
        }
      });
    }

    logAudit(
      db,
      "Create Operation",
      `Added case for ${op.PatientID} (${newOp.Procedure || "—"} by ${newOp.Surgeon || "—"})${inlineComps ? ` + ${inlineComps} complication(s)` : ""}`
    );

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/operations", async (req, res) => {
  try {
    const op = req.body;
    const db = await readDB();

    if (!op.PatientID) {
      return res.status(400).json({ error: "Patient ID is required." });
    }

    const index = db.operations.findIndex((o) => o.id === op.id);
    if (index === -1) {
      return res.status(404).json({ error: "This case no longer exists — refresh and try again." });
    }

    const currentOp = db.operations[index];
    const oldPatientID = currentOp.PatientID;
    const procedures = toList(op.Procedures, op.Procedure);
    const surgeons = toList(op.Surgeons, op.Surgeon);

    db.operations[index] = {
      ...currentOp,
      PatientID: op.PatientID,
      Age: op.Age ?? "",
      OperationDate: op.OperationDate || "",
      Procedures: procedures,
      Surgeons: surgeons,
      Procedure: procedures.join(", "),
      Surgeon: surgeons.join(", "),
      DrainPlaced: op.DrainPlaced ? "Yes" : "No",
      Notes: op.Notes || ""
    };

    // Cascade a Patient ID rename across the patient's ancillary records.
    if (String(op.PatientID).toLowerCase() !== String(oldPatientID).toLowerCase()) {
      const newPid = op.PatientID;
      const cascade = (rows: any[]) => rows.forEach((r) => {
        if (r.PatientID === oldPatientID) r.PatientID = newPid;
      });
      cascade(db.drains);
      cascade(db.complications);
      cascade(db.followup);
      cascade(db.checks);
      cascade(db.appointments);
      // Keep any sibling cases for the same patient in sync too.
      db.operations.forEach((o) => {
        if (o.id !== op.id && o.PatientID === oldPatientID) o.PatientID = newPid;
      });
    }

    if (!op.DrainPlaced) {
      db.drains = db.drains.filter((d) => d.PatientID !== op.PatientID);
    }

    logAudit(db, "Update Operation", `Updated case for patient ID ${op.PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single case by id (leaves other cases for the patient intact).
app.delete("/api/operations/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();

    const target = db.operations.find((o) => o.id === id);
    if (!target) {
      return res.status(404).json({ error: "Case not found." });
    }
    const pid = target.PatientID;
    db.operations = db.operations.filter((o) => o.id !== id);

    // Only purge patient-level ancillary data when this was the patient's last case.
    const patientHasOtherCases = db.operations.some((o) => o.PatientID === pid);
    if (!patientHasOtherCases) {
      db.drains = db.drains.filter((d) => d.PatientID !== pid);
      db.complications = db.complications.filter((c) => c.PatientID !== pid);
      db.followup = db.followup.filter((f) => f.PatientID !== pid);
      db.checks = db.checks.filter((ch) => ch.PatientID !== pid);
      db.appointments = db.appointments.filter((a) => a.PatientID !== pid);
    }

    logAudit(db, "Delete Operation", `Deleted case ${id} for patient ID ${pid}${patientHasOtherCases ? " (other cases retained)" : " and all cascaded data"}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drains/remove", async (req, res) => {
  try {
    const { PatientID } = req.body;
    const db = await readDB();

    if (!db.drains.some((d) => d.PatientID === PatientID)) {
      db.drains.push({
        id: newId(),
        PatientID,
        RemovedDate: new Date().toISOString().split("T")[0],
        RemovedBy: db.user
      });
    }

    logAudit(db, "Remove Drain", `Marked drain removed for patient ID ${PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drains/undo", async (req, res) => {
  try {
    const { PatientID } = req.body;
    const db = await readDB();

    db.drains = db.drains.filter((d) => d.PatientID !== PatientID);

    logAudit(db, "Undo Drain Removal", `Undid drain removal for patient ID ${PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complications", async (req, res) => {
  try {
    const comp = req.body;
    const db = await readDB();

    if (!comp.PatientID) {
      return res.status(400).json({ error: "Patient ID is required." });
    }

    const newComp = makeComplication(comp, comp.PatientID);
    db.complications.push(newComp);

    logAudit(db, "Add Complication", `Logged complication '${newComp.Complication}' (Clavien ${newComp.Grade}) for patient ID ${comp.PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/complications", async (req, res) => {
  try {
    const comp = req.body;
    const db = await readDB();

    const index = db.complications.findIndex((c) => c.id === comp.id);
    if (index === -1) {
      return res.status(404).json({ error: "This complication no longer exists — refresh and try again." });
    }

    const existingComp = db.complications[index];
    const wasResolved = existingComp.Resolved === "Yes";

    db.complications[index] = {
      ...existingComp,
      Complication: comp.Complication || "Other",
      Grade: comp.Grade || "",
      DateDetected: comp.DateDetected || "",
      Management: comp.Management || "",
      Resolved: comp.Resolved ? "Yes" : "No",
      ResolvedDate: comp.Resolved ? (wasResolved ? existingComp.ResolvedDate : new Date().toISOString().split("T")[0]) : ""
    };

    logAudit(db, "Update Complication", `Updated complication records for patient ID ${db.complications[index].PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();

    const target = db.complications.find((c) => c.id === id);
    db.complications = db.complications.filter((c) => c.id !== id);

    logAudit(db, "Delete Complication", `Deleted complication log entry for patient ID ${target ? target.PatientID : "Unknown"}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complications/resolve/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();

    const index = db.complications.findIndex((c) => c.id === id);
    if (index !== -1) {
      db.complications[index].Resolved = "Yes";
      db.complications[index].ResolvedDate = new Date().toISOString().split("T")[0];
    }

    const pId = index !== -1 ? db.complications[index].PatientID : "Unknown";
    logAudit(db, "Resolve Complication", `Marked complication resolved for patient ID ${pId}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/followup", async (req, res) => {
  try {
    const { PatientID, field, value } = req.body;
    const ALLOWED_FIELDS = ["M1", "M3", "M6", "M12", "FinalOutcome"];
    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ error: "Invalid follow-up field." });
    }
    const db = await readDB();

    let rec = db.followup.find((f) => f.PatientID === PatientID);
    if (!rec) {
      rec = {
        id: newId(),
        PatientID,
        M1: "—",
        M3: "—",
        M6: "—",
        M12: "—",
        FinalOutcome: "Ongoing"
      };
      db.followup.push(rec);
    }

    rec[field] = value;

    logAudit(db, "Update Follow-up", `Set milestone ${field} to '${value}' for patient ID ${PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checks", async (req, res) => {
  try {
    const { PatientID, item, done } = req.body;
    const db = await readDB();

    const index = db.checks.findIndex((c) => c.PatientID === PatientID && c.Item === item);

    if (done && index === -1) {
      db.checks.push({
        id: newId(),
        PatientID,
        Item: item,
        Done: "Yes"
      });
    } else if (!done && index !== -1) {
      db.checks.splice(index, 1);
    }

    logAudit(db, done ? "Check Item Done" : "Check Item Undo", `${done ? "Checked" : "Unchecked"} '${item}' for patient ID ${PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/appointments", async (req, res) => {
  try {
    const appt = req.body;
    const db = await readDB();

    if (!appt.PatientID) {
      return res.status(400).json({ error: "Patient ID / Name is required." });
    }
    if (!appt.Date) {
      return res.status(400).json({ error: "Date is required." });
    }

    db.appointments.push({
      id: newId(),
      PatientID: appt.PatientID,
      Date: appt.Date,
      Time: appt.Time || "",
      Type: appt.Type || "Other",
      Notes: appt.Notes || "",
      Status: "Scheduled",
      CreatedBy: db.user
    });

    logAudit(db, "Create Appointment", `Scheduled ${appt.Type} on ${appt.Date} for patient ID ${appt.PatientID}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/appointments/status", async (req, res) => {
  try {
    const { id, status } = req.body;
    const db = await readDB();

    const appt = db.appointments.find((a) => a.id === id);
    if (appt) {
      appt.Status = status;
      logAudit(db, "Update Appointment Status", `Set status to '${status}' for patient ID ${appt.PatientID} appointment`);
    }

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();

    const target = db.appointments.find((a) => a.id === id);
    db.appointments = db.appointments.filter((a) => a.id !== id);

    logAudit(db, "Delete Appointment", `Deleted scheduled ${target ? target.Type : "appointment"} for patient ID ${target ? target.PatientID : "Unknown"}`);

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/lists/save", async (req, res) => {
  try {
    const { type, items } = req.body;
    const db = await readDB();

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Items must be a list." });
    }

    if (type === "surgeons") {
      db.lists.surgeons = items;
    } else if (type === "procedures") {
      db.lists.procedures = items;
    } else if (type === "checklist") {
      db.lists.checklistItems = items;
    } else if (type === "complications") {
      db.lists.complications = items;
    } else {
      return res.status(400).json({ error: "Unknown list type." });
    }

    await writeDB(db);
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/config/save", async (req, res) => {
  try {
    const config = req.body;
    const db = await readDB();

    db.config = {
      DrainAlertDays: Number(config.DrainAlertDays) || db.config.DrainAlertDays,
      FU1: Number(config.FU1) || db.config.FU1,
      FU2: Number(config.FU2) || db.config.FU2,
      FU3: Number(config.FU3) || db.config.FU3,
      FU4: Number(config.FU4) || db.config.FU4
    };

    await writeDB(db);
    res.json(db);
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
    if (
      !newDb ||
      !Array.isArray(newDb.operations) ||
      !Array.isArray(newDb.complications) ||
      !newDb.lists ||
      !newDb.config
    ) {
      return res.status(400).json({ error: "Invalid backup file structure." });
    }

    await writeDB({
      ...INITIAL_DB,
      ...newDb
    });

    const updatedDb = await readDB();
    res.json(updatedDb);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite Middleware for Assets and App Pages
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
