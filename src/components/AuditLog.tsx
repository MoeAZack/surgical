import React, { useEffect, useState } from "react";
import { DBState } from "../types";
import { Search, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { translations } from "../translations";

interface AuditLogProps {
  db: DBState;
  lang?: "en" | "ar";
}

export const AuditLog: React.FC<AuditLogProps> = ({ db, lang = "en" }) => {
  const t = translations[lang];
  const isRTL = lang === "ar";

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(db.config.defaultRowsPerPage || 10);

  // Newest first.
  const entries = [...(db.audit || [])].sort((a, b) => b.Timestamp.localeCompare(a.Timestamp));

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.User.toLowerCase().includes(q) ||
      e.Action.toLowerCase().includes(q) ||
      e.Details.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  const fmtTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(isRTL ? "ar" : "en-GB", {
        day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="audit-log-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className={isRTL ? "text-right" : "text-left"}>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight flex items-center gap-2">
          <ScrollText className="w-7 h-7 text-brand-primary" />
          <span>{t.auditLogTitle}</span>
        </h2>
        <p className="text-sm text-white/60 mt-1">{t.auditLogSub}</p>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-display font-semibold text-white text-base">{t.auditLogTitle}</h3>
          <div className="relative w-full sm:w-72">
            <Search className={`absolute top-2.5 w-4 h-4 text-white/40 ${isRTL ? "left-3" : "right-3"}`} />
            <input
              type="text"
              placeholder={t.searchAuditPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/30 text-xs py-2 px-3 border border-white/10 rounded-xl focus:outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Mobile Stack View */}
        <div className="block md:hidden divide-y divide-white/10">
          {paginated.length > 0 ? (
            paginated.map((e) => (
              <div key={e.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] text-white/50">{fmtTimestamp(e.Timestamp)}</span>
                  <span className="text-[10px] font-bold text-brand-primary-light bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded-full">
                    {e.User}
                  </span>
                </div>
                <div className="font-semibold text-white text-sm">{e.Action}</div>
                <div className="text-xs text-white/60 leading-relaxed">{e.Details}</div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-white/40 text-sm">
              {isRTL ? "لا توجد سجلات مطابقة" : "No audit entries match search criteria."}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse" dir={isRTL ? "rtl" : "ltr"}>
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/40 font-bold text-[10.5px] uppercase tracking-wider">
                <th className="py-3 px-6">{t.timestampCol}</th>
                <th className="py-3 px-6">{t.userCol}</th>
                <th className="py-3 px-6">{t.actionCol}</th>
                <th className="py-3 px-6">{t.detailsCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/80">
              {paginated.length > 0 ? (
                paginated.map((e) => (
                  <tr key={e.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs text-white/50 whitespace-nowrap">{fmtTimestamp(e.Timestamp)}</td>
                    <td className="py-3 px-6">
                      <span className="text-[10.5px] font-bold text-brand-primary-light bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded-full">
                        {e.User}
                      </span>
                    </td>
                    <td className="py-3 px-6 font-semibold text-white whitespace-nowrap">{e.Action}</td>
                    <td className="py-3 px-6 text-white/70">{e.Details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-white/40 text-sm">
                    {isRTL ? "لا توجد سجلات مطابقة" : "No audit entries match search criteria."}
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
              ? `عرض ${filtered.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} إلى ${Math.min(safeCurrentPage * rowsPerPage, filtered.length)} من أصل ${filtered.length}`
              : `Showing ${filtered.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1} to ${Math.min(safeCurrentPage * rowsPerPage, filtered.length)} of ${filtered.length} entries`}
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
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
