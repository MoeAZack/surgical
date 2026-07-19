import React, { useRef, useState } from "react";
import { DBState } from "../types";
import { fmt, daysInSitu, addMonths, isFollowUpLate } from "../utils";
import { X, Pencil, CheckCircle2, Calendar, Droplet, AlertCircle, Bookmark, PlusCircle, Camera, ImagePlus, Trash2 } from "lucide-react";
import { translations } from "../translations";
import { AuthedImage } from "./AuthedImage";

const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

interface PatientTimelineDrawerProps {
  caseId: string | null;
  db: DBState;
  lang: "en" | "ar";
  onClose: () => void;
  onOpenEdit: (id: string) => void;
  onToggleCheckItem: (operationId: string, item: string, done: boolean) => Promise<void>;
  onAddComplication: (comp: {
    OperationID: string;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
  }) => Promise<void>;
  onUploadPhoto: (payload: { OperationID: string; filename: string; mimeType: string; dataBase64: string }) => Promise<void>;
  onDeletePhoto: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export const PatientTimelineDrawer: React.FC<PatientTimelineDrawerProps> = ({
  caseId,
  db,
  lang,
  onClose,
  onOpenEdit,
  onToggleCheckItem,
  onAddComplication,
  onUploadPhoto,
  onDeletePhoto,
  readOnly = false
}) => {
  const [showAddComp, setShowAddComp] = useState(false);
  const [compName, setCompName] = useState("");
  const [compGrade, setCompGrade] = useState("I");
  const [compDate, setCompDate] = useState(new Date().toISOString().split("T")[0]);
  const [compManagement, setCompManagement] = useState("");
  const [submittingComp, setSubmittingComp] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];
  const isRTL = lang === "ar";

  React.useEffect(() => {
    if (db.lists.complications && db.lists.complications.length > 0 && !compName) {
      setCompName(db.lists.complications[0]);
    }
  }, [db.lists.complications, compName]);

  if (!caseId) return null;

  const o = db.operations.find((op) => op.id === caseId);
  if (!o) return null;

  const rem = db.drains.find((d) => d.OperationID === o.id);
  const checklistItems = db.lists.checklistItems;
  const myChecks = db.checks.filter((c) => c.OperationID === o.id && c.Done === "Yes");
  const checkedNames = new Set(myChecks.map((c) => c.Item));

  const myAppts = db.appointments
    .filter((a) => a.PatientID === o.PatientID)
    .sort((a, b) => `${a.Date} ${a.Time}`.localeCompare(`${b.Date} ${b.Time}`));

  const cs = db.complications.filter((c) => c.OperationID === o.id);
  const photos = db.photos.filter((p) => p.OperationID === o.id);

  const f = db.followup.find((fu) => fu.OperationID === o.id) || {
    M1: "—",
    M3: "—",
    M6: "—",
    M12: "—",
    FinalOutcome: "Ongoing"
  };

