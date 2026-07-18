import React, { useState, useEffect } from "react";
import { DBState, Complication } from "../types";
import { fmt } from "../utils";
import { AlertTriangle, Plus, Pencil, CheckCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { translations } from "../translations";
import { VoiceInputButton } from "./VoiceInputButton";

interface ComplicationsRegistryProps {
  db: DBState;
  lang?: "en" | "ar";
  onAddComplication: (comp: {
    PatientID: string;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
  }) => Promise<void>;
  onResolveComplication: (id: string) => Promise<void>;
  onOpenCompEdit: (id: string) => void;
  onOpenDrawer: (pid: string) => void;
  onQuickAddList: (kind: "complications", selectId: string) => Promise<string | undefined>;
}

export const ComplicationsRegistry: React.FC<ComplicationsRegistryProps> = ({
  db,
  lang = "en",
  onAddComplication,
  onResolveComplication,
  onOpenCompEdit,
  onOpenDrawer,
  onQuickAddList
}) => {
  const [pidInput, setPidInput] = useState("");
  const [whatInput, setWhatInput] = useState("");
  const [gradeInput, setGradeInput] = useState("Grade I");
  const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [mgmtInput, setMgmtInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Search, filter & pagination state
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Validation Warnings
  const [dateWarning, setDateWarning] = useState("");

  const complications = db.complications;
  const listConfig = db.lists;
  const ops = db.operations;
  const t = translations[lang];
  const isRTL = lang === "ar";

  // Sync default options
  useEffect(() => {
    if (listConfig.complications && listConfig.complications.length > 0 && !whatInput) {
      setWhatInput(listConfig.complications[0]);
    }
  }, [listConfig, whatInput]);

  useEffect(() => {
    if (ops.length > 0 && !pidInput) {
      setPidInput(ops[0].PatientID);
    }
  }, [ops, pidInput]);

  // Strict Date detected check vs original Operation Date
  useEffect(() => {
    if (!pidInput || !dateInput) {
      setDateWarning("");
      return;
    }
    const matchingOp = ops.find(o => o.PatientID.toUpperCase() === pidInput.toUpperCase());
    if (matchingOp) {
      const opDateObj = new Date(matchingOp.OperationDate);
      const compDateObj = new Date(dateInput);
      if (compDateObj < opDateObj) {
        setDateWarning(
          isRTL
            ? `تنبيه: تاريخ الاكتشاف يسبق تاريخ العملية الجراحية (${matchingOp.OperationDate}) لهذا المريض.`
            : `Warning: Complication date is earlier than the original procedure date (${matchingOp.OperationDate}).`
        );
      } else {
        setDateWarning("");
      }
    } else {
      setDateWarning("");
    }
  }, [pidInput, dateInput, ops, isRTL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pidInput) return;

    // Strict validation blocks
    const matchingOp = ops.find(o => o.PatientID.toUpperCase() === pidInput.toUpperCase());
    if (matchingOp && new Date(dateInput) < new Date(matchingOp.OperationDate)) {
      setDateWarning(
        isRTL
          ? `خطأ: لا يمكن تسجيل مضاعفة قبل تاريخ العملية الجراحية (${matchingOp.OperationDate}).`
          : `Error: Complication cannot precede the original procedure date (${matchingOp.OperationDate}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      await onAddComplication({
        PatientID: pidInput,
        Complication: whatInput || "Other",
        Grade: gradeInput,
        DateDetected: dateInput,
        Management: mgmtInput
      });
      setMgmtInput("");
      setDateWarning("");
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  // Search Filter
  const filteredComps = complications.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.PatientID.toLowerCase().includes(q) ||
      c.Complication.toLowerCase().includes(q) ||
      (c.Management || "").toLowerCase().includes(q)
    );
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredComps.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedComps = filteredComps.slice(startIndex, startIndex + rowsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  return (
    <div className="space-y-6 animate-fade-in" id="complications-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className={isRTL ? "text-right" : "text-left"}>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
          <span>{t.tabComplications}</span>
        </h2>
        <p className="text-sm text-white/60 mt-1">
          {isRTL
            ? "سجل جرد للمضاعفات الجراحية. تتطابق الدرجات مع تصنيف كلافين-ديندو القياسي المعتمد."
            : "Detailed log of surgical complication events. Grades correspond to the Clavien-Dindo standard classification system."}
        </p>
      </div>

      {/* Log Complication Panel Form */}
      <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
        <h3 className={`font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-1.5 mb-5 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
          <AlertTriangle className="w-4 h-4 text-rose-400" /> {t.quickAddComp}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                {t.patientId}
              </label>
              <select
                value={pidInput}
                onChange={(e) => setPidInput(e.target.value)}
                className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                required
              >
                {ops.length === 0 && (
                  <option value="">{isRTL ? "لا توجد عمليات مسجلة" : "No operations logged"}</option>
                )}
                {ops.map((o) => (
                  <option key={o.id} value={o.PatientID} className="bg-brand-bg text-white">
                    {o.PatientID} ({o.Procedure})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                {t.compType}
              </label>
              <div className="flex gap-1.5">
                <select
                  id="c-what-select"
                  value={whatInput}
                  onChange={(e) => setWhatInput(e.target.value)}
                  className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                >
                  {listConfig.complications.map((c) => (
                    <option key={c} value={c} className="bg-brand-bg text-white">
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    const added = await onQuickAddList("complications", "c-what-select");
                    if (added) setWhatInput(added);
                  }}
                  className="py-1 px-2.5 border border-white/10 hover:border-brand-primary text-white/60 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                {t.gradeLabel} (Clavien Grade)
              </label>
              <select
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
              >
                <option value="Grade I" className="bg-brand-bg text-white">Grade I</option>
                <option value="Grade II" className="bg-brand-bg text-white">Grade II</option>
                <option value="Grade IIIa" className="bg-brand-bg text-white">Grade IIIa</option>
                <option value="Grade IIIb" className="bg-brand-bg text-white">Grade IIIb</option>
                <option value="Grade IVa" className="bg-brand-bg text-white">Grade IVa</option>
                <option value="Grade IVb" className="bg-brand-bg text-white">Grade IVb</option>
                <option value="Grade V" className="bg-brand-bg text-white">Grade V</option>
              </select>
            </div>

            <div>
              <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                {t.dateDetectedLabel}
              </label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className={`w-full py-2 px-3 border ${dateWarning ? "border-rose-500 focus:border-rose-500" : "border-white/10 focus:border-brand-primary"} rounded-xl text-sm focus:outline-none bg-white/5 text-white`}
                required
              />
            </div>
          </div>

          {dateWarning && (
            <p className={`text-rose-400 text-xs mt-1.5 font-semibold ${isRTL ? "text-right" : "text-left"}`}>
              ⚠ {dateWarning}
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-[10px] font-bold text-white/40 uppercase tracking-wider ${isRTL ? "text-right" : "text-left"}`}>
                {t.managementLabel}
              </label>
              <VoiceInputButton
                lang={lang}
                onTranscript={(text) => setMgmtInput((prev) => prev ? prev + " " + text : text)}
              />
            </div>
            <input
              type="text"
              value={mgmtInput}
              onChange={(e) => setMgmtInput(e.target.value)}
              placeholder={t.managementPlaceholder}
              className="w-full py-2.5 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30"
            />
          </div>

          <div className={`flex flex-col sm:flex-row gap-3 pt-2 ${isRTL ? "sm:justify-start" : "sm:justify-end"}`}>
            <button
              type="submit"
              disabled={submitting || ops.length === 0}
              className="bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 disabled:cursor-default text-white py-2.5 px-6 rounded-xl font-semibold text-sm transition-colors cursor-pointer border border-brand-primary/20 shadow-lg text-center"
            >
              {submitting ? (isRTL ? "جاري الحفظ..." : "Logging...") : t.submitBtn}
            </button>
          </div>
        </div>
      </form>

      {/* Registry Table Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-display font-semibold text-white text-base">{isRTL ? "سجل تتبع المضاعفات" : "Complications Log"}</h3>
          
          <div className="relative w-full sm:w-64">
            <Search className={`absolute top-2.5 w-4 h-4 text-white/40 ${isRTL ? "left-3" : "right-3"}`} />
            <input
              type="text"
              placeholder={isRTL ? "بحث عن مريض، تصنيف..." : "Search complications..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/30 text-xs py-2 px-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Mobile Stack View */}
        <div className="block md:hidden divide-y divide-white/10">
          {paginatedComps.length > 0 ? (
            paginatedComps.map((c) => (
              <div key={c.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenDrawer(c.PatientID)}
                      className="font-mono text-xs font-bold text-brand-primary-light border-b border-dashed border-brand-primary hover:border-solid transition-all text-left cursor-pointer"
                    >
                      {c.PatientID}
                    </button>
                    <span className="text-white/40">•</span>
                    <span className="text-xs text-white/50">{fmt(c.DateDetected)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenCompEdit(c.id)}
                      title="Edit entry"
                      className="p-1.5 border border-white/10 rounded-lg hover:border-brand-primary text-white/60 hover:text-white bg-white/5 transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm flex items-start gap-1.5 justify-between">
                    <span>{c.Complication}</span>
                    <span className="font-bold text-rose-400 font-display text-xs bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/15">{c.Grade}</span>
                  </h4>
                  {c.Management && (
                    <div className="text-xs text-white/70 mt-2 font-mono leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                      <span className="text-white/40 uppercase tracking-wider text-[9px] block mb-0.5">Management:</span>
                      {c.Management}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    {c.Resolved === "Yes" ? (
                      <span className="inline-block bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                        {isRTL ? `تم الحل (${fmt(c.ResolvedDate)})` : `Resolved (${fmt(c.ResolvedDate)})`}
                      </span>
                    ) : (
                      <span className="inline-block bg-amber-950/60 text-amber-300 border border-amber-500/30 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                        {isRTL ? "مفتوحة" : "Open Event"}
                      </span>
                    )}
                  </div>

                  {c.Resolved !== "Yes" && (
                    <button
                      onClick={() => onResolveComplication(c.id)}
                      className="bg-brand-primary/10 hover:bg-brand-primary/15 border border-brand-primary/20 text-brand-primary-light font-bold text-xs py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {isRTL ? "تم الحل" : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-white/40 text-sm">
              {isRTL ? "لا توجد مضاعفات مسجلة تطابق البحث. ✓" : "No complication events match search criteria. ✓"}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" dir={isRTL ? "rtl" : "ltr"}>
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/40 font-bold text-[10.5px] uppercase tracking-wider">
                <th className="py-3 px-6 text-center w-20">{t.actionsCol}</th>
                <th className="py-3 px-6">{t.patientId}</th>
                <th className="py-3 px-6">{t.compType}</th>
                <th className="py-3 px-6 text-center">{t.gradeLabel}</th>
                <th className="py-3 px-6">{t.dateDetectedLabel}</th>
                <th className="py-3 px-6">{t.managementLabel}</th>
                <th className="py-3 px-6 text-center">{isRTL ? "الحالة" : "Status"}</th>
                <th className="py-3 px-6 text-right">{isRTL ? "تأكيد الحل" : "Resolve"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {paginatedComps.length > 0 ? (
                paginatedComps.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => onOpenCompEdit(c.id)}
                        title="Edit entry"
                        className="p-1.5 border border-white/10 rounded-lg hover:border-brand-primary hover:text-brand-primary-light hover:bg-white/10 transition-all text-white/60 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="py-3.5 px-6">
                      <button
                        onClick={() => onOpenDrawer(c.PatientID)}
                        className="font-mono text-xs font-bold text-brand-primary-light hover:text-brand-primary border-b border-dashed border-brand-primary hover:border-solid transition-all text-left cursor-pointer"
                      >
                        {c.PatientID}
                      </button>
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-white">{c.Complication}</td>
                    <td className="py-3.5 px-6 text-center font-bold text-rose-400 font-display">{c.Grade}</td>
                    <td className="py-3.5 px-6">{fmt(c.DateDetected)}</td>
                    <td className="py-3.5 px-6 max-w-xs truncate" title={c.Management || "—"}>
                      {c.Management || "—"}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      {c.Resolved === "Yes" ? (
                        <span className="inline-block bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20 py-0.5 px-2 rounded-full text-xs font-semibold">
                          {isRTL ? "تم الحل" : "Resolved"}
                        </span>
                      ) : (
                        <span className="inline-block bg-amber-950/60 text-amber-300 border border-amber-500/30 py-0.5 px-2 rounded-full text-xs font-semibold">
                          {isRTL ? "نشط" : "Open Event"}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {c.Resolved === "Yes" ? (
                        <span className="text-xs text-white/40 font-semibold">{isRTL ? `حُل في ${fmt(c.ResolvedDate)}` : `Fixed ${fmt(c.ResolvedDate)}`}</span>
                      ) : (
                        <button
                          onClick={() => onResolveComplication(c.id)}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-brand-primary-light font-bold text-xs py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {isRTL ? "حل" : "Resolve"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-white/40 text-sm">
                    {isRTL ? "لا توجد مضاعفات مسجلة تطابق البحث. ✓" : "No complications recorded yet. ✓"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60" dir={isRTL ? "rtl" : "ltr"}>
          <span>
            {isRTL 
              ? `عرض مضاعفات ${filteredComps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} إلى ${Math.min(safeCurrentPage * rowsPerPage, filteredComps.length)} من أصل ${filteredComps.length}` 
              : `Showing ${filteredComps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} to ${Math.min(safeCurrentPage * rowsPerPage, filteredComps.length)} of ${filteredComps.length} entries`}
          </span>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>{t.showRowsLabel}:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#08221E] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
              >
                {[5, 10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                className="py-1.5 px-3 border border-white/10 hover:border-white/20 disabled:opacity-40 disabled:hover:border-white/10 bg-white/5 disabled:bg-transparent text-white rounded-lg transition-all cursor-pointer flex items-center gap-1 min-h-[38px] touch-manipulation"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t.prevPageBtn}</span>
              </button>
              <span className="font-semibold text-white px-2">
                {t.pageOfText} {safeCurrentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                className="py-1.5 px-3 border border-white/10 hover:border-white/20 disabled:opacity-40 disabled:hover:border-white/10 bg-white/5 disabled:bg-transparent text-white rounded-lg transition-all cursor-pointer flex items-center gap-1 min-h-[38px] touch-manipulation"
              >
                <span>{t.nextPageBtn}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
