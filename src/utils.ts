import { Operation, Drain, FollowUp, DBState } from "./types";

export const now0 = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const esc = (s: string | null | undefined): string => {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m] || m)
  );
};

export const fmt = (d: string | Date | null | undefined): string => {
  if (!d) return "—";
  try {
    const dateObj = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return "—";
    return dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit"
    });
  } catch {
    return "—";
  }
};

export const iso = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const daysInSitu = (op: Operation, drains: Drain[]): number => {
  if (!op.OperationDate) return 0;
  const rem = drains.find((d) => d.OperationID === op.id);
  const end = rem ? new Date(rem.RemovedDate) : new Date();
  const start = new Date(op.OperationDate);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const addMonths = (dateStr: string, m: number): Date => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + m);
  return d;
};

export const CLOSED_OUTCOMES = ["Success", "Failure", "Recurrence", "Reoperation"];

export const getMilestones = (config: DBState["config"]): [string, number][] => {
  return [
    ["M1", config.FU1],
    ["M3", config.FU2],
    ["M6", config.FU3],
    ["M12", config.FU4]
  ];
};

export const isFollowUpLate = (
  op: Operation,
  followup: FollowUp | undefined,
  key: "M1" | "M3" | "M6" | "M12",
  months: number
): boolean => {
  if (!followup || followup.FinalOutcome !== "Ongoing") return false;
  if (followup[key] !== "—") return false;
  if (!op.OperationDate) return false;
  const due = addMonths(op.OperationDate, months);
  return due < new Date();
};

export const suggestNextPatientID = (operations: Operation[]): string => {
  if (!operations || operations.length === 0) return "PS-0100";
  
  let maxNum = -1;
  let prefix = "PS-";
  let padLength = 4;

  operations.forEach((op) => {
    const match = op.PatientID.match(/^([A-Z]+-)?(\d+)$/i);
    if (match) {
      const currentPrefix = match[1] || "PS-";
      const numStr = match[2];
      const num = parseInt(numStr, 10);
      if (num > maxNum) {
        maxNum = num;
        prefix = currentPrefix;
        padLength = numStr.length;
      }
    }
  });

  if (maxNum === -1) {
    return "PS-0101";
  }

  const nextNum = maxNum + 1;
  const nextNumStr = String(nextNum).padStart(padLength, "0");
  return `${prefix}${nextNumStr}`;
};