  const milestones = [
    { key: "M1", label: lang === "en" ? "1 month" : "شهر واحد", months: db.config.FU1 },
    { key: "M3", label: lang === "en" ? "3 months" : "٣ أشهر", months: db.config.FU2 },
    { key: "M6", label: lang === "en" ? "6 months" : "٦ أشهر", months: db.config.FU3 },
    { key: "M12", label: lang === "en" ? "12 months" : "١٢ شهراً", months: db.config.FU4 }
  ];

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: isRTL ? "الملفات المدعومة صور فقط." : "Only image files are supported.", isError: true } }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: isRTL ? "يجب أن تكون الصورة أقل من 6 ميغابايت." : "Image must be under 6MB.", isError: true } }));
      return;
    }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        await onUploadPhoto({ OperationID: o.id, filename: file.name, mimeType: file.type, dataBase64: base64 });
      } catch {
        // toast already fired by the parent handler
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.onerror = () => setUploadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const handleLogComplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName) return;

    setSubmittingComp(true);
    try {
      await onAddComplication({
        OperationID: o.id,
        Complication: compName,
        Grade: compGrade,
        DateDetected: compDate,
        Management: compManagement
      });
      setShowAddComp(false);
      setCompManagement("");
    } catch {
      // Handled
    } finally {
      setSubmittingComp(false);
    }
  };

  return (
    <>
      {/* Overlay background */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 bottom-0 w-full max-w-[460px] bg-brand-bg/95 backdrop-blur-xl z-50 shadow-2xl overflow-y-auto flex flex-col justify-between border-white/10 text-white ${
          isRTL ? "left-0 border-r" : "right-0 border-l"
        }`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div>
          {/* Header */}
          <div className="bg-gradient-to-br from-brand-primary/40 to-[#0B1E1B]/90 border-b border-white/10 p-6 relative">
            <button
              onClick={onClose}
              className={`absolute top-5 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                isRTL ? "left-5" : "right-5"
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <span className={`font-mono text-xs font-bold text-brand-primary-light tracking-wider uppercase block ${isRTL ? "text-right" : "text-left"}`}>
              {t.patientTimeline}
            </span>
            <h3 className={`font-display font-bold text-2xl mt-1 tracking-tight ${isRTL ? "text-right" : "text-left"}`}>{o.PatientID}</h3>
            <p className={`font-display font-medium text-white/80 mt-1 ${isRTL ? "text-right" : "text-left"}`}>{o.Procedure}</p>

            <div className={`text-xs text-white/60 mt-4 space-y-1 ${isRTL ? "text-right" : "text-left"}`}>
              <div>
                {t.ageText}: <span className="text-white font-semibold">{o.Age || "—"}</span>
              </div>
              <div>
                {t.operatedText}: <span className="text-white font-semibold">{fmt(o.OperationDate)}</span>
              </div>
              <div>
                {t.surgeonText}: <span className="text-white font-semibold">{o.Surgeon || "—"}</span>
              </div>
            </div>

            <div className={`flex gap-2.5 mt-5 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <button
                onClick={() => {
                  onClose();
                  onOpenEdit(o.id);
                }}
                className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold py-1.5 px-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-brand-primary" />
                {t.editCaseBtn}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 divide-y divide-white/10">
            {/* Checklist */}
            <div className="pt-0 first:pt-0">
              <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 mb-3 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" /> {t.prePostChecklist}
              </h4>
              <div className="space-y-2">
                {checklistItems.map((item) => {
                  const isChecked = checkedNames.has(item);
                  return (
                    <label
                      key={item}
                      className={`flex items-center gap-2.5 p-2.5 border border-white/10 rounded-xl hover:bg-white/5 cursor-pointer text-xs font-semibold text-white/80 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onToggleCheckItem(o.id, item, e.target.checked)}
                        className="w-4.5 h-4.5 accent-brand-primary rounded cursor-pointer"
                      />
                      <span>{item}</span>
                    </label>
                  );
                })}
                {checklistItems.length === 0 && <p className="text-white/40 italic text-xs">{t.noCompsLogged}</p>}
              </div>
            </div>

            {/* Appointments */}
            <div className="pt-5">
              <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 mb-3 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Calendar className="w-3.5 h-3.5 text-brand-primary" /> {t.clinicVisits}
              </h4>
              <div className="space-y-2">
                {myAppts.map((a) => (
                  <div key={a.id} className={`p-3 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center text-xs ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={isRTL ? "text-right" : "text-left"}>
                      <span className="font-semibold text-white font-display block">{a.Type}</span>
                      <span className="text-white/40 text-[10px] mt-0.5 inline-block">
                        {fmt(a.Date)} {a.Time ? `${isRTL ? "الساعة" : "at"} ${a.Time}` : ""}
                      </span>
                    </div>
                    <span className="font-bold text-[10px] uppercase py-0.5 px-2 bg-white/5 border border-white/10 text-white/60 rounded">
                      {a.Status}
                    </span>
                  </div>
                ))}
                {myAppts.length === 0 && <p className="text-white/40 italic text-xs">{t.noApptsBooked}</p>}
              </div>
            </div>

            {/* Drain */}
            <div className="pt-5">
              <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 mb-3 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Droplet className="w-3.5 h-3.5 text-rose-400" /> {t.activeDrainTracking}
              </h4>
              {o.DrainPlaced === "Yes" ? (
                <div className="bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl space-y-2 text-xs">
                  <div className={`flex justify-between ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-white/60">{t.placedDate}</span>
                    <span className="font-semibold text-white">{fmt(o.OperationDate)}</span>
                  </div>
                  <div className={`flex justify-between ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-white/60">{t.removalStatus}</span>
                    <span className={`font-bold ${rem ? "text-white/60" : "text-rose-400"}`}>
                      {rem ? `${t.removedOn} ${fmt(rem.RemovedDate)}` : t.inSituText}
                    </span>
                  </div>
                  <div className={`flex justify-between border-t border-rose-500/10 pt-2 mt-2 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-white/60">{t.totalDaysInSitu}</span>
                    <span className="font-display font-bold text-sm text-rose-400">{daysInSitu(o, db.drains)} {t.days}</span>
                  </div>
                </div>
              ) : (
                <p className="text-white/40 italic text-xs">{t.noDrainsReported}</p>
              )}
            </div>

            {/* Photos */}
            <div className="pt-5">
              <div className={`flex items-center justify-between mb-3 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Camera className="w-3.5 h-3.5 text-brand-primary" /> {isRTL ? "الصور السريرية" : "Clinical Photos"}
                </h4>
                {!readOnly && (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    title={isRTL ? "إضافة صورة" : "Add photo"}
                    className="p-1 rounded-lg border border-white/10 text-brand-primary hover:text-brand-primary-hover hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <ImagePlus className="w-4.5 h-4.5" />
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
              </div>

              {uploadingPhoto && (
                <p className="text-[10.5px] text-white/50 italic mb-2">{isRTL ? "جارٍ الرفع..." : "Uploading…"}</p>
              )}

              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5">
                      <AuthedImage
                        src={`/api/photos/${p.id}`}
                        alt={p.filename}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreviewPhotoId(p.id)}
                      />
                      {!readOnly && (
                        <button
                          onClick={() => onDeletePhoto(p.id)}
                          title={isRTL ? "حذف" : "Delete"}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/40 italic text-xs">{isRTL ? "لا توجد صور مرفوعة." : "No photos uploaded yet."}</p>
              )}
            </div>

            {/* Complications */}
            <div className="pt-5">
              <div className={`flex items-center justify-between mb-3 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> {t.loggedCompsTitle}
                </h4>
                <button
                  onClick={() => setShowAddComp(!showAddComp)}
                  title={t.quickAddComp}
                  className="p-1 rounded-lg border border-white/10 text-brand-primary hover:text-brand-primary-hover hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Inline Quick Add Complication Form */}
              {showAddComp && (
                <form onSubmit={handleLogComplication} className="mb-4 p-3.5 border border-white/10 rounded-xl bg-white/5 space-y-3">
                  <div>
                    <label className={`block text-[9px] font-bold text-white/40 uppercase mb-1 ${isRTL ? "text-right" : "text-left"}`}>
                      {t.compType}
                    </label>
                    <select
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      className="w-full py-1.5 px-2 border border-white/10 rounded-lg text-xs bg-brand-bg text-white"
                    >
                      {db.lists.complications.map((c) => (
                        <option key={c} value={c} className="bg-brand-bg text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[9px] font-bold text-white/40 uppercase mb-1 ${isRTL ? "text-right" : "text-left"}`}>
                        {t.gradeLabel}
                      </label>
                      <select
                        value={compGrade}
                        onChange={(e) => setCompGrade(e.target.value)}
                        className="w-full py-1.5 px-2 border border-white/10 rounded-lg text-xs bg-brand-bg text-white"
                      >
                        {["I", "II", "IIIa", "IIIb", "IVa", "IVb", "V"].map((g) => (
                          <option key={g} value={g} className="bg-brand-bg text-white">
                            Grade {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[9px] font-bold text-white/40 uppercase mb-1 ${isRTL ? "text-right" : "text-left"}`}>
                        {t.dateDetectedLabel}
                      </label>
                      <input
                        type="date"
                        value={compDate}
                        onChange={(e) => setCompDate(e.target.value)}
                        className="w-full py-1 px-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[9px] font-bold text-white/40 uppercase mb-1 ${isRTL ? "text-right" : "text-left"}`}>
                      {t.managementLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={t.managementPlaceholder}
                      value={compManagement}
                      onChange={(e) => setCompManagement(e.target.value)}
                      className="w-full py-1.5 px-2.5 border border-white/10 rounded-lg text-xs bg-white/5 text-white"
                    />
                  </div>
                  <div className={`flex justify-end gap-1.5 pt-1 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                    <button
                      type="button"
                      onClick={() => setShowAddComp(false)}
                      className="py-1 px-2.5 border border-white/10 rounded-lg text-[10.5px] font-semibold text-white/60 hover:text-white cursor-pointer hover:bg-white/5 transition-all"
                    >
                      {t.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={submittingComp}
                      className="py-1 px-3 bg-brand-primary hover:bg-brand-primary-hover rounded-lg text-[10.5px] font-bold text-white cursor-pointer border border-brand-primary/20 shadow"
                    >
                      {submittingComp ? "..." : t.submitBtn}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {cs.map((x) => (
                  <div key={x.id} className={`p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs flex justify-between items-start ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={isRTL ? "text-right" : "text-left"}>
                      <span className="font-bold text-white block">
                        {x.Complication} • Clavien {x.Grade}
                      </span>
                      {x.Management && <span className="text-white/60 block text-[10.5px] mt-0.5">{x.Management}</span>}
                    </div>
                    <span
                      className={`font-semibold py-0.5 px-2 rounded-full text-[9px] ${
                        x.Resolved === "Yes"
                          ? "bg-brand-primary/10 border border-brand-primary/20 text-brand-primary-light"
                          : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
                      }`}
                    >
                      {x.Resolved === "Yes" ? (isRTL ? "تم حلها" : "Resolved") : (isRTL ? "مفتوحة" : "Open")}
                    </span>
                  </div>
                ))}
                {cs.length === 0 && <p className="text-white/40 italic text-xs">{t.noCompsLogged}</p>}
              </div>
            </div>

            {/* Follow-up milestones */}
            <div className="pt-5">
              <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 mb-3 flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Bookmark className="w-3.5 h-3.5 text-brand-primary" /> {t.milestoneReview}
              </h4>
              <div className="space-y-2 text-xs">
                {milestones.map(({ key, label, months }) => {
                  const val = (f as any)[key] || "—";
                  const isLate = isFollowUpLate(o, f as any, key as any, months);
                  const due = o.OperationDate ? addMonths(o.OperationDate, months) : null;

                  return (
                    <div key={key} className={`flex justify-between items-center py-2 border-b border-white/5 last:border-none ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={isRTL ? "text-right" : "text-left"}>
                        <span className="font-semibold text-white/80 block">{label}</span>
                        {due && (
                          <span className={`text-[10px] ${isLate ? "text-rose-400 font-bold" : "text-white/40"}`}>
                            {isLate ? t.milestoneOverdue : t.milestoneDue} {fmt(due)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-display font-bold text-xs ${
                          isLate ? "text-rose-400" : val !== "—" ? "text-brand-primary-light" : "text-white/40"
                        }`}
                      >
                        {isLate ? (isRTL ? "متأخرة" : "OVERDUE") : val}
                      </span>
                    </div>
                  );
                })}

                <div className={`flex justify-between items-center py-2.5 border-t border-white/10 mt-3 font-semibold text-xs ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                  <span className="text-white/80 font-bold">{t.finalOutcomeStatus}</span>
                  <span
                    className={`py-1 px-3 rounded-xl font-display font-bold border ${
                      f.FinalOutcome === "Success"
                        ? "bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20"
                        : f.FinalOutcome === "Ongoing"
                        ? "bg-white/5 text-white border-white/10"
                        : "bg-rose-950/40 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {f.FinalOutcome === "Success" && isRTL ? "ناجحة" : f.FinalOutcome === "Ongoing" && isRTL ? "مستمرة" : f.FinalOutcome}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {o.Notes && (
              <div className="pt-5 pb-8">
                <h4 className={`font-display font-bold text-[10.5px] uppercase tracking-wider text-white/40 mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                  {t.clinicalNotes}
                </h4>
                <p className={`text-xs text-white/80 leading-normal whitespace-pre-wrap bg-white/5 p-3.5 rounded-xl border border-white/10 ${isRTL ? "text-right" : "text-left"}`}>
                  {o.Notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Photo lightbox */}
      {previewPhotoId && (
        <div
          className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6"
          onClick={() => setPreviewPhotoId(null)}
        >
          <button
            onClick={() => setPreviewPhotoId(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <AuthedImage
            src={`/api/photos/${previewPhotoId}`}
            alt="Clinical photo"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
};
