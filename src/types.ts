export interface Operation {
  id: string;
  PatientID: string;
  Age: number | "";
  OperationDate: string;
  Procedure: string;
  Surgeon: string;
  DrainPlaced: "Yes" | "No";
  Notes: string;
  CreatedAt?: string;
  CreatedBy?: string;
}

export interface Drain {
  id: string;
  PatientID: string;
  RemovedDate: string;
  RemovedBy: string;
}

export interface Complication {
  id: string;
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
  PatientID: string;
  M1: string;
  M3: string;
  M6: string;
  M12: string;
  FinalOutcome: string;
}

export interface CheckItem {
  id: string;
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
}

export interface DBState {
  operations: Operation[];
  drains: Drain[];
  complications: Complication[];
  followup: FollowUp[];
  checks: CheckItem[];
  appointments: Appointment[];
  lists: ListConfig;
  config: AppConfig;
  user: string;
  audit?: AuditEntry[];
}

export interface CaseDraft {
  id: string;
  type: "operation" | "complication";
  createdAt: string;
  data: {
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedure: string;
    Surgeon: string;
    DrainPlaced: boolean;
    Notes: string;
    // or for complication:
    Complication?: string;
    Grade?: string;
    DateDetected?: string;
    Management?: string;
  };
}

