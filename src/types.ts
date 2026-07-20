export interface Operation {
  id: string;
  PatientID: string;
  Age: number | "";
  OperationDate: string;
  /** Selected procedures for this case. */
  Procedures: string[];
  /** Surgeons involved in this case. */
  Surgeons: string[];
  /** Derived, comma-joined display string kept in sync by the server. */
  Procedure: string;
  /** Derived, comma-joined display string kept in sync by the server. */
  Surgeon: string;
  DrainPlaced: "Yes" | "No";
  Notes: string;
  CreatedAt?: string;
  CreatedBy?: string;
}

export interface Drain {
  id: string;
  OperationID: string;
  PatientID: string;
  RemovedDate: string;
  RemovedBy: string;
}

export interface Complication {
  id: string;
  OperationID: string;
  PatientID: string;
  Complication: string;
  Grade: string;
  DateDetected: string;
  Management: string;
  Resolved: "Yes" | "No";
  ResolvedDate: string;
}

export interface FollowUp {
  id: string;
  OperationID: string;
  PatientID: string;
  M1: string;
  M3: string;
  M6: string;
  M12: string;
  FinalOutcome: string;
}

export interface CheckItem {
  id: string;
  OperationID: string;
  PatientID: string;
  Item: string;
  Done: "Yes" | "No";
}

export interface Appointment {
  id: string;
  PatientID: string;
  Date: string;
  Time: string;
  Type: string;
  Notes: string;
  Status: "Scheduled" | "Done" | "No-show" | "Cancelled";
  CreatedBy?: string;
}

export interface AuditEntry {
  id: string;
  Timestamp: string;
  User: string;
  Action: string;
  Details: string;
}

export interface Photo {
  id: string;
  OperationID: string;
  PatientID: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByPatient?: boolean;
}

export interface PatientKeyInfo {
  id: string;
  OperationID: string;
  createdAt: string;
}

export interface ListConfig {
  surgeons: string[];
  procedures: string[];
  checklistItems: string[];
  complications: string[];
  fuStatus: string[];
  outcomes: string[];
  apptTypes: string[];
  apptStatus: string[];
}

export interface AppConfig {
  DrainAlertDays: number;
  FU1: number;
  FU2: number;
  FU3: number;
  FU4: number;
  practiceName?: string;
  defaultRowsPerPage?: number;
}

export interface DBState {
  operations: Operation[];
  drains: Drain[];
  complications: Complication[];
  followup: FollowUp[];
  checks: CheckItem[];
  appointments: Appointment[];
  photos: Photo[];
  lists: ListConfig;
  config: AppConfig;
  user: string;
  audit?: AuditEntry[];
  patientKeys?: PatientKeyInfo[];
}

/** Minimal shape returned to a patient session by GET /api/patient/case,
 *  POST /api/photos, and DELETE /api/photos/:id — deliberately excludes any
 *  clinical detail (procedure, dates, complications, other patients, etc). */
export interface PatientPortalPhoto {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
}

