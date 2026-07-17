import React, { useState, useEffect } from "react";
import { DBState, CaseDraft } from "../types";
import { translations } from "../translations";
import { Trash2, Send, Edit2, Play, Archive, CheckCircle, Wifi, AlertCircle, User, Calendar, FolderPlus, X } from "lucide-react";
import { suggestNextPatientID } from "../utils";
import { VoiceInputButton } from "./VoiceInputButton";

interface DraftsQueueProps {
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
  onAddComplication: (comp: {
    PatientID: string;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
  }) => Promise<void>;
  onShowToast: (message: string, isError?: boolean) => void;
}

export const DraftsQueue: React.FC<DraftsQueueProps> = ({
  db,
  lang,
  onAddOperation,
  onAddComplication,
  onShowToast
}) => {
  const [drafts, setDrafts] = useState<CaseDraft[]>([]);
  const [editingDraft, setEditingDraft] = useState<CaseDraft | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null); // Draft ID being synced
  const [syncingAll, setSyncingAll] = useState(false);

  // Edit draft form fields
  const [editPid, setEditPid] = useState("");
  const [editAge, setEditAge] = useState<number | "">("");
  const [editOpDate, setEditOpDate] = useState("");
  const [editProcedure, setEditProcedure] = useState("");
  const [editSurgeon, setEditSurgeon] = useState("");
  const [editDrain, setEditDrain] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  // Complication fields (if type === "complication")
  const [editCompName, setEditCompName] = useState("");
  const [editCompGrade, setEditCompGrade] = useState("");
  const [editCompDate, setEditCompDate] = useState("");
  const [editCompMgmt, setEditCompMgmt] = useState("");

  // Inline Validation messages for Draft Edit
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const t = translations[lang];
  const isRTL = lang === "ar";

  // Load drafts on mount
  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = () => {
    try {
      const stored = localStorage.getItem("clinical_drafts");
      if (stored) {
        setDrafts(JSON.parse(stored));
      } else {
        setDrafts([]);
      }
    } catch {
      setDrafts([]);
    }
  };

  const saveDraftsToStorage = (newDrafts: CaseDraft[]) => {
    localStorage.setItem("clinical_drafts", JSON.stringify(newDrafts));
    setDrafts(newDrafts);
  };

  const handleDeleteDraft = (id: string) => {
    const updated = drafts.filter((d) => d.id !== id);
    saveDraftsToStorage(updated);
    onShowToast(isRTL ? "تم حذف المسودة." : "Draft discarded from queue.");
  };

  // Open Edit Mode
  const handleOpenEdit = (draft: CaseDraft) => {
    setEditingDraft(draft);
    setValidationErrors([]);

    // Populate operation fields
    setEditPid(draft.data.PatientID);
    setEditAge(draft.data.Age);
    setEditOpDate(draft.data.OperationDate);
    setEditProcedure(draft.data.Procedure);
    setEditSurgeon(draft.data.Surgeon);
    setEditDrain(draft.data.DrainPlaced);
    setEditNotes(draft.data.Notes || "");

    // Populate complication fields
    setEditCompName(draft.data.Complication || "");
    setEditCompGrade(draft.data.Grade || "Grade I");
    setEditCompDate(draft.data.DateDetected || "");
    setEditCompMgmt(draft.data.Management || "");
  };

  // Check unique Patient ID validation (for surgical cases only)
  const validateDraftData = (type: "operation" | "complication", patientID: string, ageVal: number | "", dateVal: string, compDateVal?: string): string[] => {
    const errors: string[] = [];

    // Patient ID checks
    if (!patientID.trim()) {
      errors.push(isRTL ? "معرف المريض مطلوب" : "Patient ID is required.");
    } else {
      const idPattern = /^[a-zA-Z0-9-]+$/;
      if (!idPattern.test(patientID)) {
        errors.push(isRTL ? "معرف المريض يجب أن يحتوي على أحرف وأرقام وشرطات فقط" : "Patient ID must contain only alphanumeric characters and hyphens.");
      }
      
      if (type === "operation") {
        const isDuplicate = db.operations.some(op => op.PatientID.toUpperCase() === patientID.trim().toUpperCase());
        if (isDuplicate) {
          errors.push(isRTL ? "معرف المريض هذا مسجل بالفعل في سجلات العيادة" : "This Patient ID already exists in clinical records.");
        }
      }
    }

    // Age check
    if (type === "operation" && ageVal !== "") {
      const numAge = Number(ageVal);
      if (isNaN(numAge) || numAge < 1 || numAge > 120) {
        errors.push(isRTL ? "العمر يجب أن يكون بين 1 و 120 سنة" : "Age must be a valid integer between 1 and 120.");
      }
    }

    // Operation Date check
    if (type === "operation") {
      if (!dateVal) {
        errors.push(isRTL ? "تاريخ العملية مطلوب" : "Operation Date is required.");
      } else {
        const selectedDate = new Date(dateVal);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (selectedDate > tomorrow) {
          errors.push(isRTL ? "لا يمكن لـ تاريخ العملية أن يكون في المستقبل البعيد" : "Operation Date cannot be set in the future.");
        }
      }
    }

    // Complication Checks
    if (type === "complication") {
      if (!compDateVal) {
        errors.push(isRTL ? "تاريخ اكتشاف المضاعفة مطلوب" : "Complication Date Detected is required.");
      } else {
        // Find corresponding operation date
        const matchingOp = db.operations.find(o => o.PatientID.toUpperCase() === patientID.trim().toUpperCase());
        if (matchingOp) {
          if (new Date(compDateVal) < new Date(matchingOp.OperationDate)) {
            errors.push(isRTL 
              ? `تاريخ اكتشاف المضاعفة لا يمكن أن يسبق تاريخ العملية (${matchingOp.OperationDate})` 
              : `Complication detected date cannot be earlier than the patient's Operation Date (${matchingOp.OperationDate}).`
            );
          }
        } else {
          errors.push(isRTL 
            ? "يجب أن يكون للمريض عملية مسجلة أولاً لإضافة مضاعفة له" 
            : "The Patient ID must exist in the clinical operations database before logging a complication draft."
          );
        }
      }
    }

    return errors;
  };

  // Save changes to draft
  const handleSaveDraftEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDraft) return;

    const currentType = editingDraft.type;
    const errors = validateDraftData(
      currentType,
      editPid,
      editAge,
      editOpDate,
      editCompDate
    );

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const updated = drafts.map((d) => {
      if (d.id === editingDraft.id) {
        return {
          ...d,
          data: {
            PatientID: editPid.trim().toUpperCase(),
            Age: editAge,
            OperationDate: editOpDate,
            Procedure: editProcedure || db.lists.procedures[0],
            Surgeon: editSurgeon || db.lists.surgeons[0],
            DrainPlaced: editDrain,
            Notes: editNotes,
            // complication:
            Complication: editCompName,
            Grade: editCompGrade,
            DateDetected: editCompDate,
            Management: editCompMgmt
          }
        };
      }
      return d;
    });

    saveDraftsToStorage(updated);
    setEditingDraft(null);
    onShowToast(isRTL ? "تم تحديث بيانات المسودة بنجاح! ✓" : "Draft updated successfully! ✓");
  };

  // Sync / Submit single draft
  const handleSyncDraft = async (draft: CaseDraft) => {
    // Perform validation check first
    const errors = validateDraftData(
      draft.type,
      draft.data.PatientID,
      draft.data.Age,
      draft.data.OperationDate,
      draft.data.DateDetected
    );

    if (errors.length > 0) {
      onShowToast(errors[0], true);
      handleOpenEdit(draft); // Open edit panel for correction
      return;
    }

    setSyncing(draft.id);
    try {
      if (draft.type === "operation") {
        await onAddOperation({
          PatientID: draft.data.PatientID,
          Age: draft.data.Age,
          OperationDate: draft.data.OperationDate,
          Procedure: draft.data.Procedure,
          Surgeon: draft.data.Surgeon,
          DrainPlaced: draft.data.DrainPlaced,
          Notes: draft.data.Notes
        });
      } else {
        await onAddComplication({
          PatientID: draft.data.PatientID,
          Complication: draft.data.Complication || "",
          Grade: draft.data.Grade || "Grade I",
          DateDetected: draft.data.DateDetected || "",
          Management: draft.data.Management || ""
        });
      }

      // Success, remove from draft queue
      const updated = drafts.filter((d) => d.id !== draft.id);
      saveDraftsToStorage(updated);
      onShowToast(t.draftSubmittedSuccess);
    } catch (err: any) {
      onShowToast(err.message || "Failed to submit draft.", true);
    } finally {
      setSyncing(null);
    }
  };

  // Sync / Submit all drafts
  const handleSyncAll = async () => {
    if (drafts.length === 0) return;
    setSyncingAll(true);

    let successCount = 0;
    const remainingDrafts = [...drafts];

    for (const draft of drafts) {
      // Validate
      const errors = validateDraftData(
        draft.type,
        draft.data.PatientID,
        draft.data.Age,
        draft.data.OperationDate,
        draft.data.DateDetected
      );

      if (errors.length > 0) {
        onShowToast(
          isRTL
            ? `خطأ في مسودة المريض ${draft.data.PatientID}: ${errors[0]}`
            : `Error in draft for ${draft.data.PatientID}: ${errors[0]}`,
          true
        );
        continue;
      }

      setSyncing(draft.id);
      try {
        if (draft.type === "operation") {
          await onAddOperation({
            PatientID: draft.data.PatientID,
            Age: draft.data.Age,
            OperationDate: draft.data.OperationDate,
            Procedure: draft.data.Procedure,
            Surgeon: draft.data.Surgeon,
            DrainPlaced: draft.data.DrainPlaced,
            Notes: draft.data.Notes
          });
        } else {
          await onAddComplication({
            PatientID: draft.data.PatientID,
            Complication: draft.data.Complication || "",
            Grade: draft.data.Grade || "Grade I",
            DateDetected: draft.data.DateDetected || "",
            Management: draft.data.Management || ""
          });
        }

        // Remove from local list
        const idx = remainingDrafts.findIndex(d => d.id === draft.id);
        if (idx > -1) {
          remainingDrafts.splice(idx, 1);
        }
        successCount++;
      } catch (err: any) {
        onShowToast(`Failed syncing draft ${draft.data.PatientID}: ${err.message}`, true);
        break; // Stop sequencing if connection fails or sheets is locked
      }
    }

    saveDraftsToStorage(remainingDrafts);
    setSyncing(null);
    setSyncingAll(false);

    if (successCount > 0) {
      onShowToast(
        isRTL
          ? `نجحت مزامنة ${successCount} مسودات بنجاح! ✓`
          : `Successfully synced ${successCount} drafts to clinical sheets database! ✓`
      );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="drafts-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRTL ? "text-right" : "text-left"}>
          <h2 className="text-3xl font-display font-semibold text-white tracking-tight flex items-center gap-2">
            <Archive className="w-8 h-8 text-emerald-400" />
            <span>{t.tabDraftsQueue}</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono py-0.5 px-2 rounded-full border border-emerald-500/20">
              {drafts.length}
            </span>
          </h2>
          <p className="text-sm text-white/60 mt-1">
            {isRTL 
              ? "إدارة الحالات والمضاعفات المحفوظة محلياً أثناء انقطاع الاتصال أو للإدخال السريع."
              : "Manage clinical files cached locally. Synchronize them securely to Google Sheets when ready."}
          </p>
        </div>

        {drafts.length > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className={`flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 px-5 rounded-xl font-semibold text-sm transition-all shadow-lg self-start sm:self-auto cursor-pointer border border-emerald-400/20 disabled:opacity-55 ${
              isRTL ? "flex-row-reverse" : ""
            }`}
          >
            <Wifi className={`w-4 h-4 ${syncingAll ? "animate-pulse" : ""}`} />
            <span>{syncingAll ? (isRTL ? "جاري المزامنة..." : "Syncing Queue...") : t.submitAllDraftsBtn}</span>
          </button>
        )}
      </div>

      {/* Main Drafts Cards Grid */}
      {drafts.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
          <h3 className="font-display font-bold text-white text-lg">{isRTL ? "قائمة المسودات فارغة" : "Pristine Queue"}</h3>
          <p className="text-sm text-white/50">{t.noDraftsMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {drafts.map((d) => {
            const isOp = d.type === "operation";
            const isCurrentSyncing = syncing === d.id;

            return (
              <div
                key={d.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden group"
              >
                {/* Draft Badge type */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20" />

                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className={`inline-block text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 rounded-full ${
                      isOp ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    }`}>
                      {isOp ? (isRTL ? "عملية جراحية" : "Surgical Intake") : (isRTL ? "مضاعفة جراحية" : "Complication Event")}
                    </span>
                    <h3 className="text-lg font-mono font-bold text-white mt-1 flex items-center gap-1.5">
                      {d.data.PatientID || "—"}
                    </h3>
                    <p className="text-xs text-white/40">
                      {isRTL ? "تاريخ الحفظ: " : "Saved on: "} {new Date(d.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", { hour12: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(d)}
                      disabled={syncingAll || isCurrentSyncing}
                      className="p-2 text-white/60 hover:text-white border border-white/10 hover:border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                      title={isRTL ? "تعديل المسودة" : "Edit Draft"}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(d.id)}
                      disabled={syncingAll || isCurrentSyncing}
                      className="p-2 text-rose-400/80 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 rounded-xl bg-white/5 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title={isRTL ? "حذف المسودة" : "Discard Draft"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Draft Content summary */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="space-y-1">
                    <span className="text-white/40 block">{isRTL ? "الطبيب الجراح:" : "Surgeon:"}</span>
                    <span className="text-white font-medium truncate block">{d.data.Surgeon || "—"}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-white/40 block">{isRTL ? "الإجراء الجراحي:" : "Procedure:"}</span>
                    <span className="text-white font-medium truncate block">{d.data.Procedure || "—"}</span>
                  </div>

                  {isOp ? (
                    <>
                      <div className="space-y-1">
                        <span className="text-white/40 block">{isRTL ? "التاريخ:" : "Date:"}</span>
                        <span className="text-white font-mono">{d.data.OperationDate || "—"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-white/40 block">{isRTL ? "الأنبوب؟" : "Drain?"}</span>
                        <span className="text-white font-medium">{d.data.DrainPlaced ? (isRTL ? "نعم" : "Yes") : (isRTL ? "لا" : "No")}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <span className="text-white/40 block">{isRTL ? "المضاعفة:" : "Complication:"}</span>
                        <span className="text-white font-medium text-rose-300 truncate block">{d.data.Complication || "—"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-white/40 block">{isRTL ? "التصنيف:" : "Grade:"}</span>
                        <span className="text-white font-medium text-rose-300">{d.data.Grade || "—"}</span>
                      </div>
                    </>
                  )}
                </div>

                {d.data.Notes && (
                  <p className="text-xs text-white/50 bg-white/5 p-2.5 rounded-lg border border-white/5 line-clamp-2">
                    {d.data.Notes}
                  </p>
                )}

                <div className="pt-2 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => handleSyncDraft(d)}
                    disabled={syncingAll || isCurrentSyncing}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isCurrentSyncing ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isCurrentSyncing ? (isRTL ? "جاري الإرسال..." : "Syncing...") : (isRTL ? "إرسال ومزامنة السجل" : "Sync to Sheet")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editing Modal Draft */}
      {editingDraft && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#09221E] border border-white/15 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setEditingDraft(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-display font-semibold text-white mb-2 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-emerald-400" />
              <span>{t.editDraftTitle}</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono py-0.5 px-2 rounded-full border border-emerald-500/20">
                {editingDraft.data.PatientID || "Draft"}
              </span>
            </h3>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="bg-rose-950/60 border border-rose-500/30 p-3.5 rounded-xl text-rose-200 text-xs space-y-1 mb-5">
                <span className="font-bold block">{t.validationErrorHeader}</span>
                <ul className="list-disc list-inside space-y-0.5 opacity-90">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSaveDraftEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                    {t.patientId}
                  </label>
                  <input
                    type="text"
                    value={editPid}
                    onChange={(e) => setEditPid(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-white/5 focus:outline-none focus:border-emerald-500 rounded-xl text-sm font-semibold text-white uppercase"
                    required
                  />
                </div>

                {editingDraft.type === "operation" ? (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.ageYears}
                      </label>
                      <input
                        type="number"
                        value={editAge}
                        onChange={(e) => setEditAge(e.target.value ? Number(e.target.value) : "")}
                        className="w-full py-2 px-3 border border-white/10 bg-white/5 focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.operationDate}
                      </label>
                      <input
                        type="date"
                        value={editOpDate}
                        onChange={(e) => setEditOpDate(e.target.value)}
                        className="w-full py-2 px-3 border border-white/10 bg-white/5 focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.drainPlacedLabel}
                      </label>
                      <select
                        value={editDrain ? "Yes" : "No"}
                        onChange={(e) => setEditDrain(e.target.value === "Yes")}
                        className="w-full py-2 px-3 border border-white/10 bg-[#0A2E2A] focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.procedureLabel}
                      </label>
                      <select
                        value={editProcedure}
                        onChange={(e) => setEditProcedure(e.target.value)}
                        className="w-full py-2 px-3 border border-white/10 bg-[#0A2E2A] focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                      >
                        {db.lists.procedures.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.surgeonLabel}
                      </label>
                      <select
                        value={editSurgeon}
                        onChange={(e) => setEditSurgeon(e.target.value)}
                        className="w-full py-2 px-3 border border-white/10 bg-[#0A2E2A] focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                      >
                        {db.lists.surgeons.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.compType}
                      </label>
                      <select
                        value={editCompName}
                        onChange={(e) => setEditCompName(e.target.value)}
                        className="w-full py-2 px-3 border border-white/10 bg-[#0A2E2A] focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                      >
                        {db.lists.complications.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.gradeLabel}
                      </label>
                      <select
                        value={editCompGrade}
                        onChange={(e) => setEditCompGrade(e.target.value)}
                        className="w-full py-2 px-3 border border-white/10 bg-[#0A2E2A] focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                      >
                        <option value="Grade I">Grade I</option>
                        <option value="Grade II">Grade II</option>
                        <option value="Grade IIIa">Grade IIIa</option>
                        <option value="Grade IIIb">Grade IIIb</option>
                        <option value="Grade IVa">Grade IVa</option>
                        <option value="Grade IVb">Grade IVb</option>
                        <option value="Grade V">Grade V</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1">
                        {t.dateDetectedLabel}
                      </label>
                      <input
                        type="date"
                        value={editCompDate}
                        onChange={(e) => setEditCompDate(e.target.value)}
                        className="w-full py-2 px-3 border border-white/10 bg-white/5 focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider">
                          {t.managementLabel}
                        </label>
                        <VoiceInputButton
                          lang={lang}
                          onTranscript={(text) => setEditCompMgmt((prev) => prev ? prev + " " + text : text)}
                        />
                      </div>
                      <textarea
                        value={editCompMgmt}
                        onChange={(e) => setEditCompMgmt(e.target.value)}
                        placeholder={t.managementPlaceholder}
                        className="w-full py-2.5 px-3 border border-white/10 bg-white/5 focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white min-h-[70px]"
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] uppercase font-bold text-white/50 tracking-wider">
                      {t.notesLabel}
                    </label>
                    <VoiceInputButton
                      lang={lang}
                      onTranscript={(text) => setEditNotes((prev) => prev ? prev + " " + text : text)}
                    />
                  </div>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t.notesPlaceholder}
                    className="w-full py-2.5 px-3 border border-white/10 bg-white/5 focus:outline-none focus:border-emerald-500 rounded-xl text-sm text-white min-h-[80px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingDraft(null)}
                  className="py-2.5 px-5 border border-white/10 hover:bg-white/5 hover:text-white rounded-xl text-sm text-white/80 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-6 rounded-xl text-sm cursor-pointer border border-emerald-400/20"
                >
                  {isRTL ? "حفظ التغييرات" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
