import React, { useState, useEffect } from "react";
import { DBState, Operation, Complication } from "./types";
import { Dashboard } from "./components/Dashboard";
import { OperationsLog } from "./components/OperationsLog";
import { AppointmentsCalendar } from "./components/AppointmentsCalendar";
import { DrainageTracking } from "./components/DrainageTracking";
import { ComplicationsRegistry } from "./components/ComplicationsRegistry";
import { FollowUpMilestones } from "./components/FollowUpMilestones";
import { SettingsPanel } from "./components/SettingsPanel";
import { NewOperationForm } from "./components/NewOperationForm";
import { PatientTimelineDrawer } from "./components/PatientTimelineDrawer";
import { EditOperationModal } from "./components/EditOperationModal";
import { EditComplicationModal } from "./components/EditComplicationModal";
import { DraftsQueue } from "./components/DraftsQueue";
import { translations } from "./translations";
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Droplet,
  AlertTriangle,
  Bookmark,
  Settings,
  PlusCircle,
  Menu,
  X,
  RefreshCw,
  Clock,
  FolderArchive
} from "lucide-react";

export default function App() {
  const [db, setDb] = useState<DBState | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dash");
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  // Bilingual Language State
  const [lang, setLang] = useState<"en" | "ar">(() => {
    return (localStorage.getItem("lang") as "en" | "ar") || "en";
  });

  // Accent Theme Color State
  const [themeColor, setThemeColor] = useState<"emerald" | "teal" | "indigo" | "rose" | "violet" | "amber" | "slate" | "blue">(() => {
    return (localStorage.getItem("themeColor") as "emerald" | "teal" | "indigo" | "rose" | "violet" | "amber" | "slate" | "blue") || "emerald";
  });

  const handleThemeColorChange = (color: "emerald" | "teal" | "indigo" | "rose" | "violet" | "amber" | "slate" | "blue") => {
    setThemeColor(color);
    localStorage.setItem("themeColor", color);
  };

  // Chained Actions Proposal state
  const [chainPrompt, setChainPrompt] = useState<{
    type: "schedule-wound-check" | "drain-removal-followup" | "mark-drain-removed";
    patientID: string;
    suggestedDate?: string;
    suggestedTime?: string;
    appointmentType?: string;
    appointmentRow?: number;
  } | null>(null);

  // Responsive mobile menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Shared drawers/modals state
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [editingComplication, setEditingComplication] = useState<Complication | null>(null);

  // Calendar direct jump state from Dash upcoming cards
  const [jumpDate, setJumpDate] = useState<string | undefined>(undefined);

  // Fetch initial state
  useEffect(() => {
    fetch("/api/all")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load data.");
        return res.json();
      })
      .then((data) => {
        setDb(data);
        setLoading(false);
      })
      .catch((err) => {
        showToast("Error loading database: " + err.message, true);
        setLoading(false);
      });
  }, []);

  // Global Toast event listener
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        showToast(customEvent.detail.message, !!customEvent.detail.isError);
      }
    };
    window.addEventListener("clinical_toast", handleToastEvent);
    return () => {
      window.removeEventListener("clinical_toast", handleToastEvent);
    };
  }, []);

  // Utility toast handler
  const showToast = (message: string, isError: boolean = false) => {
    setToast({ message, isError });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // ---------------------------------------------------- API Action Handlers
  const handleAddOperation = async (op: {
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedure: string;
    Surgeon: string;
    DrainPlaced: boolean;
    Notes: string;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add operation.");
      setDb(data);
      showToast("Surgical case saved successfully! ✓");
      
      if (op.DrainPlaced) {
        setChainPrompt({
          type: "schedule-wound-check",
          patientID: op.PatientID,
          suggestedDate: new Date(new Date(op.OperationDate).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          suggestedTime: "10:00",
          appointmentType: "Wound Check"
        });
      } else {
        setActiveTab("ops");
      }
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateOperation = async (updatedOp: {
    _row: number;
    oldPatientID: string;
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedure: string;
    Surgeon: string;
    DrainPlaced: boolean;
    Notes: string;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/operations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedOp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update operation.");
      setDb(data);
      showToast("Operational changes saved successfully! ✓");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOperation = async (pid: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/operations/${encodeURIComponent(pid)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete operation.");
      setDb(data);
      showToast(`${pid} and all historical records successfully deleted.`);
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleMarkDrainRemoved = async (pid: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/drains/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PatientID: pid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove drain.");
      setDb(data);
      showToast("Drain successfully marked as removed.");

      // Chain 2: Schedule Follow-up Visit 1-week out
      setChainPrompt({
        type: "drain-removal-followup",
        patientID: pid,
        suggestedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        suggestedTime: "11:00",
        appointmentType: "Follow-up Visit"
      });
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUndoDrainRemoval = async (pid: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/drains/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PatientID: pid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to undo removal.");
      setDb(data);
      showToast("Drain removal undone. Back in situ status.");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleAddComplication = async (comp: {
    PatientID: string;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/complications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add complication.");
      setDb(data);
      showToast("Complication successfully logged to registry.");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateComplication = async (updatedComp: {
    _row: number;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
    Resolved: boolean;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/complications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedComp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update complication.");
      setDb(data);
      showToast("Complication registry log updated successfully.");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteComplication = async (row: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/complications/${row}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete complication.");
      setDb(data);
      showToast("Complication event log deleted.");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleResolveComplication = async (row: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/complications/resolve/${row}`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve complication.");
      setDb(data);
      showToast("Complication marked resolved successfully. ✓");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleSetFollowUp = async (PatientID: string, field: string, value: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PatientID, field, value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update follow-up.");
      setDb(data);
      showToast("Milestone record saved.");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCheckItem = async (PatientID: string, item: string, done: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PatientID, item, done })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save checklist.");
      setDb(data);
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleAddAppointment = async (appt: {
    PatientID: string;
    Date: string;
    Time: string;
    Type: string;
    Notes: string;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appt)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule appointment.");
      setDb(data);
      showToast(`Appointment successfully scheduled.`);
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleSetAppointmentStatus = async (row: number, status: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/appointments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row, status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");
      setDb(data);
      showToast("Appointment status updated.");

      // Chain 3: Mark drain removed?
      if (status === "Done") {
        const appt = db?.appointments.find((a) => a._row === row);
        if (appt) {
          const typeLower = appt.Type.toLowerCase();
          const notesLower = (appt.Notes || "").toLowerCase();
          if (typeLower.includes("drain") || typeLower.includes("removal") || notesLower.includes("drain") || notesLower.includes("removal")) {
            const op = db.operations.find((o) => o.PatientID === appt.PatientID);
            const hasActiveDrain = (op && op.DrainPlaced === "Yes") && !db.drains.some((d) => d.PatientID === appt.PatientID);
            if (hasActiveDrain) {
              setChainPrompt({
                type: "mark-drain-removed",
                patientID: appt.PatientID,
                appointmentRow: row
              });
            }
          }
        }
      }
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAppointment = async (row: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${row}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel appointment.");
      setDb(data);
      showToast("Appointment calendar entry deleted.");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleSaveConfig = async (configData: DBState["config"]) => {
    setBusy(true);
    try {
      const res = await fetch("/api/config/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration.");
      setDb(data);
      showToast("Milestone offsets and alert periods successfully configured! ✓");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleSaveList = async (type: "surgeons" | "procedures" | "checklist" | "complications", items: string[]) => {
    setBusy(true);
    try {
      const res = await fetch("/api/lists/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, items })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save lists.");
      setDb(data);
      showToast(`Master list for ${type} updated for all practice devices.`);
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPhotos = async (pid: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(pid)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to locate folder.");
      window.open(data.url, "_blank");
    } catch (err: any) {
      showToast(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadBackup = async (backupData: any) => {
    setBusy(true);
    try {
      const res = await fetch("/api/backup/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload backup.");
      setDb(data);
      showToast("Data restore successful! All operations and configurations synced. ✓");
    } catch (err: any) {
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleQuickAddList = async (kind: "procedures" | "surgeons" | "complications", selectId: string) => {
    const label = { procedures: "procedure", surgeons: "surgeon", complications: "complication type" }[kind] || "item";
    const v = (window.prompt(`Add new surgical ${label} name:`) || "").trim();
    if (!v || !db) return;

    let targetType: "procedures" | "surgeons" | "checklist" | "complications" = "procedures";
    if (kind === "surgeons") targetType = "surgeons";
    else if (kind === "complications") targetType = "complications";

    const arr = [...(db.lists as any)[targetType]];
    if (!arr.some((x) => x.toLowerCase() === v.toLowerCase())) {
      arr.push(v);
    }
    await handleSaveList(targetType, arr);
    setTimeout(() => {
      const el = document.getElementById(selectId) as HTMLSelectElement;
      if (el) el.value = v;
    }, 100);
  };

  // Switch tabs & scroll to top
  const toggleLanguage = () => {
    const nextLang = lang === "en" ? "ar" : "en";
    setLang(nextLang);
    localStorage.setItem("lang", nextLang);
  };

  const handleConfirmChain = async () => {
    if (!chainPrompt) return;
    const cp = chainPrompt;
    setChainPrompt(null);
    if (cp.type === "schedule-wound-check" || cp.type === "drain-removal-followup") {
      await handleAddAppointment({
        PatientID: cp.patientID,
        Date: cp.suggestedDate || "",
        Time: cp.suggestedTime || "",
        Type: cp.appointmentType || "",
        Notes: cp.type === "schedule-wound-check" ? "Auto-scheduled post-op wound check." : "Auto-scheduled post-drain-removal follow-up."
      });
      setActiveTab("appt");
    } else if (cp.type === "mark-drain-removed") {
      setBusy(true);
      try {
        const res = await fetch("/api/drains/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ PatientID: cp.patientID })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to remove drain.");
        setDb(data);
        showToast("Drain successfully marked as removed today. ✓");
      } catch (err: any) {
        showToast(err.message, true);
      } finally {
        setBusy(false);
      }
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpToCalendarDate = (dateStr: string) => {
    setJumpDate(dateStr);
    setActiveTab("appt");
  };

  const t = translations[lang];
  const isRTL = lang === "ar";

  if (loading || !db) {
    return (
      <div className={`fixed inset-0 bg-brand-bg flex flex-col justify-center items-center z-50 theme-${themeColor} transition-colors duration-300`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
          <p className="text-sm font-semibold text-brand-primary-light font-display tracking-wide animate-pulse">
            Loading Case Records from Cloud Storage...
          </p>
        </div>
      </div>
    );
  }

  // Nav items configuration
  const navItems = [
    { id: "dash", label: t.tabDashboard, icon: LayoutDashboard },
    { id: "ops", label: t.tabOpsLog, icon: ClipboardList },
    { id: "appt", label: t.tabCalendar, icon: Calendar },
    { id: "drains", label: t.tabDrains, icon: Droplet },
    { id: "comps", label: t.tabComplications, icon: AlertTriangle },
    { id: "fu", label: t.tabFollowUps, icon: Bookmark },
    { id: "drafts", label: t.tabDraftsQueue || "Drafts Hub", icon: FolderArchive },
    { id: "set", label: t.tabSettings, icon: Settings }
  ];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-brand-bg text-white relative overflow-hidden font-sans antialiased theme-${themeColor} transition-colors duration-300`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-primary/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-secondary/15 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Busy Spinner Header Bar */}
      {busy && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-primary-light via-brand-secondary-light to-brand-primary animate-pulse z-50 shadow-sm" />
      )}

      {/* MOBILE HEADER */}
      <header className="md:hidden bg-black/40 backdrop-blur-md text-white p-4 flex items-center justify-between sticky top-0 z-40 border-b border-white/10" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-slate-950 text-base shadow-sm shadow-brand-primary/25">
            ＋
          </div>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h1 className="font-display font-bold text-sm tracking-wide text-white">{t.appTitle}</h1>
            <span className="text-[10px] text-white/60 block -mt-1 font-semibold">{t.practiceMgmt}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/80 font-bold hover:bg-white/15 transition-all cursor-pointer"
          >
            {lang === "en" ? "AR" : "EN"}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* SIDEBAR NAVIGATION */}
      <aside
        className={`fixed md:sticky top-[60px] md:top-0 bottom-0 w-full md:w-64 bg-black/30 backdrop-blur-xl text-white z-30 transition-transform duration-300 md:translate-x-0 flex flex-col justify-between ${
          isRTL ? "right-0 border-l" : "left-0 border-r"
        } border-white/10 ${
          mobileMenuOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex-1 flex flex-col justify-between md:min-h-screen">
          <div>
            {/* Header Brand */}
            <div className="hidden md:flex items-center justify-between px-2 py-4 mb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary-light to-brand-secondary flex items-center justify-center font-bold text-slate-950 text-lg shadow-md shadow-brand-primary/20">
                  ＋
                </div>
                <div className={isRTL ? "text-right" : "text-left"}>
                  <h1 className="font-display font-bold text-base tracking-wide leading-none text-white">{t.appTitle}</h1>
                  <span className="text-[10px] text-white/40 font-semibold block mt-1 tracking-wider uppercase">
                    {t.practiceMgmt}
                  </span>
                </div>
              </div>
              <button
                onClick={toggleLanguage}
                className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white/80 font-semibold"
              >
                {lang === "en" ? "AR" : "EN"}
              </button>
            </div>

            {/* Nav Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const IconComp = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-left cursor-pointer ${
                      isActive
                        ? "bg-white/10 text-white border border-white/10 shadow-sm font-bold"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    } ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                  >
                    <IconComp className={`w-4.5 h-4.5 ${isActive ? "text-brand-primary" : "text-white/40 group-hover:text-white/60"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <button
                onClick={() => handleTabChange("new")}
                className={`w-full flex items-center justify-center gap-2 mt-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                  activeTab === "new"
                    ? "bg-white text-slate-950 font-bold border border-white/10"
                    : "bg-brand-primary hover:bg-brand-primary-hover text-white shadow-md hover:shadow-lg"
                } ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <PlusCircle className="w-4.5 h-4.5" />
                <span>{t.addCaseBtn}</span>
              </button>
            </nav>
          </div>

          {/* Current Session User Footer */}
          <div className="hidden md:block pt-4 border-t border-white/10 px-2 mt-6">
            <div className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}>
              <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/80">
                ☺
              </div>
              <div className="overflow-hidden">
                <span className="text-[10.5px] text-white/40 block uppercase font-bold tracking-wider leading-none">
                  {t.loggedInAs}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-400 truncate block mt-1 leading-none">
                  {db.user}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN SCREEN CONTENT */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full relative z-10">
        {activeTab === "dash" && (
          <Dashboard
            db={db}
            lang={lang}
            onOpenDrawer={(pid) => setSelectedPid(pid)}
            onGotoDay={jumpToCalendarDate}
          />
        )}

        {activeTab === "ops" && (
          <OperationsLog
            db={db}
            lang={lang}
            onOpenDrawer={(pid) => setSelectedPid(pid)}
            onOpenEdit={(row) => {
              const op = db.operations.find((x) => x._row === row);
              if (op) setEditingOperation(op);
            }}
            onOpenPhotos={handleOpenPhotos}
            onNavigateToNew={() => handleTabChange("new")}
          />
        )}

        {activeTab === "appt" && (
          <AppointmentsCalendar
            db={db}
            lang={lang}
            onAddAppointment={handleAddAppointment}
            onSetStatus={handleSetAppointmentStatus}
            onDeleteAppointment={handleDeleteAppointment}
            onOpenDrawer={(pid) => setSelectedPid(pid)}
            selectedDateFromDash={jumpDate}
            onClearDashDate={() => setJumpDate(undefined)}
          />
        )}

        {activeTab === "drains" && (
          <DrainageTracking
            db={db}
            lang={lang}
            onMarkRemoved={handleMarkDrainRemoved}
            onUndoRemoval={handleUndoDrainRemoval}
            onOpenDrawer={(pid) => setSelectedPid(pid)}
            onShowToast={(msg, err) => showToast(msg, err)}
          />
        )}

        {activeTab === "comps" && (
          <ComplicationsRegistry
            db={db}
            lang={lang}
            onAddComplication={handleAddComplication}
            onResolveComplication={handleResolveComplication}
            onOpenCompEdit={(row) => {
              const c = db.complications.find((x) => x._row === row);
              if (c) setEditingComplication(c);
            }}
            onOpenDrawer={(pid) => setSelectedPid(pid)}
            onQuickAddList={handleQuickAddList}
          />
        )}

        {activeTab === "fu" && (
          <FollowUpMilestones
            db={db}
            lang={lang}
            onSetFollowUp={handleSetFollowUp}
            onOpenDrawer={(pid) => setSelectedPid(pid)}
          />
        )}

        {activeTab === "drafts" && (
          <DraftsQueue
            lang={lang}
            onAddOperation={handleAddOperation}
            onAddComplication={handleAddComplication}
            onShowToast={(msg, err) => showToast(msg, err)}
          />
        )}

        {activeTab === "set" && (
          <SettingsPanel
            db={db}
            lang={lang}
            themeColor={themeColor}
            onThemeColorChange={handleThemeColorChange}
            onSaveConfig={handleSaveConfig}
            onSaveList={handleSaveList}
            onUploadBackup={handleUploadBackup}
          />
        )}

        {activeTab === "new" && (
          <NewOperationForm
            db={db}
            lang={lang}
            onAddOperation={handleAddOperation}
            onQuickAddList={handleQuickAddList}
          />
        )}
      </main>

      {/* GLOBAL TOAST ALERTS */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-2xl font-semibold text-xs transition-all duration-300 z-50 flex items-center gap-2 border backdrop-blur-md ${
            toast.isError
              ? "bg-rose-950/80 border-rose-500 text-rose-200"
              : "bg-emerald-950/80 border-emerald-500 text-emerald-200"
          }`}
        >
          {toast.isError ? <AlertTriangle className="w-4.5 h-4.5 text-rose-400" /> : <Clock className="w-4.5 h-4.5 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* DRAWERS & MODALS CONDITIONAL MOUNT */}
      <PatientTimelineDrawer
        pid={selectedPid}
        db={db}
        lang={lang}
        onClose={() => setSelectedPid(null)}
        onOpenEdit={(row) => {
          const op = db.operations.find((x) => x._row === row);
          if (op) setEditingOperation(op);
        }}
        onOpenPhotos={handleOpenPhotos}
        onToggleCheckItem={handleToggleCheckItem}
        onAddComplication={handleAddComplication}
      />

      {editingOperation && (
        <EditOperationModal
          operation={editingOperation}
          db={db}
          onClose={() => setEditingOperation(null)}
          onSave={handleUpdateOperation}
          onDelete={handleDeleteOperation}
          onQuickAddList={handleQuickAddList}
        />
      )}

      {editingComplication && (
        <EditComplicationModal
          complication={editingComplication}
          db={db}
          onClose={() => setEditingComplication(null)}
          onSave={handleUpdateComplication}
          onDelete={handleDeleteComplication}
        />
      )}

      {/* CHAINED WORKFLOW DIALOG MODAL */}
      {chainPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#061E1B]/95 border border-white/20 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-white animate-fade-in text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
              ⇄
            </div>
            <h3 className="font-display font-bold text-lg leading-snug">
              {chainPrompt.type === "schedule-wound-check" && t.chainWoundCheckTitle}
              {chainPrompt.type === "drain-removal-followup" && t.chainFollowUpTitle}
              {chainPrompt.type === "mark-drain-removed" && t.chainRemoveDrainTitle}
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              {chainPrompt.type === "schedule-wound-check" && t.chainWoundCheckBody}
              {chainPrompt.type === "drain-removal-followup" && t.chainFollowUpBody}
              {chainPrompt.type === "mark-drain-removed" && t.chainRemoveDrainBody}
            </p>
            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => {
                  setChainPrompt(null);
                  if (chainPrompt.type === "schedule-wound-check") {
                    setActiveTab("ops");
                  }
                }}
                className="flex-1 py-2 px-4 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-colors rounded-xl text-xs font-semibold text-white/60 hover:text-white cursor-pointer"
              >
                {t.dismissBtn}
              </button>
              <button
                onClick={handleConfirmChain}
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl text-xs font-bold text-white cursor-pointer border border-emerald-400/30 shadow-lg shadow-emerald-600/10"
              >
                {t.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
