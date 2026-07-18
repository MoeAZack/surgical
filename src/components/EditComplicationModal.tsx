import React, { useState, useEffect } from "react";
import { DBState, Complication } from "../types";
import { X } from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

interface EditComplicationModalProps {
  complication: Complication | null;
  db: DBState;
  onClose: () => void;
  onSave: (updatedComp: {
    id: string;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
    Resolved: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const EditComplicationModal: React.FC<EditComplicationModalProps> = ({
  complication,
  db,
  onClose,
  onSave,
  onDelete
}) => {
  const [what, setWhat] = useState("");
  const [grade, setGrade] = useState("I");
  const [date, setDate] = useState("");
  const [mgmt, setMgmt] = useState("");
  const [resolved, setResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (complication) {
      setWhat(complication.Complication);
      setGrade(complication.Grade || "I");
      setDate(complication.DateDetected || "");
      setMgmt(complication.Management || "");
      setResolved(complication.Resolved === "Yes");
    }
  }, [complication]);

  if (!complication) return null;

  const listConfig = db.lists;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    setSubmitting(true);
    try {
      await onSave({
        id: complication.id,
        Complication: what,
        Grade: grade,
        DateDetected: date,
        Management: mgmt,
        Resolved: resolved
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
      await onDelete(complication.id);
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
                  Complications Registry Edit
                </span>
                <h3 className="font-display font-bold text-lg mt-0.5">Edit Complication: {complication.PatientID}</h3>
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
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                  Complication Type
                </label>
                <select
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                >
                  {listConfig.complications.map((c) => (
                    <option key={c} value={c} className="bg-brand-bg text-white">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Clavien-Dindo Grade
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                  >
                    <option value="I" className="bg-brand-bg text-white">I</option>
                    <option value="II" className="bg-brand-bg text-white">II</option>
                    <option value="IIIa" className="bg-brand-bg text-white">IIIa</option>
                    <option value="IIIb" className="bg-brand-bg text-white">IIIb</option>
                    <option value="IVa" className="bg-brand-bg text-white">IVa</option>
                    <option value="IVb" className="bg-brand-bg text-white">IVb</option>
                    <option value="V" className="bg-brand-bg text-white">V</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Date Detected
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Management Notes
                  </label>
                  <VoiceInputButton
                    lang="en"
                    onTranscript={(text) => setMgmt((prev) => prev ? prev + " " + text : text)}
                  />
                </div>
                <input
                  type="text"
                  value={mgmt}
                  onChange={(e) => setMgmt(e.target.value)}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30"
                />
              </div>

              <div className="flex items-center gap-2.5 p-1">
                <input
                  type="checkbox"
                  id="resolved-comp-checkbox"
                  checked={resolved}
                  onChange={(e) => setResolved(e.target.checked)}
                  className="w-5 h-5 accent-brand-primary rounded cursor-pointer animate-fade-in"
                />
                <label
                  htmlFor="resolved-comp-checkbox"
                  className="text-sm font-semibold text-white/85 cursor-pointer select-none"
                >
                  Mark Complication as Resolved
                </label>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-4 gap-2">
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
                  {deleting ? "Deleting..." : showDeleteConfirm ? "Click Again to Confirm" : "Delete Log"}
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
