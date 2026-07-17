import React, { useState } from "react";
import { DBState } from "../types";
import { PlusCircle } from "lucide-react";
import { suggestNextPatientID } from "../utils";
import { translations } from "../translations";
import { VoiceInputButton } from "./VoiceInputButton";

interface NewOperationFormProps {
  db: DBState;
  lang: "en" | "ar";
  onAddOperation: (op: {
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedure: string;
    Surgeon: string;
    DrainPlaced: boolean;
    Notes: string;
  }) => Promise<void>;
  onQuickAddList: (kind: "procedures" | "surgeons", selectId: string) => Promise<string | undefined>;
}

export const NewOperationForm: React.FC<NewOperationFormProps> = ({ db, lang, onAddOperation, onQuickAddList }) => {
  const [pid, setPid] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [opDate, setOpDate] = useState(new Date().toISOString().split("T")[0]);
  const [procedure, setProcedure] = useState("");
  const [surgeon, setSurgeon] = useState("");
  const [drain, setDrain] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Validation states
  const [pidError, setPidError] = useState("");
  const [ageError, setAgeError] = useState("");
  const [opDateError, setOpDateError] = useState("");

  const listConfig = db.lists;
  const t = translations[lang];

  // Real-time Patient ID validation
  const handlePidChange = (value: string) => {
    setPid(value);
    const cleaned = value.trim().toUpperCase();
    if (!cleaned) {
      setPidError(isRTL ? "معرف المريض مطلوب" : "Patient ID is required.");
      return;
    }
    const idPattern = /^[A-Z0-9-]+$/;
    if (!idPattern.test(cleaned)) {
      setPidError(isRTL ? "معرف المريض يجب أن يحتوي على أحرف وأرقام وشرطات فقط" : "Patient ID must contain only alphanumeric characters and hyphens.");
      return;
    }
    const isDuplicate = db.operations.some(op => op.PatientID.toUpperCase() === cleaned);
    if (isDuplicate) {
      setPidError(isRTL ? "معرف المريض هذا مسجل بالفعل في سجلات العيادة" : "This Patient ID already exists in clinical records.");
      return;
    }
    setPidError("");
  };

  // Real-time Age validation
  const handleAgeChange = (val: string) => {
    setAge(val ? Number(val) : "");
    if (val) {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 120) {
        setAgeError(isRTL ? "العمر يجب أن يكون بين 1 و 120 سنة" : "Age must be between 1 and 120.");
        return;
      }
    }
    setAgeError("");
  };

  // Real-time Date validation
  const handleDateChange = (val: string) => {
    setOpDate(val);
    if (!val) {
      setOpDateError(isRTL ? "تاريخ العملية مطلوب" : "Operation date is required.");
      return;
    }
    const selectedDate = new Date(val);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (selectedDate > tomorrow) {
      setOpDateError(isRTL ? "لا يمكن لـ تاريخ العملية أن يكون في المستقبل البعيد" : "Operation date cannot be set in the future.");
      return;
    }
    setOpDateError("");
  };

  // Auto-suggest next Patient ID on mount
  React.useEffect(() => {
    if (!pid && db.operations) {
      const nextId = suggestNextPatientID(db.operations);
      setPid(nextId);
    }
  }, [db.operations, pid]);

  // Sync state defaults
  React.useEffect(() => {
    if (listConfig.procedures && listConfig.procedures.length > 0 && !procedure) {
      setProcedure(listConfig.procedures[0]);
    }
  }, [listConfig.procedures, procedure]);

  React.useEffect(() => {
    if (listConfig.surgeons && listConfig.surgeons.length > 0 && !surgeon) {
      setSurgeon(listConfig.surgeons[0]);
    }
  }, [listConfig.surgeons, surgeon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final strict validation check
    const isDuplicate = db.operations.some(op => op.PatientID.toUpperCase() === pid.trim().toUpperCase());
    const idPattern = /^[A-Z0-9-]+$/i;
    const isIdInvalid = !idPattern.test(pid.trim());
    const isAgeInvalid = age !== "" && (age < 1 || age > 120);
    const selectedDate = new Date(opDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isDateInvalid = !opDate || selectedDate > tomorrow;

    if (!pid.trim() || isDuplicate || isIdInvalid || isAgeInvalid || isDateInvalid) {
      // Set correct errors
      if (!pid.trim()) setPidError(isRTL ? "معرف المريض مطلوب" : "Patient ID is required.");
      else if (isIdInvalid) setPidError(isRTL ? "معرف المريض غير صالح" : "Patient ID is invalid.");
      else if (isDuplicate) setPidError(isRTL ? "معرف المريض مسجل مسبقاً" : "Patient ID already exists.");

      if (isAgeInvalid) setAgeError(isRTL ? "عمر غير صالح" : "Age must be 1 to 120.");
      if (isDateInvalid) setOpDateError(isRTL ? "تاريخ غير صالح" : "Date cannot be in the future.");
      return;
    }

    setSubmitting(true);
    try {
      await onAddOperation({
        PatientID: pid.trim().toUpperCase(),
        Age: age,
        OperationDate: opDate,
        Procedure: procedure,
        Surgeon: surgeon,
        DrainPlaced: drain,
        Notes: notes
      });
      // Reset ID after successful submission to next incremented ID
      const updatedOps = [
        ...db.operations,
        { PatientID: pid.trim().toUpperCase(), Age: age, OperationDate: opDate, Procedure: procedure, Surgeon: surgeon, DrainPlaced: drain ? "Yes" : "No", Notes: notes } as any
      ];
      setPid(suggestNextPatientID(updatedOps));
      setAge("");
      setNotes("");
      setDrain(false);
      setPidError("");
      setAgeError("");
      setOpDateError("");
    } catch {
      // toast is already fired
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    if (!pid.trim()) {
      setPidError(isRTL ? "يجب إدخال معرف المريض لحفظ مسودة" : "Patient ID is required to save a draft.");
      return;
    }

    try {
      const stored = localStorage.getItem("clinical_drafts");
      const drafts = stored ? JSON.parse(stored) : [];

      const newDraft = {
        id: "draft_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        type: "operation",
        createdAt: new Date().toISOString(),
        data: {
          PatientID: pid.trim().toUpperCase(),
          Age: age,
          OperationDate: opDate,
          Procedure: procedure || listConfig.procedures[0],
          Surgeon: surgeon || listConfig.surgeons[0],
          DrainPlaced: drain,
          Notes: notes
        }
      };

      drafts.push(newDraft);
      localStorage.setItem("clinical_drafts", JSON.stringify(drafts));

      // Reset fields
      setAge("");
      setNotes("");
      setDrain(false);
      
      // Flash Toast
      const toastEvent = new CustomEvent("clinical_toast", {
        detail: { message: t.draftSavedSuccess, isError: false }
      });
      window.dispatchEvent(toastEvent);

      // Auto-suggest next Patient ID
      const updatedOps = [
        ...db.operations,
        { PatientID: pid.trim().toUpperCase() } as any
      ];
      setPid(suggestNextPatientID(updatedOps));
      setPidError("");
      setAgeError("");
      setOpDateError("");
    } catch (e) {
      console.error("Failed to save draft", e);
    }
  };

  const isRTL = lang === "ar";

  return (
    <div className="space-y-6 animate-fade-in" id="new-operation-view" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight">{t.newCaseTitle}</h2>
        <p className="text-sm text-white/60 mt-1">{t.newCaseSub}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
        <h3 className={`font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-1.5 mb-6 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
          <PlusCircle className="w-4.5 h-4.5 text-emerald-400" /> {t.formIntakeTitle}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
              {t.patientId}
            </label>
            <input
              type="text"
              placeholder={t.patientIdPlaceholder}
              value={pid}
              onChange={(e) => handlePidChange(e.target.value)}
              className={`w-full py-2 px-3 border ${pidError ? "border-rose-500 focus:border-rose-500" : "border-white/10 focus:border-emerald-500"} rounded-xl text-sm focus:outline-none bg-white/5 font-semibold text-white uppercase placeholder-white/30`}
              required
            />
            {pidError && (
              <p className={`text-rose-400 text-xs mt-1.5 font-semibold ${isRTL ? "text-right" : "text-left"}`}>
                ⚠ {pidError}
              </p>
            )}
          </div>

          <div>
            <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
              {t.ageYears}
            </label>
            <input
              type="number"
              min="1"
              max="120"
              placeholder={t.agePlaceholder}
              value={age}
              onChange={(e) => handleAgeChange(e.target.value)}
              className={`w-full py-2 px-3 border ${ageError ? "border-rose-500 focus:border-rose-500" : "border-white/10 focus:border-emerald-500"} rounded-xl text-sm focus:outline-none bg-white/5 text-white placeholder-white/30`}
            />
            {ageError && (
              <p className={`text-rose-400 text-xs mt-1.5 font-semibold ${isRTL ? "text-right" : "text-left"}`}>
                ⚠ {ageError}
              </p>
            )}
          </div>

          <div>
            <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
              {t.operationDate}
            </label>
            <input
              type="date"
              value={opDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`w-full py-2 px-3 border ${opDateError ? "border-rose-500 focus:border-rose-500" : "border-white/10 focus:border-emerald-500"} rounded-xl text-sm focus:outline-none bg-white/5 text-white`}
              required
            />
            {opDateError && (
              <p className={`text-rose-400 text-xs mt-1.5 font-semibold ${isRTL ? "text-right" : "text-left"}`}>
                ⚠ {opDateError}
              </p>
            )}
          </div>

          <div>
            <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
              {t.procedureLabel}
            </label>
            <div className={`flex gap-1.5 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <select
                id="f-op-select"
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 bg-[#0A2E2A] text-white"
              >
                {listConfig.procedures.map((p) => (
                  <option key={p} value={p} className="bg-[#0A2E2A] text-white">
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const added = await onQuickAddList("procedures", "f-op-select");
                  if (added) setProcedure(added);
                }}
                className="py-1 px-2.5 border border-white/10 hover:border-emerald-500 text-white/60 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
              {t.surgeonLabel}
            </label>
            <div className={`flex gap-1.5 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <select
                id="f-surgeon-select"
                value={surgeon}
                onChange={(e) => setSurgeon(e.target.value)}
                className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 bg-[#0A2E2A] text-white"
              >
                {listConfig.surgeons.map((s) => (
                  <option key={s} value={s} className="bg-[#0A2E2A] text-white">
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const added = await onQuickAddList("surgeons", "f-surgeon-select");
                  if (added) setSurgeon(added);
                }}
                className="py-1 px-2.5 border border-white/10 hover:border-emerald-500 text-white/60 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
              {t.drainPlacedLabel}
            </label>
            <select
              value={drain ? "Yes" : "No"}
              onChange={(e) => setDrain(e.target.value === "Yes")}
              className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 bg-[#0A2E2A] text-white"
            >
              <option value="No" className="bg-[#0A2E2A] text-white">No</option>
              <option value="Yes" className="bg-[#0A2E2A] text-white">Yes</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider ${isRTL ? "text-right" : "text-left"}`}>
                {t.notesLabel}
              </label>
              <VoiceInputButton
                lang={lang}
                onTranscript={(text) => setNotes((prev) => prev ? prev + " " + text : text)}
              />
            </div>
            <textarea
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2.5 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 bg-white/5 text-white placeholder-white/30 min-h-[90px]"
            />
          </div>
        </div>

        <div className={`flex flex-col sm:flex-row gap-3 pt-4 mt-6 border-t border-white/10 ${isRTL ? "sm:justify-start" : "sm:justify-end"}`}>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="bg-white/10 hover:bg-white/15 text-white py-2.5 px-5 rounded-xl font-semibold text-sm transition-colors cursor-pointer border border-white/10 text-center"
          >
            📂 {t.saveAsDraftBtn}
          </button>
          <button
            type="submit"
            disabled={submitting || !!pidError || !!ageError || !!opDateError || !pid.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-default text-white py-2.5 px-6 rounded-xl font-semibold text-sm transition-colors cursor-pointer border border-emerald-400/20 shadow-lg text-center"
          >
            {submitting ? t.savingCase : t.saveCaseBtn}
          </button>
        </div>
      </form>
    </div>
  );
};
