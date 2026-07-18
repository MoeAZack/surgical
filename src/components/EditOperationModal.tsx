import React, { useState, useEffect } from "react";
import { DBState, Operation } from "../types";
import { X, AlertCircle } from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

interface EditOperationModalProps {
  operation: Operation | null;
  db: DBState;
  onClose: () => void;
  onSave: (updatedOp: {
    id: string;
    oldPatientID: string;
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedure: string;
    Surgeon: string;
    DrainPlaced: boolean;
    Notes: string;
  }) => Promise<void>;
  onDelete: (pid: string) => Promise<void>;
  onQuickAddList: (kind: "procedures" | "surgeons", selectId: string) => Promise<string | undefined>;
}

export const EditOperationModal: React.FC<EditOperationModalProps> = ({
  operation,
  db,
  onClose,
  onSave,
  onDelete,
  onQuickAddList
}) => {
  const [pid, setPid] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [opDate, setOpDate] = useState("");
  const [procedure, setProcedure] = useState("");
  const [surgeon, setSurgeon] = useState("");
  const [drain, setDrain] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (operation) {
      setPid(operation.PatientID);
      setAge(operation.Age);
      setOpDate(operation.OperationDate || "");
      setProcedure(operation.Procedure);
      setSurgeon(operation.Surgeon);
      setDrain(operation.DrainPlaced === "Yes");
      setNotes(operation.Notes || "");
    }
  }, [operation]);

  if (!operation) return null;

  const listConfig = db.lists;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pid.trim() || !opDate) return;

    setSubmitting(true);
    try {
      await onSave({
        id: operation.id,
        oldPatientID: operation.PatientID,
        PatientID: pid.trim().toUpperCase(),
        Age: age,
        OperationDate: opDate,
        Procedure: procedure,
        Surgeon: surgeon,
        DrainPlaced: drain,
        Notes: notes
      });
      onClose();
    } catch {
      // error handled in main App
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(operation.PatientID);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        {/* Modal Window */}
        <div className="bg-brand-bg/95 backdrop-blur-xl rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-white/10 animate-fade-in relative flex flex-col justify-between text-white">
          <div>
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-bg/85 to-brand-bg/95 border-b border-white/10 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold text-brand-primary uppercase tracking-wider block">
                  Surgical Intake Edit
                </span>
                <h3 className="font-display font-bold text-lg mt-0.5">Edit Case: {operation.PatientID}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Patient ID
                  </label>
                  <input
                    type="text"
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 uppercase font-semibold text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Age
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Operation Date
                  </label>
                  <input
                    type="date"
                    value={opDate}
                    onChange={(e) => setOpDate(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Drain Placed
                  </label>
                  <select
                    value={drain ? "Yes" : "No"}
                    onChange={(e) => setDrain(e.target.value === "Yes")}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                  >
                    <option value="No" className="bg-brand-bg text-white">No</option>
                    <option value="Yes" className="bg-brand-bg text-white">Yes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                  Procedure
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="e-op-select"
                    value={procedure}
                    onChange={(e) => setProcedure(e.target.value)}
                    className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                  >
                    {listConfig.procedures.map((p) => (
                      <option key={p} value={p} className="bg-brand-bg text-white">
                        {p}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const added = await onQuickAddList("procedures", "e-op-select");
                      if (added) setProcedure(added);
                    }}
                    className="py-1 px-2.5 border border-white/10 hover:border-brand-primary text-white/60 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                  Surgeon
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="e-surgeon-select"
                    value={surgeon}
                    onChange={(e) => setSurgeon(e.target.value)}
                    className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                  >
                    {listConfig.surgeons.map((s) => (
                      <option key={s} value={s} className="bg-brand-bg text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const added = await onQuickAddList("surgeons", "e-surgeon-select");
                      if (added) setSurgeon(added);
                    }}
                    className="py-1 px-2.5 border border-white/10 hover:border-brand-primary text-white/60 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Notes
                  </label>
                  <VoiceInputButton
                    lang="en" // Modals are in English as shown by text labels
                    onTranscript={(text) => setNotes((prev) => prev ? prev + " " + text : text)}
                  />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white min-h-[70px]"
                />
              </div>

              <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-300 text-[11px] leading-normal">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  * Renaming the Patient ID cascade-updates their drain removals, complications registry, appointments calendar, checklist, and follow-up milestones database automatically.
                </p>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-2 gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`font-semibold text-xs py-2.5 px-4 rounded-xl transition-all hover:shadow-sm cursor-pointer border ${
                    showDeleteConfirm
                      ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 animate-pulse"
                      : "bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {deleting ? "Deleting..." : showDeleteConfirm ? "Click Again to Confirm" : "Delete Patient"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-white/10 hover:bg-white/15 text-white border border-white/10 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || deleting}
                    className="bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl transition-all hover:shadow-md cursor-pointer border border-brand-primary-light/20 shadow-lg"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
