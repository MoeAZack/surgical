import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

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

// Helper to read DB
async function readDB(): Promise<Database> {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    const db = JSON.parse(data);
    
    // Ensure all required sections exist
    if (!db.lists) db.lists = { ...INITIAL_DB.lists };
    if (!db.config) db.config = { ...INITIAL_DB.config };
    if (!db.operations) db.operations = [];
    if (!db.complications) db.complications = [];
    if (!db.followup) db.followup = [];
    if (!db.appointments) db.appointments = [];
    if (!db.drains) db.drains = [];
    if (!db.checks) db.checks = [];
    if (!db.audit) db.audit = [];

    // Auto-reindex _row property for robust deletion & update targeting
    db.operations.forEach((o: any, i: number) => { o._row = i + 2; });
    db.complications.forEach((c: any, i: number) => { c._row = i + 2; });
    db.followup.forEach((f: any, i: number) => { f._row = i + 2; });
    db.appointments.forEach((a: any, i: number) => { a._row = i + 2; });

    // Sync lists with any missing defaults requested by the user
    if (!db.lists.procedures) {
      db.lists.procedures = [...DEFAULT_PROCEDURES];
    } else {
      DEFAULT_PROCEDURES.forEach((p) => {
        if (!db.lists.procedures.includes(p)) {
          db.lists.procedures.push(p);
        }
      });
    }

    if (!db.lists.complications) {
      db.lists.complications = [...DEFAULT_COMPLICATIONS];
    } else {
      DEFAULT_COMPLICATIONS.forEach((c) => {
        if (!db.lists.complications.includes(c)) {
          db.lists.complications.push(c);
        }
      });
    }

    return db;
  } catch (error) {
    // If doesn't exist, write default and return
    await writeDB(INITIAL_DB);
    return { ...INITIAL_DB };
  }
}

// Helper to write DB
async function writeDB(db: Database): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function logAudit(db: any, action: string, details: string) {
  if (!db.audit) db.audit = [];
  db.audit.push({
    id: Date.now().toString() + Math.random().toString().slice(2, 6),
    Timestamp: new Date().toISOString(),
    User: db.user || "moezaka@gmail.com",
    Action: action,
    Details: details
  });
}

app.use(express.json());

