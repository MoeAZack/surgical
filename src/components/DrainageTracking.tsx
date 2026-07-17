import React, { useState, useEffect } from "react";
import { DBState, Operation } from "../types";
import { fmt, daysInSitu } from "../utils";
import { Droplet, Check, RefreshCw, Search, ChevronLeft, ChevronRight, MessageSquare, Send, X } from "lucide-react";
import { translations } from "../translations";

interface DrainageTrackingProps {
  db: DBState;
  lang?: "en" | "ar";
  onMarkRemoved: (pid: string) => Promise<void>;
  onUndoRemoval: (pid: string) => Promise<void>;
  onOpenDrawer: (pid: string) => void;
  onShowToast: (message: string, isError?: boolean) => void;
}

export const DrainageTracking: React.FC<DrainageTrackingProps> = ({
  db,
  lang = "en",
  onMarkRemoved,
  onUndoRemoval,
  onOpenDrawer,
  onShowToast
}) => {
  const [submittingPid, setSubmittingPid] = useState<string | null>(null);

  // Search & Pagination States
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // WhatsApp Modal States
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappRecipient, setWhatsappRecipient] = useState<"patient" | "doctor">("patient");
  const [whatsappText, setWhatsappText] = useState("");
  const [activePatientData, setActivePatientData] = useState<{ pid: string; surgeon: string; procedure: string; days: number } | null>(null);

  const t = translations[lang];
  const isRTL = lang === "ar";

  const rawOps = db.operations.filter((o) => o.DrainPlaced === "Yes" || o.DrainPlaced === true);
  const drains = db.drains;
  const config = db.config;

  const handleMarkRemoved = async (pid: string) => {
    setSubmittingPid(pid);
    try {
      await onMarkRemoved(pid);
      onShowToast(isRTL ? "تم تسجيل إزالة الأنبوب بنجاح! ✓" : "Drain marked as removed! ✓");
    } catch (err: any) {
      onShowToast(err.message || "Failed marking drain", true);
    } finally {
      setSubmittingPid(null);
    }
  };

  const handleUndoRemoval = async (pid: string) => {
    setSubmittingPid(pid);
    try {
      await onUndoRemoval(pid);
      onShowToast(isRTL ? "تم التراجع عن إزالة الأنبوب." : "Drain removal reversed.");
    } catch (err: any) {
      onShowToast(err.message || "Failed reversing removal", true);
    } finally {
      setSubmittingPid(null);
    }
  };

  // WhatsApp composition helper
  const openWhatsappModal = (o: Operation, daysVal: number) => {
    const data = {
      pid: o.PatientID,
      surgeon: o.Surgeon,
      procedure: o.Procedure,
      days: daysVal
    };
    setActivePatientData(data);
    setWhatsappRecipient("patient");
    
    // Compose default patient text
    const patientText = (isRTL ? translations["ar"].whatsappPatientTemplate : translations["en"].whatsappPatientTemplate)
      .replace("[PATIENT]", o.PatientID)
      .replace("[SURGEON]", o.Surgeon)
      .replace("[PROCEDURE]", o.Procedure);

    setWhatsappText(patientText);
    setWhatsappModalOpen(true);
  };

  const handleRecipientChange = (recipient: "patient" | "doctor") => {
    if (!activePatientData) return;
    setWhatsappRecipient(recipient);

    if (recipient === "patient") {
      const patientText = (isRTL ? translations["ar"].whatsappPatientTemplate : translations["en"].whatsappPatientTemplate)
        .replace("[PATIENT]", activePatientData.pid)
        .replace("[SURGEON]", activePatientData.surgeon)
        .replace("[PROCEDURE]", activePatientData.procedure);
      setWhatsappText(patientText);
    } else {
      const details = isRTL 
        ? `الأنبوب نشط في مكانه منذ ${activePatientData.days} يوماً (يتجاوز حد الأمان البالغ ${config.DrainAlertDays} أيام)`
        : `drain has been active in-situ for ${activePatientData.days} days (exceeds warning threshold of ${config.DrainAlertDays} days)`;
      
      const docText = (isRTL ? translations["ar"].whatsappDocTemplate : translations["en"].whatsappDocTemplate)
        .replace("[PATIENT]", activePatientData.pid)
        .replace("[DETAILS]", details);
      setWhatsappText(docText);
    }
  };

  const launchWhatsapp = () => {
    if (!whatsappText) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
    window.open(url, "_blank");
    setWhatsappModalOpen(false);
    onShowToast(isRTL ? "تم فتح واتساب ويب في نافذة جديدة!" : "WhatsApp launched in a new tab!");
  };

  // Search filter
  const filteredOps = rawOps.filter((o) => {
    const q = search.toLowerCase();
    const isMatched = o.PatientID.toLowerCase().includes(q) || o.Procedure.toLowerCase().includes(q);
    return isMatched;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredOps.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedOps = filteredOps.slice(startIndex, startIndex + rowsPerPage);

  // Reset page when search or row limits adjust
  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  return (
    <div className="space-y-6 animate-fade-in" id="drains-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className={isRTL ? "text-right" : "text-left"}>
          <h2 className="text-3xl font-display font-semibold text-white tracking-tight flex items-center gap-2">
            <Droplet className="w-8 h-8 text-emerald-400" />
            <span>{t.tabDrains}</span>
          </h2>
          <p className="text-sm text-white/60 mt-1">
            {isRTL
              ? "يتم احتساب أيام نشاط الأنبوب تلقائياً. تنطلق التنبيهات بناءً على قيم الحدود المحددة في الإعدادات."
              : "Days in situ are calculated dynamically. Alerts are triggered based on thresholds in Settings."}
          </p>
        </div>

        <span className="text-xs font-semibold py-1.5 px-3 rounded-xl bg-teal-950/60 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 self-start sm:self-auto">
          <Droplet className="w-4 h-4" />
          {isRTL ? `حد التنبيه النشط: ${config.DrainAlertDays} أيام` : `Config Alert Limit: ${config.DrainAlertDays} Days`}
        </span>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-display font-semibold text-white text-base">{isRTL ? "سجل متابعة الأنابيب" : "Active & Historied Drains"}</h3>
          
          <div className="relative w-full sm:w-64">
            <Search className={`absolute top-2.5 w-4 h-4 text-white/40 ${isRTL ? "left-3" : "right-3"}`} />
            <input
              type="text"
              placeholder={isRTL ? "بحث برقم المريض أو العملية..." : "Search drains..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/30 text-xs py-2 px-3 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Mobile Stack View */}
        <div className="block md:hidden divide-y divide-white/10">
          {paginatedOps.length > 0 ? (
            paginatedOps.map((o) => {
              const rem = drains.find((d) => d.PatientID === o.PatientID);
              const d = daysInSitu(o, drains);
              const isLate = d >= config.DrainAlertDays && !rem;

              return (
                <div key={o.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onOpenDrawer(o.PatientID)}
                      className="font-mono text-xs font-bold text-emerald-300 border-b border-dashed border-emerald-400 hover:border-solid transition-all text-left cursor-pointer"
                    >
                      {o.PatientID}
                    </button>
                    <span className="text-xs text-white/50">{fmt(o.OperationDate)}</span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white text-sm">{o.Procedure}</h4>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/40">{isRTL ? "أيام النشاط:" : "Days in situ:"}</span>
                      <span
                        className={`font-display font-bold text-sm px-2.5 py-0.5 rounded-lg border ${
                          isLate
                            ? "bg-rose-950/60 text-rose-300 border-rose-500/30 animate-pulse"
                            : rem
                            ? "bg-white/10 text-white/40 border-white/5"
                            : "bg-[#2A230A] text-[#ECCB34] border-[#ECCB34]/30"
                        }`}
                      >
                        {d}
                      </span>
                    </div>

                    <div>
                      {rem ? (
                        <div className="flex flex-col items-end">
                          <span className="inline-block bg-white/10 text-white/60 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                            {isRTL ? `أزيل في ${fmt(rem.RemovedDate)}` : `Removed ${fmt(rem.RemovedDate)}`}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block bg-rose-950/60 text-rose-300 border border-rose-500/30 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                          {isRTL ? "نشط" : "In situ"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex gap-2 justify-end">
                    {isLate && (
                      <button
                        onClick={() => openWhatsappModal(o, d)}
                        className="flex-1 justify-center bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-semibold text-xs py-2 px-3 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{t.whatsappReminderBtn}</span>
                      </button>
                    )}

                    {rem ? (
                      <button
                        onClick={() => handleUndoRemoval(o.PatientID)}
                        disabled={submittingPid === o.PatientID}
                        className="flex-1 justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 px-3 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{submittingPid === o.PatientID ? "..." : (isRTL ? "تراجع" : "Undo")}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkRemoved(o.PatientID)}
                        disabled={submittingPid === o.PatientID}
                        className="flex-1 justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{submittingPid === o.PatientID ? "..." : (isRTL ? "إزالة" : "Mark Removed")}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-white/40 text-sm">
              {isRTL ? "لا توجد سجلات أنابيب مطابقة" : "No cases with drains placed recorded yet."}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" dir={isRTL ? "rtl" : "ltr"}>
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/40 font-bold text-[10.5px] uppercase tracking-wider">
                <th className="py-3 px-6">{t.patientId}</th>
                <th className="py-3 px-6">{t.procedureLabel}</th>
                <th className="py-3 px-6">{isRTL ? "تاريخ الوضع" : "Date Placed"}</th>
                <th className="py-3 px-6 text-center">{isRTL ? "أيام النشاط" : "Days In Situ"}</th>
                <th className="py-3 px-6">{isRTL ? "حالة الإزالة" : "Removal Status"}</th>
                <th className="py-3 px-6 text-right">{t.actionsCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {paginatedOps.length > 0 ? (
                paginatedOps.map((o) => {
                  const rem = drains.find((d) => d.PatientID === o.PatientID);
                  const d = daysInSitu(o, drains);
                  const isLate = d >= config.DrainAlertDays && !rem;

                  return (
                    <tr key={o.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-6">
                        <button
                          onClick={() => onOpenDrawer(o.PatientID)}
                          className="font-mono text-xs font-bold text-emerald-300 hover:text-emerald-200 border-b border-dashed border-emerald-400 hover:border-solid transition-all text-left cursor-pointer"
                        >
                          {o.PatientID}
                        </button>
                      </td>
                      <td className="py-3.5 px-6 font-medium text-white">{o.Procedure}</td>
                      <td className="py-3.5 px-6">{fmt(o.OperationDate)}</td>
                      <td className="py-3.5 px-6 text-center">
                        <span
                          className={`font-display font-bold text-base px-2.5 py-0.5 rounded-lg border ${
                            isLate
                              ? "bg-rose-950/60 text-rose-300 border-rose-500/30"
                              : rem
                              ? "bg-white/10 text-white/40 border-white/5"
                              : "bg-[#2A230A] text-[#ECCB34] border-[#ECCB34]/30"
                          }`}
                        >
                          {d}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        {rem ? (
                          <div className="flex flex-col">
                            <span className="inline-block self-start bg-white/10 text-white/60 py-0.5 px-2 rounded-full text-xs font-semibold">
                              {isRTL ? `أزيل في ${fmt(rem.RemovedDate)}` : `Removed on ${fmt(rem.RemovedDate)}`}
                            </span>
                            <span className="text-[10px] text-white/40 mt-1">by {rem.RemovedBy || "system"}</span>
                          </div>
                        ) : (
                          <span className="inline-block bg-rose-950/60 text-rose-300 border border-rose-500/30 py-0.5 px-2 rounded-full text-xs font-semibold">
                            {isRTL ? "نشط" : "In situ"}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right flex items-center justify-end gap-2 min-h-[58px]">
                        {isLate && (
                          <button
                            onClick={() => openWhatsappModal(o, d)}
                            className="bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-semibold text-xs py-1.5 px-3 rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                            title={isRTL ? "تذكير واتساب" : "WhatsApp Reminder"}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{isRTL ? "تذكير" : "WhatsApp"}</span>
                          </button>
                        )}

                        {rem ? (
                          <button
                            onClick={() => handleUndoRemoval(o.PatientID)}
                            disabled={submittingPid === o.PatientID}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{submittingPid === o.PatientID ? "..." : (isRTL ? "تراجع" : "Undo")}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkRemoved(o.PatientID)}
                            disabled={submittingPid === o.PatientID}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{submittingPid === o.PatientID ? "..." : (isRTL ? "أزيل" : "Mark Removed")}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40 text-sm">
                    {isRTL ? "لا توجد سجلات تطابق البحث" : "No cases with drains placed recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Drainage Pagination Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60" dir={isRTL ? "rtl" : "ltr"}>
          <span>
            {isRTL 
              ? `عرض السجلات ${filteredOps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} إلى ${Math.min(safeCurrentPage * rowsPerPage, filteredOps.length)} من أصل ${filteredOps.length}` 
              : `Showing ${filteredOps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} to ${Math.min(safeCurrentPage * rowsPerPage, filteredOps.length)} of ${filteredOps.length} records`}
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

      {/* WhatsApp Pre-fill Composition Modal */}
      {whatsappModalOpen && activePatientData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#09221E] border border-white/15 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setWhatsappModalOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-display font-semibold text-white mb-1 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <span>{t.whatsappModalTitle}</span>
            </h3>
            <p className="text-xs text-white/50 mb-4">{t.whatsappModalSub}</p>

            <div className="space-y-4">
              {/* Recipient Selection Toggle */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">
                  {isRTL ? "جهة الاتصال المستهدفة" : "Target Recipient"}
                </label>
                <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => handleRecipientChange("patient")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      whatsappRecipient === "patient" ? "bg-emerald-600 text-white shadow" : "text-white/60 hover:text-white"
                    }`}
                  >
                    👤 {isRTL ? "المريض نفسه" : "Patient"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecipientChange("doctor")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      whatsappRecipient === "doctor" ? "bg-emerald-600 text-white shadow" : "text-white/60 hover:text-white"
                    }`}
                  >
                    🩺 {isRTL ? "رئيس الأطباء / الجراح" : "Chief Supervisor"}
                  </button>
                </div>
              </div>

              {/* Composition Box */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">
                  {isRTL ? "نص الرسالة للمراجعة" : "Message Text Preview"}
                </label>
                <textarea
                  value={whatsappText}
                  onChange={(e) => setWhatsappText(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white font-sans focus:outline-none focus:border-emerald-500 min-h-[120px] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWhatsappModalOpen(false)}
                  className="py-2.5 px-4 border border-white/10 text-white/80 hover:text-white rounded-xl text-xs cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={launchWhatsapp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-colors cursor-pointer border border-emerald-400/20 shadow flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t.whatsappSendBtn}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
