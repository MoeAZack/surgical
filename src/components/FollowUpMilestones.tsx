import React, { useState, useEffect } from "react";
import { DBState, Operation } from "../types";
import { getMilestones, isFollowUpLate, addMonths, fmt } from "../utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { translations } from "../translations";

interface FollowUpMilestonesProps {
  db: DBState;
  lang?: "en" | "ar";
  onSetFollowUp: (PatientID: string, field: string, value: string) => Promise<void>;
  onOpenDrawer: (pid: string) => void;
}

export const FollowUpMilestones: React.FC<FollowUpMilestonesProps> = ({
  db,
  lang = "en",
  onSetFollowUp,
  onOpenDrawer
}) => {
  const ops = db.operations;
  const followup = db.followup;
  const listConfig = db.lists;
  const config = db.config;

  // Search & Pagination States
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const t = translations[lang];
  const isRTL = lang === "ar";

  const milestones = getMilestones(config);

  const getFollowUpRecord = (pid: string) => {
    return (
      followup.find((f) => f.PatientID === pid) || {
        M1: "—",
        M3: "—",
        M6: "—",
        M12: "—",
        FinalOutcome: "Ongoing"
      }
    );
  };

  const handleSelectChange = (pid: string, field: string, value: string) => {
    onSetFollowUp(pid, field, value);
  };

  // Search filter
  const filteredOps = ops.filter((o) => {
    const q = search.toLowerCase();
    return o.PatientID.toLowerCase().includes(q) || o.Procedure.toLowerCase().includes(q);
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
    <div className="space-y-6 animate-fade-in" id="followups-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className={isRTL ? "text-right" : "text-left"}>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight">
          {t.tabFollowUps}
        </h2>
        <p className="text-sm text-white/60 mt-1">
          {isRTL
            ? "يتم احتساب الجداول الزمنية لمراحل المتابعة مباشرة من تاريخ العملية بناءً على القواعد المحددة في الإعدادات. تشير الحدود الحمراء إلى تخطي الموعد."
            : "Milestone timelines count directly from the operation date based on rules in Settings. Red borders indicate overdue items."}
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-display font-semibold text-white text-base">
            {isRTL ? "تتبع المراجعات طويلة المدى" : "Long-term Review Tracker"}
          </h3>
          
          <div className="relative w-full sm:w-64">
            <Search className={`absolute top-2.5 w-4 h-4 text-white/40 ${isRTL ? "left-3" : "right-3"}`} />
            <input
              type="text"
              placeholder={isRTL ? "بحث برقم المريض..." : "Search milestones..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/30 text-xs py-2 px-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Mobile Stack View */}
        <div className="block md:hidden divide-y divide-white/10">
          {paginatedOps.length > 0 ? (
            paginatedOps.map((o) => {
              const f = getFollowUpRecord(o.PatientID);

              return (
                <div key={o.id} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onOpenDrawer(o.PatientID)}
                      className="font-mono text-xs font-bold text-brand-primary-light border-b border-dashed border-brand-primary hover:border-solid transition-all text-left cursor-pointer"
                    >
                      {o.PatientID}
                    </button>
                    <span className="text-[10px] text-white/50">{o.OperationDate ? fmt(o.OperationDate) : ""}</span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white text-sm">{o.Procedure}</h4>
                  </div>

                  {/* Milestones Grid */}
                  <div className="grid grid-cols-2 gap-3 bg-black/15 p-3 rounded-xl border border-white/5">
                    {milestones.map(([key, months], idx) => {
                      const val = (f as any)[key] || "—";
                      const isLate = isFollowUpLate(o, f as any, key as any, months);
                      const dueStr = o.OperationDate ? fmt(addMonths(o.OperationDate, months)) : "";

                      return (
                        <div key={key} className="space-y-1.5">
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">
                            M{idx + 1} ({months} {isRTL ? "أشهر" : "mo"})
                          </span>
                          <select
                            value={val}
                            onChange={(e) => handleSelectChange(o.PatientID, key, e.target.value)}
                            className={`w-full text-xs font-semibold py-1 px-2 border rounded-lg focus:outline-none focus:border-brand-primary bg-[#0A2E2A] text-white ${
                              isLate
                                ? "border-rose-500/30 ring-2 ring-rose-500/10 focus:ring-0 text-rose-300 bg-rose-950/40"
                                : "border-white/10 text-white"
                            }`}
                          >
                            {listConfig.fuStatus.map((st) => (
                              <option key={st} value={st} className="bg-[#0A2E2A] text-white">
                                {st}
                              </option>
                            ))}
                          </select>
                          {o.OperationDate && (
                            <span className={`text-[9px] block ${isLate ? "text-rose-400 font-semibold" : "text-white/30"}`}>
                              {isLate ? (isRTL ? "تأخر عن موعده" : "Overdue") : (isRTL ? "مستحق" : "Due")} {dueStr}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Final Outcome Selector */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-white/50 font-semibold">{isRTL ? "النتيجة النهائية:" : "Final Outcome:"}</span>
                    <select
                      value={f.FinalOutcome}
                      onChange={(e) => handleSelectChange(o.PatientID, "FinalOutcome", e.target.value)}
                      className={`text-xs font-semibold py-1.5 px-3 border rounded-lg focus:outline-none focus:border-brand-primary bg-[#0A2E2A] text-white ${
                        f.FinalOutcome === "Success"
                          ? "text-brand-primary-light bg-brand-primary/10 border-brand-primary/20 font-bold"
                          : f.FinalOutcome === "Ongoing"
                          ? "text-white bg-white/5 border-white/10"
                          : "text-rose-300 bg-rose-950/40 border-rose-500/30 font-semibold"
                      }`}
                    >
                      {listConfig.outcomes.map((out) => (
                        <option key={out} value={out} className="bg-[#0A2E2A] text-white">
                          {out}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-white/40 text-sm">
              {isRTL ? "لا توجد حالات مسجلة تطابق البحث" : "No cases recorded yet."}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" dir={isRTL ? "rtl" : "ltr"}>
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/40 font-bold text-[10.5px] uppercase tracking-wider">
                <th className="py-3.5 px-6">{t.patientId}</th>
                <th className="py-3.5 px-6">{t.procedureLabel}</th>
                {milestones.map(([key, months], i) => (
                  <th key={key} className="py-3.5 px-6">
                    M{i + 1} ({months} {isRTL ? "أشهر" : "mo"})
                  </th>
                ))}
                <th className="py-3.5 px-6 text-right">{isRTL ? "النتيجة النهائية" : "Final Outcome"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {paginatedOps.length > 0 ? (
                paginatedOps.map((o) => {
                  const f = getFollowUpRecord(o.PatientID);

                  return (
                    <tr key={o.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-6">
                        <button
                          onClick={() => onOpenDrawer(o.PatientID)}
                          className="font-mono text-xs font-bold text-brand-primary-light hover:text-brand-primary border-b border-dashed border-brand-primary hover:border-solid transition-all text-left cursor-pointer"
                        >
                          {o.PatientID}
                        </button>
                      </td>
                      <td className="py-3 px-6 font-medium text-white truncate max-w-[180px]" title={o.Procedure}>
                        {o.Procedure}
                      </td>

                      {milestones.map(([key, months]) => {
                        const val = (f as any)[key] || "—";
                        const isLate = isFollowUpLate(o, f as any, key as any, months);
                        const dueStr = o.OperationDate ? fmt(addMonths(o.OperationDate, months)) : "";

                        return (
                          <td key={key} className="py-3 px-6">
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={val}
                                onChange={(e) => handleSelectChange(o.PatientID, key, e.target.value)}
                                className={`text-xs font-semibold py-1 px-2.5 border rounded-lg focus:outline-none focus:border-brand-primary bg-[#0A2E2A] text-white ${
                                  isLate
                                    ? "border-rose-500/30 ring-2 ring-rose-500/10 focus:ring-0 text-rose-300 bg-rose-950/40"
                                    : "border-white/10 text-white"
                                }`}
                              >
                                {listConfig.fuStatus.map((st) => (
                                  <option key={st} value={st} className="bg-[#0A2E2A] text-white">
                                    {st}
                                  </option>
                                ))}
                              </select>
                              {o.OperationDate && (
                                <span className={`text-[9.5px] ${isLate ? "text-rose-400 font-semibold" : "text-white/40"}`}>
                                  {isLate ? (isRTL ? "تأخر" : "Overdue") : (isRTL ? "مستحق" : "Due")} {dueStr}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-3 px-6 text-right">
                        <select
                          value={f.FinalOutcome}
                          onChange={(e) => handleSelectChange(o.PatientID, "FinalOutcome", e.target.value)}
                          className={`text-xs font-semibold py-1.5 px-3 border rounded-lg focus:outline-none focus:border-brand-primary bg-[#0A2E2A] text-white inline-block ${
                            f.FinalOutcome === "Success"
                              ? "text-brand-primary-light bg-brand-primary/10 border-brand-primary/20 font-bold"
                              : f.FinalOutcome === "Ongoing"
                              ? "text-white bg-white/5 border-white/10"
                              : "text-rose-300 bg-rose-950/40 border-rose-500/30 font-semibold"
                          }`}
                        >
                          {listConfig.outcomes.map((out) => (
                            <option key={out} value={out} className="bg-[#0A2E2A] text-white">
                              {out}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={milestones.length + 3} className="py-12 text-center text-white/40 text-sm">
                    {isRTL ? "لا توجد مراجعات مسجلة تطابق البحث" : "No cases recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Milestone Pagination Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60" dir={isRTL ? "rtl" : "ltr"}>
          <span>
            {isRTL 
              ? `عرض المراجعات ${filteredOps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} إلى ${Math.min(safeCurrentPage * rowsPerPage, filteredOps.length)} من أصل ${filteredOps.length}` 
              : `Showing ${filteredOps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} to ${Math.min(safeCurrentPage * rowsPerPage, filteredOps.length)} of ${filteredOps.length} milestones`}
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
