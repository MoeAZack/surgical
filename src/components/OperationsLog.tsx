import React, { useState, useEffect } from "react";
import { DBState, Operation } from "../types";
import { fmt } from "../utils";
import { Search, PlusCircle, Pencil, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { translations } from "../translations";

interface OperationsLogProps {
  db: DBState;
  lang?: "en" | "ar";
  onOpenDrawer: (operationId: string) => void;
  onOpenEdit: (id: string) => void;
  onNavigateToNew: () => void;
}

export const OperationsLog: React.FC<OperationsLogProps> = ({
  db,
  lang = "en",
  onOpenDrawer,
  onOpenEdit,
  onNavigateToNew
}) => {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [surgeonFilter, setSurgeonFilter] = useState("");
  const [procedureFilter, setProcedureFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [drainFilter, setDrainFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(db.config.defaultRowsPerPage || 10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, surgeonFilter, procedureFilter, outcomeFilter, drainFilter, dateFrom, dateTo]);

  const t = translations[lang];
  const isRTL = lang === "ar";

  const ops = db.operations;
  const drains = db.drains;
  const followup = db.followup;
  const checks = db.checks;
  const checklistItems = db.lists.checklistItems;

  const filteredOps = ops.filter((o) => {
    // Search filter
    const q = search.toLowerCase();
    const matchesSearch =
      o.PatientID.toLowerCase().includes(q) ||
      o.Procedure.toLowerCase().includes(q) ||
      o.Surgeon.toLowerCase().includes(q) ||
      (o.Notes && o.Notes.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Surgeon filter — a case can have multiple surgeons, so match against the array.
    if (surgeonFilter && !o.Surgeons.includes(surgeonFilter)) return false;

    // Procedure filter — a case can have multiple procedures, so match against the array.
    if (procedureFilter && !o.Procedures.includes(procedureFilter)) return false;

    // Outcome filter
    if (outcomeFilter) {
      const f = followup.find((fu) => fu.OperationID === o.id);
      const val = f ? f.FinalOutcome : "Ongoing";
      if (val !== outcomeFilter) return false;
    }

    // Drain filter
    if (drainFilter) {
      const isPlaced = o.DrainPlaced === "Yes";
      const isRemoved = drains.some((d) => d.OperationID === o.id);
      if (drainFilter === "In situ" && (!isPlaced || isRemoved)) return false;
      if (drainFilter === "Removed" && (!isPlaced || !isRemoved)) return false;
      if (drainFilter === "None" && isPlaced) return false;
    }

    // Date range filters
    if (dateFrom && o.OperationDate < dateFrom) return false;
    if (dateTo && o.OperationDate > dateTo) return false;

    return true;
  });

  const getCheckPill = (operationId: string) => {
    const myChecks = checks.filter((c) => c.OperationID === operationId && c.Done === "Yes");
    const checkedNames = new Set(myChecks.map((c) => c.Item));
    const total = checklistItems.length;
    const done = checklistItems.filter((item) => checkedNames.has(item)).length;

    let badgeClass = "bg-white/5 text-white/40 border border-white/10";
    if (total > 0 && done === total) {
      badgeClass = "bg-teal-950/60 text-teal-300 border border-teal-500/30";
    } else if (done > 0) {
      badgeClass = "bg-amber-950/60 text-amber-300 border border-amber-500/30";
    }

    return (
      <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${badgeClass}`}>
        {done}/{total}
      </span>
    );
  };

  const getDrainStatusPill = (o: Operation) => {
    if (o.DrainPlaced !== "Yes") return <span className="text-white/20">—</span>;

    const rem = drains.find((d) => d.OperationID === o.id);
    if (rem) {
      return (
        <span className="inline-block bg-white/10 text-white/50 border border-white/5 py-0.5 px-2 rounded-full text-xs font-medium">
          Removed
        </span>
      );
    } else {
      return (
        <span className="inline-block bg-rose-950/60 text-rose-300 border border-rose-500/30 py-0.5 px-2 rounded-full text-xs font-semibold animate-pulse">
          In situ
        </span>
      );
    }
  };

  const getFinalOutcomePill = (operationId: string) => {
    const f = followup.find((fu) => fu.OperationID === operationId);
    const val = f ? f.FinalOutcome : "Ongoing";

    let cls = "bg-white/10 text-white/60 border border-white/10";
    if (val === "Success") cls = "bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20";
    else if (val === "Lost to follow-up") cls = "bg-amber-950/60 text-amber-300 border border-amber-500/30";
    else if (val !== "Ongoing" && val !== "—") cls = "bg-rose-950/60 text-rose-300 border border-rose-500/30";

    return <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${cls}`}>{val}</span>;
  };

  // Extract unique surgeons & procedures for filtering
  const surgeons = db.lists.surgeons;
  const procedures = db.lists.procedures;
  const outcomes = db.lists.outcomes;

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredOps.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedOps = filteredOps.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="space-y-6 animate-fade-in" id="operations-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={isRTL ? "text-right" : "text-left"}>
          <h2 className="text-3xl font-display font-semibold text-white tracking-tight">{t.opsLogTitle}</h2>
          <p className="text-sm text-white/60 mt-1">{t.opsLogSub}</p>
        </div>
        <button
          onClick={onNavigateToNew}
          className={`flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white py-2 px-4 rounded-xl font-semibold text-sm transition-colors shadow-lg self-start sm:self-auto cursor-pointer border border-brand-primary/20 ${
            isRTL ? "flex-row-reverse" : ""
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t.addCaseBtn}</span>
        </button>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <h3 className="font-display font-semibold text-white text-base">{t.surgicalRecords}</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-xs font-semibold cursor-pointer text-brand-primary ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showFilters ? t.hideFilters : t.showFilters}</span>
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className={`w-4 h-4 text-white/40 absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${
                isRTL ? "pr-9 pl-4 text-right" : "pl-9 pr-4 text-left"
              } py-2 border border-white/10 bg-white/5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary focus:bg-white/10 focus:ring-1 focus:ring-brand-primary/30 transition-all`}
            />
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="bg-black/20 border-b border-white/10 p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-slide-down">
            {/* Surgeon Filter */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10.5px] uppercase font-bold tracking-wider text-white/55">
                {t.surgeonFilter}
              </label>
              <select
                value={surgeonFilter}
                onChange={(e) => setSurgeonFilter(e.target.value)}
                className="w-full bg-[#08221E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer"
              >
                <option value="">{t.allSurgeons}</option>
                {surgeons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Procedure Filter */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10.5px] uppercase font-bold tracking-wider text-white/55">
                {t.procedureFilter}
              </label>
              <select
                value={procedureFilter}
                onChange={(e) => setProcedureFilter(e.target.value)}
                className="w-full bg-[#08221E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer"
              >
                <option value="">{t.allProcedures}</option>
                {procedures.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Outcome Filter */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10.5px] uppercase font-bold tracking-wider text-white/55">
                {t.outcomeFilter}
              </label>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="w-full bg-[#08221E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer"
              >
                <option value="">{t.allOutcomes}</option>
                {outcomes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Drain Filter */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10.5px] uppercase font-bold tracking-wider text-white/55">
                {t.drainFilter}
              </label>
              <select
                value={drainFilter}
                onChange={(e) => setDrainFilter(e.target.value)}
                className="w-full bg-[#08221E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer"
              >
                <option value="">{t.allDrains}</option>
                <option value="In situ">In Situ</option>
                <option value="Removed">Removed</option>
                <option value="None">No Drain Placed</option>
              </select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10.5px] uppercase font-bold tracking-wider text-white/55">
                {t.dateFromFilter}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-[#08221E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Date To Filter */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[10.5px] uppercase font-bold tracking-wider text-white/55">
                {t.dateToFilter}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-[#08221E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Clear Filters Button */}
            <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2 flex items-end justify-start">
              {(surgeonFilter || procedureFilter || outcomeFilter || drainFilter || dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setSurgeonFilter("");
                    setProcedureFilter("");
                    setOutcomeFilter("");
                    setDrainFilter("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl cursor-pointer"
                >
                  {isRTL ? "إعادة تعيين الفلاتر" : "Clear All Filters"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Stack View */}
        <div className="block md:hidden divide-y divide-white/10">
          {paginatedOps.length > 0 ? (
            paginatedOps.map((o) => (
              <div key={o.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onOpenDrawer(o.id)}
                    className="font-mono text-xs font-bold text-brand-primary-light border-b border-dashed border-brand-primary hover:border-solid transition-all text-left cursor-pointer"
                  >
                    {o.PatientID}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">{fmt(o.OperationDate)}</span>
                    <button
                      onClick={() => onOpenEdit(o.id)}
                      title="Edit"
                      className="p-1.5 border border-white/10 rounded-lg hover:border-brand-primary hover:text-brand-primary-light hover:bg-brand-primary/10 transition-all text-white/60 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm">{o.Procedure || "—"}</h4>
                  <p className="text-xs text-white/50 mt-0.5">{o.Surgeon || "—"} {o.Age ? `· Age ${o.Age}` : ""}</p>
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 uppercase font-bold">{t.checklistCol}</span>
                    {getCheckPill(o.id)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 uppercase font-bold">{t.drainCol}</span>
                    {getDrainStatusPill(o)}
                  </div>
                </div>
                <div>{getFinalOutcomePill(o.id)}</div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-white/40 text-sm">{t.noRecordsFound}</div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" dir={isRTL ? "rtl" : "ltr"}>
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/40 font-bold text-[10.5px] uppercase tracking-wider">
                <th className="py-3 px-6 text-center w-24">{t.actionsCol}</th>
                <th className="py-3 px-6 text-right">{t.patientId}</th>
                <th className="py-3 px-6 text-right">{t.ageCol}</th>
                <th className="py-3 px-6 text-right">{t.dateCol}</th>
                <th className="py-3 px-6 text-right">{t.procedureFilter}</th>
                <th className="py-3 px-6 text-right">{t.surgeonFilter}</th>
                <th className="py-3 px-6 text-center">{t.checklistCol}</th>
                <th className="py-3 px-6 text-center">{t.drainCol}</th>
                <th className="py-3 px-6 text-left">{t.outcomeLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {paginatedOps.length > 0 ? (
                paginatedOps.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onOpenEdit(o.id)}
                          title="Edit"
                          className="p-1.5 border border-white/10 rounded-lg hover:border-brand-primary hover:text-brand-primary-light hover:bg-brand-primary/10 transition-all text-white/60 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => onOpenDrawer(o.id)}
                        className="font-mono text-xs font-bold text-brand-primary-light hover:text-brand-primary border-b border-dashed border-brand-primary hover:border-solid transition-all text-left cursor-pointer"
                      >
                        {o.PatientID}
                      </button>
                    </td>
                    <td className="py-3 px-6 text-right">{o.Age || "—"}</td>
                    <td className="py-3 px-6 text-right">{fmt(o.OperationDate)}</td>
                    <td className="py-3 px-6 text-right font-medium text-white">{o.Procedure}</td>
                    <td className="py-3 px-6 text-right">{o.Surgeon}</td>
                    <td className="py-3 px-6 text-center">{getCheckPill(o.id)}</td>
                    <td className="py-3 px-6 text-center">{getDrainStatusPill(o)}</td>
                    <td className="py-3 px-6 text-left">{getFinalOutcomePill(o.id)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/40 text-sm">
                    {ops.length === 0 ? t.noRecordsFound : t.noRecordsFound}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Beautiful Pagination Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60" dir={isRTL ? "rtl" : "ltr"}>
          <div className="flex items-center gap-4">
            <span>
              {isRTL 
                ? `عرض الحالات ${filteredOps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} إلى ${Math.min(safeCurrentPage * rowsPerPage, filteredOps.length)} من أصل ${filteredOps.length}` 
                : `Showing ${filteredOps.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} to ${Math.min(safeCurrentPage * rowsPerPage, filteredOps.length)} of ${filteredOps.length} cases`}
            </span>

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
  );
};
