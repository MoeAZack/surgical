import React, { useState } from "react";
import { DBState, Operation } from "../types";
import { fmt, daysInSitu, CLOSED_OUTCOMES, getMilestones, addMonths } from "../utils";
import {
  LayoutDashboard,
  Droplet,
  AlertTriangle,
  CalendarCheck,
  Calendar,
  CheckCircle,
  TrendingUp,
  Printer,
  Smartphone,
  Check,
  Award,
  Users
} from "lucide-react";
import { translations } from "../translations";

interface DashboardProps {
  db: DBState;
  lang?: "en" | "ar";
  onOpenDrawer: (operationId: string) => void;
  onGotoDay: (dateStr: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ db, lang = "en", onOpenDrawer, onGotoDay }) => {
  const [activeSubTab, setActiveSubTab] = useState<"shift" | "analytics">("shift");
  const [showReportModal, setShowReportModal] = useState(false);

  const t = translations[lang];
  const isRTL = lang === "ar";

  const ops = db.operations;
  const drains = db.drains;
  const config = db.config;
  const complications = db.complications;
  const appointments = db.appointments;
  const followup = db.followup;

  // Current Date string in clinic format
  const todayStr = new Date().toISOString().split("T")[0];

  // Most recent case for a given patient (used when a patient-level record,
  // like an appointment, needs to open a specific case's timeline drawer).
  const latestCaseForPatient = (pid: string): Operation | undefined => {
    const candidates = ops.filter((o) => o.PatientID === pid);
    if (candidates.length === 0) return undefined;
    return [...candidates].sort((a, b) => String(b.OperationDate).localeCompare(String(a.OperationDate)))[0];
  };
  const openDrawerForPatient = (pid: string) => {
    const op = latestCaseForPatient(pid);
    if (op) onOpenDrawer(op.id);
  };

  // 1. Core Metrics Calculations
  const inSitu = ops.filter((o) => o.DrainPlaced === "Yes" && !drains.some((d) => d.OperationID === o.id));
  const openC = complications.filter((c) => c.Resolved !== "Yes");

  const getFollowUpsDue = () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // next 2 weeks
    const out: { op: Operation; label: string; due: Date; overdue: boolean }[] = [];

    ops.forEach((o) => {
      if (!o.OperationDate) return;
      const f = followup.find((fu) => fu.OperationID === o.id);
      const outcome = f ? f.FinalOutcome : "Ongoing";
      if (outcome !== "Ongoing") return;

      const milestones = getMilestones(config);
      milestones.forEach(([key, months]) => {
        const val = f ? (f as any)[key] : "—";
        if (val !== "—") return;
        const due = addMonths(o.OperationDate, months);
        if (due <= soon) {
          out.push({
            op: o,
            label: `${months} mo`,
            due,
            overdue: due < now
          });
        }
      });
    });

    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  };

  const dueList = getFollowUpsDue();

  const getUpcomingAppts = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    soon.setHours(23, 59, 59, 999);

    return appointments
      .filter((a) => {
        if (a.Status !== "Scheduled") return false;
        const ad = new Date(a.Date);
        return ad >= now && ad <= soon;
      })
      .sort((a, b) => `${a.Date} ${a.Time}`.localeCompare(`${b.Date} ${b.Time}`));
  };

  const upAppts = getUpcomingAppts();

  // Success rate
  const closed = ops.filter((o) => {
    const f = followup.find((fu) => fu.OperationID === o.id);
    return f ? CLOSED_OUTCOMES.includes(f.FinalOutcome) : false;
  });

  const successes = closed.filter((o) => {
    const f = followup.find((fu) => fu.OperationID === o.id);
    return f ? f.FinalOutcome === "Success" : false;
  });

  const successRate = closed.length ? Math.round((100 * successes.length) / closed.length) : null;

  // Success by procedure stats
  const getSuccessByProcedure = () => {
    const byOp: Record<string, { n: number; c: number; s: number; cl: number }> = {};

    ops.forEach((o) => {
      if (!byOp[o.Procedure]) {
        byOp[o.Procedure] = { n: 0, c: 0, s: 0, cl: 0 };
      }
      byOp[o.Procedure].n++;
    });

    complications.forEach((c) => {
      const o = ops.find((op) => op.id === c.OperationID);
      if (o && byOp[o.Procedure]) {
        byOp[o.Procedure].c++;
      }
    });

    ops.forEach((o) => {
      const f = followup.find((fu) => fu.OperationID === o.id);
      if (f && CLOSED_OUTCOMES.includes(f.FinalOutcome)) {
        if (byOp[o.Procedure]) {
          byOp[o.Procedure].cl++;
          if (f.FinalOutcome === "Success") {
            byOp[o.Procedure].s++;
          }
        }
      }
    });

    return Object.entries(byOp);
  };

  const procStats = getSuccessByProcedure();

  // 2. Today's Shift View Logic
  // Appointments today
  const todayAppts = appointments
    .filter((a) => a.Date === todayStr)
    .sort((a, b) => a.Time.localeCompare(b.Time));

  // Critical drains today (exceeded threshold warning period)
  const criticalDrains = inSitu.filter((o) => daysInSitu(o, drains) >= config.DrainAlertDays);

  // 3. Practice Surgeon Breakdown calculations
  const getSurgeonBreakdown = () => {
    const surgeonMap: Record<string, { cases: number; complications: number; success: number; closed: number }> = {};

    ops.forEach((o) => {
      const s = o.Surgeon || "Unknown";
      if (!surgeonMap[s]) {
        surgeonMap[s] = { cases: 0, complications: 0, success: 0, closed: 0 };
      }
      surgeonMap[s].cases++;
    });

    complications.forEach((c) => {
      const o = ops.find((op) => op.id === c.OperationID);
      if (o) {
        const s = o.Surgeon || "Unknown";
        if (surgeonMap[s]) {
          surgeonMap[s].complications++;
        }
      }
    });

    ops.forEach((o) => {
      const s = o.Surgeon || "Unknown";
      const f = followup.find((fu) => fu.OperationID === o.id);
      if (f && CLOSED_OUTCOMES.includes(f.FinalOutcome)) {
        if (surgeonMap[s]) {
          surgeonMap[s].closed++;
          if (f.FinalOutcome === "Success") {
            surgeonMap[s].success++;
          }
        }
      }
    });

    return Object.entries(surgeonMap);
  };

  const surgeonStats = getSurgeonBreakdown();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fade-in print:bg-white print:text-black print:p-0 print:space-y-4" id="dashboard-view" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 print:border-black print:pb-2">
        <div className={isRTL ? "text-right" : "text-left"}>
          <h2 className="text-3xl font-display font-semibold text-white tracking-tight print:text-black print:text-2xl">{t.dashTitle}</h2>
          <p className="text-sm text-white/60 mt-1 print:hidden">{t.dashSub}</p>
        </div>

        {/* View Switcher Toggle & Print */}
        <div className="flex items-center gap-3 self-start sm:self-auto print:hidden">
          <div className="bg-black/25 border border-white/10 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveSubTab("shift")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === "shift" ? "bg-brand-primary text-white shadow-md font-bold" : "text-white/60 hover:text-white"
              }`}
            >
              {t.shiftView}
            </button>
            <button
              onClick={() => setActiveSubTab("analytics")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === "analytics" ? "bg-brand-primary text-white shadow-md font-bold" : "text-white/60 hover:text-white"
              }`}
            >
              {t.analyticsView}
            </button>
          </div>

          <button
            onClick={handlePrint}
            title={t.printShiftSheet}
            className="p-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 rounded-xl text-brand-primary transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Today's Clinical Shift View */}
      {activeSubTab === "shift" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-brand-primary/20 to-brand-primary/5 border border-brand-primary/20 rounded-2xl p-6 shadow-xl relative overflow-hidden text-left">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-bold text-brand-primary-light">{t.todayShiftTitle}</h3>
                <p className="text-xs text-white/70 mt-1 max-w-xl">{t.todayShiftSub}</p>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold py-2.5 px-4 rounded-xl border border-brand-primary/20 shadow-md cursor-pointer print:hidden transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t.printShiftSheet}</span>
              </button>
            </div>
            <div className="absolute right-[-2%] bottom-[-10%] opacity-[0.03] pointer-events-none">
              <Printer className="w-48 h-48 text-brand-primary" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Scheduled Appointments & Mobile PWA Promo */}
            <div className="space-y-6">
              {/* Today's Visits Board */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg text-left">
                <h4 className="font-display font-bold text-white text-sm flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-pulse" />
                  {t.todayAppts} ({todayAppts.length})
                </h4>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {todayAppts.length > 0 ? (
                    todayAppts.map((appt) => (
                      <div
                        key={appt.id}
                        onClick={() => openDrawerForPatient(appt.PatientID)}
                        className="p-4 border border-white/10 rounded-xl bg-black/20 hover:bg-black/30 transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-brand-primary-light">{appt.PatientID}</span>
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/80 font-semibold">
                              {appt.Type}
                            </span>
                          </div>
                          {appt.Notes && <p className="text-[11px] text-white/50 max-w-xs truncate">{appt.Notes}</p>}
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-brand-primary">{appt.Time || "—"}</span>
                          <span className="text-[10px] block text-white/40">{appt.Status}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-white/40 text-sm">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {t.noApptsToday}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Shortcut / PWA card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg flex gap-4 text-left print:hidden">
                <div className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-xl flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-white text-sm">{t.pwaTitle}</h4>
                  <p className="text-[11px] text-white/60 mt-1 leading-relaxed">{t.pwaBody}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Warning Drains & Alerts */}
            <div className="space-y-6">
              {/* Critical active drains board */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg text-left">
                <h4 className="font-display font-bold text-rose-300 text-sm flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  {t.drainsNeedAttention} ({criticalDrains.length})
                </h4>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {criticalDrains.length > 0 ? (
                    criticalDrains.map((o) => {
                      const d = daysInSitu(o, drains);
                      return (
                        <div
                          key={o.id}
                          onClick={() => onOpenDrawer(o.id)}
                          className="p-3.5 border border-rose-500/20 bg-rose-950/15 hover:bg-rose-950/25 rounded-xl transition-all cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <div className="font-mono text-xs font-bold text-brand-primary-light">{o.PatientID}</div>
                            <div className="text-[11px] text-white/60 truncate max-w-[180px] mt-0.5">{o.Procedure}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-display font-extrabold text-rose-400 text-base">{d} {t.days}</span>
                            <span className="text-[10px] text-rose-300/60 block">{t.activeDrain}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-white/40 text-sm">
                      <Droplet className="w-8 h-8 mx-auto mb-2 opacity-30 text-brand-primary" />
                      {t.noDrainsAlert}
                    </div>
                  )}
                </div>
              </div>

              {/* Overdue / Upcoming Due tasks alert panel */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg text-left">
                <h4 className="font-display font-bold text-amber-300 text-sm flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  {t.overdueTasks} ({dueList.filter((x) => x.overdue).length})
                </h4>
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {dueList.filter((x) => x.overdue).length > 0 ? (
                    dueList
                      .filter((x) => x.overdue)
                      .map((x) => (
                        <div
                          key={`${x.op.id}-${x.label}`}
                          onClick={() => onOpenDrawer(x.op.id)}
                          className="p-3 border border-amber-500/20 bg-amber-950/10 hover:bg-amber-950/20 rounded-xl transition-all cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono text-xs font-bold text-brand-primary-light">{x.op.PatientID}</span>
                            <span className="text-[11px] text-white/50 block mt-0.5">
                              {x.op.Procedure} • {x.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            {t.milestoneOverdue}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="py-8 text-center text-white/40 text-sm">
                      <CheckCircle className="w-7 h-7 mx-auto mb-2 opacity-30 text-brand-primary" />
                      {t.noOverdueTasks}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Monthly Analytics View (Practice statistics & surgeon reporting) */}
      {activeSubTab === "analytics" && (
        <div className="space-y-8">
          {/* Main Stats Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print:grid-cols-3 print:gap-2">
            {/* Total Cases */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow relative overflow-hidden flex flex-col justify-between text-left">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.totalCases}</span>
              <div className="text-3xl font-display font-extrabold mt-2 text-white tabular-nums">{ops.length}</div>
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-brand-primary" />
            </div>

            {/* Drains */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow relative overflow-hidden flex flex-col justify-between text-left">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.drainsInSitu}</span>
              <div className={`text-3xl font-display font-extrabold mt-2 tabular-nums ${inSitu.length > 0 ? "text-rose-400" : "text-white"}`}>
                {inSitu.length}
              </div>
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-rose-400" />
            </div>

            {/* Complications */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow relative overflow-hidden flex flex-col justify-between text-left">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.openComps}</span>
              <div className={`text-3xl font-display font-extrabold mt-2 tabular-nums ${openC.length > 0 ? "text-amber-400" : "text-white"}`}>
                {openC.length}
              </div>
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-400" />
            </div>

            {/* Follow Ups Due */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow relative overflow-hidden flex flex-col justify-between text-left">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.fuDue}</span>
              <div className={`text-3xl font-display font-extrabold mt-2 tabular-nums ${dueList.length > 0 ? "text-indigo-400" : "text-white"}`}>
                {dueList.length}
              </div>
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-400" />
            </div>

            {/* Active Appointments */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow relative overflow-hidden flex flex-col justify-between text-left">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.appts7d}</span>
              <div className="text-3xl font-display font-extrabold mt-2 text-white tabular-nums">{upAppts.length}</div>
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-sky-400" />
            </div>

            {/* Success Rate */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow relative overflow-hidden flex flex-col justify-between text-left">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t.successRate}</span>
              <div className="text-3xl font-display font-extrabold mt-2 text-white tabular-nums">
                {successRate === null ? "—" : `${successRate}%`}
              </div>
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-brand-primary" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Drains Situ board */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl text-left">
              <h3 className="font-display font-semibold text-white flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {t.drainsInSituBoard}
              </h3>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {inSitu.length > 0 ? (
                  inSitu.map((o) => {
                    const d = daysInSitu(o, drains);
                    const isAlert = d >= config.DrainAlertDays;
                    return (
                      <div
                        key={o.id}
                        onClick={() => onOpenDrawer(o.id)}
                        className={`p-3 border rounded-xl hover:shadow-md transition-all cursor-pointer flex items-center justify-between ${
                          isAlert
                            ? "bg-rose-950/40 border-rose-500/40 hover:bg-rose-900/40 text-white"
                            : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                        }`}
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-primary-light">{o.PatientID}</div>
                          <div className="text-[11px] text-white/60 truncate max-w-[140px] mt-0.5">{o.Procedure}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-display font-bold text-sm ${isAlert ? "text-rose-400" : "text-amber-400"}`}>
                            {d} <span className="text-[10px] font-sans font-medium">{t.days}</span>
                          </div>
                          <div className="text-[9px] text-white/40 mt-0.5">{t.activeDrain}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-white/40 text-sm py-4 text-center">No drains currently in situ. ✓</p>
                )}
              </div>
            </div>

            {/* 2. Upcoming Visits (7d) board */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl text-left">
              <h3 className="font-display font-semibold text-white flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                {t.upcomingVisitsBoard}
              </h3>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {upAppts.length > 0 ? (
                  upAppts.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => onGotoDay(a.Date)}
                      className="p-3 border border-white/10 rounded-xl bg-sky-950/20 hover:bg-sky-900/30 transition-all cursor-pointer flex items-center justify-between text-white"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-brand-primary-light">{a.PatientID}</div>
                        <div className="text-[11px] text-white/60 mt-0.5">{a.Type}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold text-[11px] text-sky-400">{fmt(a.Date)}</div>
                        <div className="text-[10px] font-mono text-white/40 mt-0.5">{a.Time || "—"}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm py-4 text-center">No appointments scheduled this week.</p>
                )}
              </div>
            </div>

            {/* 3. Follow Ups due board */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl text-left">
              <h3 className="font-display font-semibold text-white flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {t.fuOverdueBoard}
              </h3>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {dueList.length > 0 ? (
                  dueList.map((x) => (
                    <div
                      key={`${x.op.id}-${x.label}`}
                      onClick={() => onOpenDrawer(x.op.id)}
                      className={`p-3 border rounded-xl hover:shadow-md transition-all cursor-pointer flex items-center justify-between ${
                        x.overdue
                          ? "bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/40 text-white"
                          : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      }`}
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-brand-primary-light">{x.op.PatientID}</div>
                        <div className="text-[11px] text-white/60 mt-0.5 truncate max-w-[140px]">{x.op.Procedure} • {x.label}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          x.overdue ? "bg-rose-500/15 text-rose-300 border border-rose-500/20" : "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                        }`}>
                          {x.overdue ? t.milestoneOverdue : t.milestoneDue}
                        </span>
                        <div className="text-[9px] text-white/40 mt-1">{fmt(x.due)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm py-4 text-center">Nothing due in next two weeks. ✓</p>
                )}
              </div>
            </div>
          </div>

          {/* Surgeon breakdown panel and report trigger */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Surgeon Analytics table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-2 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-white/5 pb-3">
                <h3 className="font-display font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-primary" />
                  {t.surgeonStatsTitle}
                </h3>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="bg-brand-primary/10 text-brand-primary-light border border-brand-primary/30 hover:bg-brand-primary/25 transition-all text-xs font-semibold py-1.5 px-3 rounded-xl cursor-pointer"
                >
                  {t.monthlySummaryReportBtn}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-white/40 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-4">{t.surgeonCol}</th>
                      <th className="py-2.5 px-4 text-center">{t.totalCases}</th>
                      <th className="py-2.5 px-4 text-center">{t.compsCol}</th>
                      <th className="py-2.5 px-4 text-right">{t.complicationRateCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-white/85">
                    {surgeonStats.length > 0 ? (
                      surgeonStats.map(([surgeon, v]) => {
                        const compRate = v.cases ? Math.round((100 * v.complications) / v.cases) : 0;
                        return (
                          <tr key={surgeon} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-semibold text-white">{surgeon}</td>
                            <td className="py-3 px-4 text-center font-mono">{v.cases}</td>
                            <td className="py-3 px-4 text-center">
                              {v.complications > 0 ? (
                                <span className="bg-rose-500/10 text-rose-300 border border-rose-500/20 py-0.5 px-2 rounded-full text-[10px] font-bold">
                                  {v.complications} event{v.complications > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-brand-primary">
                              {compRate}%
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-white/40">
                          {t.noSurgeonStats}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Success by Procedure Rate board */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl text-left">
              <h3 className="font-display font-semibold text-white flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Award className="w-4 h-4 text-teal-400" />
                {t.successByProcTitle}
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {procStats.length > 0 ? (
                  procStats.map(([proc, v]) => {
                    const r = v.cl ? Math.round((100 * v.s) / v.cl) : null;
                    return (
                      <div key={proc} className="p-3 border border-white/5 rounded-xl bg-black/10 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-xs text-white">{proc}</div>
                          <div className="text-[10px] text-white/40 mt-0.5">{v.n} {isRTL ? "عمليات" : "cases"}</div>
                        </div>
                        <div className="text-right">
                          {r !== null ? (
                            <span className="text-[10.5px] font-bold bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20 px-2 py-0.5 rounded">
                              {r}% {isRTL ? "نجاح" : "Success"}
                            </span>
                          ) : (
                            <span className="text-[9px] text-white/40 italic">{t.pendingMilestones}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-white/40 text-sm py-4 text-center">No cases recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CLINICAL performance print summary Modal overlay */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1E1B] border border-brand-primary/20 max-w-2xl w-full rounded-2xl p-6 text-white space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-display font-bold text-brand-primary-light">{t.monthlySummaryModalTitle}</h3>
                <p className="text-xs text-white/60 mt-1">{t.monthlySummaryModalSub}</p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-white/40 hover:text-white border border-white/10 hover:border-white/20 p-1.5 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            {/* Document Content */}
            <div className="space-y-6 border border-white/5 p-6 rounded-xl bg-black/25 font-sans leading-relaxed text-sm text-left">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-sm font-bold uppercase tracking-wide text-brand-primary-light">Case Tracker Clinical Report</span>
                <span className="text-xs font-mono text-white/50">{fmt(todayStr)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/5 p-4 rounded-xl">
                <div>
                  <span className="text-[10px] text-white/45 block uppercase">{t.totalCases}</span>
                  <span className="text-lg font-bold font-mono">{ops.length}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/45 block uppercase">{t.drainsInSitu}</span>
                  <span className="text-lg font-bold font-mono text-rose-300">{inSitu.length}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/45 block uppercase">{t.openComps}</span>
                  <span className="text-lg font-bold font-mono text-amber-300">{openC.length}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/45 block uppercase">{t.successRate}</span>
                  <span className="text-lg font-bold font-mono text-brand-primary-light">
                    {successRate === null ? "—" : `${successRate}%`}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Clinical Surgeon Outcomes</h4>
                <div className="divide-y divide-white/5">
                  {surgeonStats.map(([surgeon, v]) => {
                    const compRate = v.cases ? Math.round((100 * v.complications) / v.cases) : 0;
                    return (
                      <div key={surgeon} className="py-2 flex justify-between text-xs">
                        <span className="font-semibold text-white/90">{surgeon}</span>
                        <span className="text-white/60">
                          {v.cases} Cases • {v.complications} Complications ({compRate}% rate)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Outcome Rate by Procedure</h4>
                <div className="divide-y divide-white/5">
                  {procStats.map(([proc, v]) => {
                    const r = v.cl ? Math.round((100 * v.s) / v.cl) : null;
                    return (
                      <div key={proc} className="py-2 flex justify-between text-xs">
                        <span className="text-white/90">{proc}</span>
                        <span className="font-mono text-brand-primary font-bold">
                          {r !== null ? `${r}% success` : "pending milestones"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="py-2 px-4 border border-white/10 hover:border-white/20 bg-white/5 text-xs font-semibold rounded-xl text-white/70 hover:text-white cursor-pointer"
              >
                {t.closeBtn}
              </button>
              <button
                onClick={handlePrint}
                className="py-2 px-4 bg-brand-primary hover:bg-brand-primary-hover font-bold text-xs rounded-xl text-white flex items-center gap-2 cursor-pointer border border-brand-primary/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t.printReportBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