// API Endpoints
app.get("/api/all", async (req, res) => {
  try {
    const db = await readDB();
    res.json({
      ...db,
      audit: db.audit || [],
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
    if (db.operations.some((o) => o.PatientID.toLowerCase() === op.PatientID.toLowerCase())) {
      return res.status(400).json({ error: `Patient ID ${op.PatientID} already exists.` });
    }

    const newOp = {
      ...op,
      _row: db.operations.length + 2, // 1-indexed plus header row compatibility
      id: Date.now().toString(),
      CreatedAt: new Date().toISOString(),
      CreatedBy: db.user
    };

    db.operations.push(newOp);

    // Auto seed follow-up
    db.followup.push({
      PatientID: op.PatientID,
      M1: "—",
      M3: "—",
      M6: "—",
      M12: "—",
      FinalOutcome: "Ongoing",
      _row: db.followup.length + 2,
      id: (Date.now() + 1).toString()
    });

    logAudit(db, "Create Operation", `Added patient ID ${op.PatientID} (${op.Procedure} by ${op.Surgeon})`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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

    const index = db.operations.findIndex((o) => o._row === Number(op._row));
    if (index === -1) {
      return res.status(404).json({ error: "The sheet changed since you loaded — refresh and try again." });
    }

    const currentOp = db.operations[index];

    // Check duplicate ID if ID has changed
    if (
      op.PatientID.toLowerCase() !== op.oldPatientID.toLowerCase() &&
      db.operations.some((o) => o.PatientID.toLowerCase() === op.PatientID.toLowerCase())
    ) {
      return res.status(400).json({ error: `Patient ID ${op.PatientID} already exists.` });
    }

    // Update operational record
    db.operations[index] = {
      ...currentOp,
      PatientID: op.PatientID,
      Age: op.Age || "",
      OperationDate: op.OperationDate || "",
      Procedure: op.Procedure || "",
      Surgeon: op.Surgeon || "",
      DrainPlaced: op.DrainPlaced ? "Yes" : "No",
      Notes: op.Notes || ""
    };

    // Cascade rename
    if (op.PatientID.toLowerCase() !== op.oldPatientID.toLowerCase()) {
      const oldId = op.oldPatientID;
      const newId = op.PatientID;

      // Rename in other sheets
      db.drains.forEach((d) => {
        if (d.PatientID === oldId) d.PatientID = newId;
      });
      db.complications.forEach((c) => {
        if (c.PatientID === oldId) c.PatientID = newId;
      });
      db.followup.forEach((f) => {
        if (f.PatientID === oldId) f.PatientID = newId;
      });
      db.checks.forEach((ch) => {
        if (ch.PatientID === oldId) ch.PatientID = newId;
      });
      db.appointments.forEach((a) => {
        if (a.PatientID === oldId) a.PatientID = newId;
      });
    }

    // Delete drain if no longer placed
    if (!op.DrainPlaced) {
      db.drains = db.drains.filter((d) => d.PatientID !== op.PatientID);
    }

    logAudit(db, "Update Operation", `Updated details for patient ID ${op.PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/operations/:pid", async (req, res) => {
  try {
    const pid = req.params.pid;
    const db = await readDB();

    db.operations = db.operations.filter((o) => o.PatientID !== pid);
    db.drains = db.drains.filter((d) => d.PatientID !== pid);
    db.complications = db.complications.filter((c) => c.PatientID !== pid);
    db.followup = db.followup.filter((f) => f.PatientID !== pid);
    db.checks = db.checks.filter((ch) => ch.PatientID !== pid);
    db.appointments = db.appointments.filter((a) => a.PatientID !== pid);

    // Recalculate row indices to maintain backward compatibility
    db.operations.forEach((o, i) => (o._row = i + 2));
    db.complications.forEach((c, i) => (c._row = i + 2));
    db.followup.forEach((f, i) => (f._row = i + 2));
    db.appointments.forEach((a, i) => (a._row = i + 2));

    logAudit(db, "Delete Operation", `Hard deleted patient ID ${pid} and all cascaded data`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
        PatientID,
        RemovedDate: new Date().toISOString().split("T")[0],
        RemovedBy: db.user,
        id: Date.now().toString()
      });
    }

    logAudit(db, "Remove Drain", `Marked drain removed for patient ID ${PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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

    const newComp = {
      PatientID: comp.PatientID,
      Complication: comp.Complication || "Other",
      Grade: comp.Grade || "",
      DateDetected: comp.DateDetected || new Date().toISOString().split("T")[0],
      Management: comp.Management || "",
      Resolved: "No",
      ResolvedDate: "",
      _row: db.complications.length + 2,
      id: Date.now().toString()
    };

    db.complications.push(newComp);

    logAudit(db, "Add Complication", `Logged complication '${newComp.Complication}' (Clavien ${newComp.Grade}) for patient ID ${comp.PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/complications", async (req, res) => {
  try {
    const comp = req.body;
    const db = await readDB();

    const index = db.complications.findIndex((c) => c._row === Number(comp._row));
    if (index !== -1) {
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
    }

    logAudit(db, "Update Complication", `Updated complication records for patient ID ${comp.PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complications/:row", async (req, res) => {
  try {
    const row = Number(req.params.row);
    const db = await readDB();

    db.complications = db.complications.filter((c) => c._row !== row);
    // Reindex rows
    db.complications.forEach((c, i) => (c._row = i + 2));

    logAudit(db, "Delete Complication", `Deleted complication log entry at row ${row}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complications/resolve/:row", async (req, res) => {
  try {
    const row = Number(req.params.row);
    const db = await readDB();

    const index = db.complications.findIndex((c) => c._row === row);
    if (index !== -1) {
      db.complications[index].Resolved = "Yes";
      db.complications[index].ResolvedDate = new Date().toISOString().split("T")[0];
    }

    const pId = index !== -1 ? db.complications[index].PatientID : "Unknown";
    logAudit(db, "Resolve Complication", `Marked complication resolved for patient ID ${pId}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/followup", async (req, res) => {
  try {
    const { PatientID, field, value } = req.body;
    const db = await readDB();

    let rec = db.followup.find((f) => f.PatientID === PatientID);
    if (!rec) {
      rec = {
        PatientID,
        M1: "—",
        M3: "—",
        M6: "—",
        M12: "—",
        FinalOutcome: "Ongoing",
        _row: db.followup.length + 2,
        id: Date.now().toString()
      };
      db.followup.push(rec);
    }

    rec[field] = value;

    logAudit(db, "Update Follow-up", `Set milestone ${field} to '${value}' for patient ID ${PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
        PatientID,
        Item: item,
        Done: "Yes",
        id: Date.now().toString()
      });
    } else if (!done && index !== -1) {
      db.checks.splice(index, 1);
    }

    logAudit(db, done ? "Check Item Done" : "Check Item Undo", `${done ? "Checked" : "Unchecked"} '${item}' for patient ID ${PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
      PatientID: appt.PatientID,
      Date: appt.Date,
      Time: appt.Time || "",
      Type: appt.Type || "Other",
      Notes: appt.Notes || "",
      Status: "Scheduled",
      CreatedBy: db.user,
      _row: db.appointments.length + 2,
      id: Date.now().toString()
    });

    logAudit(db, "Create Appointment", `Scheduled ${appt.Type} on ${appt.Date} for patient ID ${appt.PatientID}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/appointments/status", async (req, res) => {
  try {
    const { row, status } = req.body;
    const db = await readDB();

    const appt = db.appointments.find((a) => a._row === Number(row));
    if (appt) {
      appt.Status = status;
      logAudit(db, "Update Appointment Status", `Set status to '${status}' for patient ID ${appt.PatientID} appointment`);
    }

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/appointments/:rowOrId", async (req, res) => {
  try {
    const rowOrId = req.params.rowOrId;
    const db = await readDB();

    const rowNum = Number(rowOrId);
    let targetAppt;
    if (!isNaN(rowNum)) {
      targetAppt = db.appointments.find((a) => a._row === rowNum || a.id === rowOrId);
    } else {
      targetAppt = db.appointments.find((a) => a.id === rowOrId);
    }

    const targetPid = targetAppt ? targetAppt.PatientID : "Unknown";
    const targetType = targetAppt ? targetAppt.Type : "Appointment";

    if (!isNaN(rowNum)) {
      db.appointments = db.appointments.filter((a) => a._row !== rowNum && a.id !== rowOrId);
    } else {
      db.appointments = db.appointments.filter((a) => a.id !== rowOrId);
    }

    // Reindex rows
    db.appointments.forEach((a, i) => (a._row = i + 2));

    logAudit(db, "Delete Appointment", `Deleted scheduled ${targetType} for patient ID ${targetPid}`);

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/lists/save", async (req, res) => {
  try {
    const { type, items } = req.body;
    const db = await readDB();

    if (type === "surgeons") {
      db.lists.surgeons = items;
    } else if (type === "procedures") {
      db.lists.procedures = items;
    } else if (type === "checklist") {
      db.lists.checklistItems = items;
    } else if (type === "complications") {
      db.lists.complications = items;
    }

    await writeDB(db);
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
    res.json({
      ...db,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Photo folder Mock / URL resolver
app.get("/api/photos/:pid", async (req, res) => {
  try {
    const pid = req.params.pid;
    // Return a dummy folder link since there is no actual Drive connection in the preview environment
    res.json({ url: `https://drive.google.com/drive/search?q=${encodeURIComponent(pid)}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Database Backup Endpoint
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

// Import Database Backup Endpoint
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
    res.json({
      ...updatedDb,
      sheetUrl: "https://docs.google.com/spreadsheets",
      photosUrl: "https://drive.google.com"
    });
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
