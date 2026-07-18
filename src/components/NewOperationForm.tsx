import React, { useState } from "react";
import { DBState } from "../types";
import { PlusCircle, X, Plus, Stethoscope, AlertTriangle } from "lucide-react";
import { suggestNextPatientID } from "../utils";
import { translations } from "../translations";
import { VoiceInputButton } from "./VoiceInputButton";
import { ChipMultiSelect } from "./ChipMultiSelect";

interface InlineComplication {
  Complication: string;
  Grade: string;
  DateDetected: string;
  Management: string;
}

interface NewOperationFormProps {
  db: DBState;
  lang: "en" | "ar";
  onAddOperation: (op: {
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedures: string[];
    Surgeons: string[];
    DrainPlaced: boolean;
    Notes: string;
    complications?: InlineComplication[];
  }) => Promise<void>;
  onQuickAddList: (kind: "procedures" | "surgeons" | "complications", selectId: string) => Promise<string | undefined>;
}

export const NewOperationForm: React.FC<NewOperationFormProps> = ({ db, lang, onAddOperation, onQuickAddList }) => {
  const t = translations[lang];
  const isRTL = lang === "ar";
  const listConfig = db.lists;

  const [pid, setPid] = useState(() => suggestNextPatientID(db.operations));
  const [age, setAge] = useState<number | "">("");
  const [opDate, setOpDate] = useState(new Date().toISOString().split("T")[0]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const [surgeons, setSurgeons] = useState<string[]>([]);
  const [drain, setDrain] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline complications logged during intake
  const [comps, setComps] = useState<InlineComplication[]>([]);
  const [compOpen, setCompOpen] = useState(false);
  const [compType, setCompType] = useState(listConfig.complications[0] || "Seroma");
  const [compGrade, setCompGrade] = useState("I");
  const [compMgmt, setCompMgmt] = useState("");

  // Validation
  const [pidError, setPidError] = useState("");
  const [opDateError, setOpDateError] = useState("");

  const addChip = (value: string, list: string[], setter: (v: string[]) => void) => {
    const v = value.trim();
    if (!v) return;
    if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) setter([...list, v]);
  };
  const removeChip = (value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.filter((x) => x !== value));
  };

  const handleDateChange = (val: string) => {
    setOpDate(val);
    if (!val) {
      setOpDateError(isRTL ? "تاريخ العملية مطلوب" : "Operation date is required.");
      return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (new Date(val) > tomorrow) {
      setOpDateError(isRTL ? "لا يمكن أن يكون التاريخ في المستقبل" : "Operation date cannot be in the future.");
      return;
    }
    setOpDateError("");
  };

  const addComplicationRow = () => {
    if (!compType) return;
    setComps((prev) => [
      ...prev,
      { Complication: compType, Grade: compGrade, DateDetected: opDate, Management: compMgmt.trim() }
    ]);
    setCompMgmt("");
    setCompGrade("I");
    setCompOpen(false);
  };

  const resetForm = (nextOps: DBState["operations"]) => {
    setPid(suggestNextPatientID(nextOps));
    setAge("");
    setProcedures([]);
    setSurgeons([]);
    setDrain(false);
    setNotes("");
    setComps([]);
    setPidError("");
    setOpDateError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPid = pid.trim().toUpperCase();
    if (!cleanedPid) {
      setPidError(isRTL ? "معرف المريض مطلوب" : "Patient ID is required.");
      return;
    }
    if (!/^[A-Z0-9-]+$/.test(cleanedPid)) {
      setPidError(isRTL ? "أحرف وأرقام وشرطات فقط" : "Only letters, numbers and hyphens.");
      return;
    }
    if (opDateError || !opDate) {
      if (!opDate) setOpDateError(isRTL ? "تاريخ العملية مطلوب" : "Operation date is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payloadOps = [...db.operations, { PatientID: cleanedPid } as any];
      await onAddOperation({
        PatientID: cleanedPid,
        Age: age,
        OperationDate: opDate,
        Procedures: procedures,
        Surgeons: surgeons,
        DrainPlaced: drain,
        Notes: notes,
        complications: comps
      });
      resetForm(payloadOps);
    } catch {
      // toast already fired by the handler
    } finally {
      setSubmitting(false);
    }
  };

  const gradeOptions = ["I", "II", "IIIa", "IIIb", "IVa", "IVb", "V"];

  return (
    <div className="space-y-6 animate-fade-in" id="new-operation-view" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight">{t.newCaseTitle}</h2>
        <p className="text-sm text-white/60 mt-1">{t.newCaseSub}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
        <h3 className={`font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
          <PlusCircle className="w-4.5 h-4.5 text-brand-primary" /> {t.formIntakeTitle}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Patient ID */}
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t.patientId}</label>
            <input
              type="text"
              placeholder={t.patientIdPlaceholder}
              value={pid}
              onChange={(e) => {
                setPid(e.target.value);
                if (pidError) setPidError("");
              }}
              className={`w-full py-2 px-3 border ${pidError ? "border-rose-500" : "border-white/10 focus:border-brand-primary"} rounded-xl text-sm focus:outline-none bg-white/5 font-semibold text-white uppercase placeholder-white/30`}
              required
            />
            {pidError && <p className="text-rose-400 text-xs mt-1.5 font-semibold">⚠ {pidError}</p>}
          </div>

          {/* Age */}
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t.ageYears}</label>
            <input
              type="number"
              min="1"
              max="120"
              placeholder={t.agePlaceholder}
              value={age}
              onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
              className="w-full py-2 px-3 border border-white/10 focus:border-brand-primary rounded-xl text-sm focus:outline-none bg-white/5 text-white placeholder-white/30"
            />
          </div>

          {/* Operation date */}
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t.operationDate}</label>
            <input
              type="date"
              value={opDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`w-full py-2 px-3 border ${opDateError ? "border-rose-500" : "border-white/10 focus:border-brand-primary"} rounded-xl text-sm focus:outline-none bg-white/5 text-white`}
              required
            />
            {opDateError && <p className="text-rose-400 text-xs mt-1.5 font-semibold">⚠ {opDateError}</p>}
          </div>
        </div>

        {/* Procedures (multi) */}
        <ChipMultiSelect
          label={isRTL ? "العمليات الجراحية (أكثر من واحدة)" : "Procedures (add one or more)"}
          options={listConfig.procedures}
          selected={procedures}
          onAdd={(v) => addChip(v, procedures, setProcedures)}
          onRemove={(v) => removeChip(v, procedures, setProcedures)}
          onQuickAdd={async () => {
            const added = await onQuickAddList("procedures", "");
            if (added) addChip(added, procedures, setProcedures);
          }}
          placeholder={isRTL ? "اختر عملية لإضافتها" : "Select a procedure to add"}
        />

        {/* Surgeons (multi) */}
        <ChipMultiSelect
          label={isRTL ? "الجراحون (أكثر من واحد)" : "Surgeons (add one or more)"}
          options={listConfig.surgeons}
          selected={surgeons}
          onAdd={(v) => addChip(v, surgeons, setSurgeons)}
          onRemove={(v) => removeChip(v, surgeons, setSurgeons)}
          onQuickAdd={async () => {
            const added = await onQuickAddList("surgeons", "");
            if (added) addChip(added, surgeons, setSurgeons);
          }}
          placeholder={isRTL ? "اختر جراحاً لإضافته" : "Select a surgeon to add"}
          icon={<Stethoscope className="w-3.5 h-3.5 text-brand-primary" />}
        />

        {/* Drain + Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t.drainPlacedLabel}</label>
            <select
              value={drain ? "Yes" : "No"}
              onChange={(e) => setDrain(e.target.value === "Yes")}
              className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
            >
              <option value="No" className="bg-brand-bg text-white">No</option>
              <option value="Yes" className="bg-brand-bg text-white">Yes</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.notesLabel}</label>
              <VoiceInputButton lang={lang} onTranscript={(text) => setNotes((prev) => (prev ? prev + " " + text : text))} />
            </div>
            <textarea
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2.5 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30 min-h-[70px]"
            />
          </div>
        </div>

        {/* Inline complications */}
        <div className="border border-white/10 rounded-2xl p-4 bg-black/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              {isRTL ? "المضاعفات (اختياري)" : "Complications (optional)"}
            </span>
            {!compOpen && (
              <button
                type="button"
                onClick={() => setCompOpen(true)}
                className="text-xs font-semibold text-brand-primary-light hover:text-brand-primary flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> {isRTL ? "إضافة مضاعفة" : "Add complication"}
              </button>
            )}
          </div>

          {comps.length > 0 && (
            <div className="mt-3 space-y-2">
              {comps.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs">
                  <span className="text-white/90 font-semibold">
                    {c.Complication} <span className="text-white/40 font-mono">· Clavien {c.Grade}</span>
                    {c.Management ? <span className="text-white/40"> — {c.Management}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setComps(comps.filter((_, idx) => idx !== i))}
                    className="text-white/40 hover:text-rose-400 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {compOpen && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="sm:col-span-1">
                <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1">{isRTL ? "النوع" : "Type"}</label>
                <div className="flex gap-1">
                  <select
                    value={compType}
                    onChange={(e) => setCompType(e.target.value)}
                    className="flex-1 py-1.5 px-2 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                  >
                    {listConfig.complications.map((c) => (
                      <option key={c} value={c} className="bg-brand-bg text-white">{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const added = await onQuickAddList("complications", "");
                      if (added) setCompType(added);
                    }}
                    className="px-2 border border-white/10 hover:border-brand-primary text-white/60 hover:text-white rounded-lg bg-white/5 text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1">{isRTL ? "الدرجة" : "Grade"}</label>
                <select
                  value={compGrade}
                  onChange={(e) => setCompGrade(e.target.value)}
                  className="w-full py-1.5 px-2 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                >
                  {gradeOptions.map((g) => (
                    <option key={g} value={g} className="bg-brand-bg text-white">{g}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1">{isRTL ? "الإدارة" : "Management"}</label>
                <input
                  type="text"
                  value={compMgmt}
                  onChange={(e) => setCompMgmt(e.target.value)}
                  placeholder={isRTL ? "اختياري" : "optional"}
                  className="w-full py-1.5 px-2 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={addComplicationRow}
                  className="flex-1 py-1.5 px-2 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {isRTL ? "إضافة" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setCompOpen(false)}
                  className="py-1.5 px-2 border border-white/10 text-white/50 rounded-lg text-xs cursor-pointer hover:bg-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`flex pt-2 border-t border-white/10 ${isRTL ? "justify-start" : "justify-end"}`}>
          <button
            type="submit"
            disabled={submitting || !pid.trim() || !!opDateError}
            className="bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 text-white py-2.5 px-6 rounded-xl font-semibold text-sm transition-colors cursor-pointer border border-brand-primary/20 shadow-lg"
          >
            {submitting ? t.savingCase : t.saveCaseBtn}
          </button>
        </div>
      </form>
    </div>
  );
};
