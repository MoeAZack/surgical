import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { applyTheme, ThemeColor } from "./theme";
import { DBState, Operation, Complication } from "./types";
import { PatientTimelineDrawer } from "./components/PatientTimelineDrawer";
import { EditOperationModal } from "./components/EditOperationModal";
import { EditComplicationModal } from "./components/EditComplicationModal";
import { LoginScreen } from "./components/LoginScreen";
import { PatientPortal } from "./components/PatientPortal";
import { translations } from "./translations";
import { apiJson, jsonBody, OfflineError, AuthError, logout, getToken } from "./api";
import { enqueue, outboxSize, flushOutbox } from "./outbox";
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
  CloudOff,
  UploadCloud,
  LogOut,
  ScrollText,
  Lock,
  KeyRound,
  Copy,
  Send,
  Check
} from "lucide-react";

// Code-split the heavy tab views so the initial bundle stays small.
const Dashboard = lazy(() => import("./components/Dashboard").then((m) => ({ default: m.Dashboard })));
const OperationsLog = lazy(() => import("./components/OperationsLog").then((m) => ({ default: m.OperationsLog })));
const AppointmentsCalendar = lazy(() => import("./components/AppointmentsCalendar").then((m) => ({ default: m.AppointmentsCalendar })));
const DrainageTracking = lazy(() => import("./components/DrainageTracking").then((m) => ({ default: m.DrainageTracking })));
const ComplicationsRegistry = lazy(() => import("./components/ComplicationsRegistry").then((m) => ({ default: m.ComplicationsRegistry })));
const FollowUpMilestones = lazy(() => import("./components/FollowUpMilestones").then((m) => ({ default: m.FollowUpMilestones })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then((m) => ({ default: m.SettingsPanel })));
const NewOperationForm = lazy(() => import("./components/NewOperationForm").then((m) => ({ default: m.NewOperationForm })));
const OfflineQueue = lazy(() => import("./components/OfflineQueue").then((m) => ({ default: m.OfflineQueue })));
const AuditLog = lazy(() => import("./components/AuditLog").then((m) => ({ default: m.AuditLog })));

type OperationPayload = {
  PatientID: string;
  Age: number | "";
  OperationDate: string;
  Procedures: string[];
  Surgeons: string[];
  DrainPlaced: boolean;
  Notes: string;
  complications?: { Complication: string; Grade: string; DateDetected: string; Management: string }[];
};

type ComplicationPayload = {
  OperationID: string;
  PatientID?: string;
  Complication: string;
  Grade: string;
  DateDetected: string;
  Management: string;
};

const TabFallback = () => (
  <div className="flex justify-center items-center py-24">
    <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
  </div>
);

export default function App() {
  const [db, setDb] = useState<DBState | null>(null);
  const [authed, setAuthed] = useState<boolean>(false);
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [role, setRole] = useState<"full" | "readonly">("full");
  const [sessionKind, setSessionKind] = useState<"staff" | "patient" | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dash");
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  // Connectivity + offline outbox
  const [offline, setOffline] = useState<boolean>(!navigator.onLine);
  const [outboxCount, setOutboxCount] = useState<number>(outboxSize());

  // Bilingual Language State
  const [lang, setLang] = useState<"en" | "ar">(() => {
    return (localStorage.getItem("lang") as "en" | "ar") || "en";
  });

  // Accent Theme Color State
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
    return (localStorage.getItem("themeColor") as ThemeColor) || "emerald";
  });
  const rootRef = useRef<HTMLDivElement>(null);

  const handleThemeColorChange = (color: ThemeColor) => {
    setThemeColor(color);
    localStorage.setItem("themeColor", color);
  };

  // State for the custom React-based quick add prompt dialog
  const [quickAddPrompt, setQuickAddPrompt] = useState<{
    kind: "procedures" | "surgeons" | "complications";
    selectId: string;
    resolve: (value: string | undefined) => void;
  } | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");

  // Synchronize theme class on document.body for dynamic backgrounds, and
  // also apply the theme's variables as direct inline styles (belt-and-
  // suspenders — some browsers are slow to repaint var()-based backgrounds
  // behind backdrop-filter when only a class-based custom property changes).
  useEffect(() => {
    const classes = Array.from(document.body.classList).filter((c) => c.startsWith("theme-"));
    classes.forEach((c) => document.body.classList.remove(c));
    document.body.classList.add(`theme-${themeColor}`);
    applyTheme(rootRef.current, themeColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeColor, db]);

  // Chained Actions Proposal state
  const [chainPrompt, setChainPrompt] = useState<{
    type: "schedule-wound-check" | "drain-removal-followup" | "mark-drain-removed";
    patientID: string;
    operationID?: string;
    suggestedDate?: string;
    suggestedTime?: string;
    appointmentType?: string;
  } | null>(null);

  // Responsive mobile menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Shared drawers/modals state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [editingComplication, setEditingComplication] = useState<Complication | null>(null);
  const [patientCodeReveal, setPatientCodeReveal] = useState<{ code: string; OperationID: string; createdAt: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Calendar direct jump state from Dash upcoming cards
  const [jumpDate, setJumpDate] = useState<string | undefined>(undefined);

  // Utility toast handler
  const showToast = (message: string, isError: boolean = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3200);
  };

  // --- Data loading + offline sync ---------------------------------------
  const refetch = async () => {
    const data = await apiJson("/api/all");
    setDb(data);
    return data;
  };

  const flushIfNeeded = async () => {
    if (outboxSize() === 0 || !navigator.onLine) return;
    try {
      const result = await flushOutbox();
      setOutboxCount(outboxSize());
      if (result.synced > 0) {
        await refetch();
        showToast(`Synced ${result.synced} offline ${result.synced === 1 ? "entry" : "entries"} ✓`);
      }
      if (result.dropped > 0) {
        showToast(`${result.dropped} queued ${result.dropped === 1 ? "entry" : "entries"} were rejected by the server.`, true);
      }
    } catch {
      /* stay queued */
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await apiJson("/api/me");
      if (me.kind === "patient") {
        // Patient sessions never fetch the full practice database — they get
        // a separate, deliberately minimal endpoint (GET /api/patient/case)
        // that PatientPortal calls itself.
        setSessionKind("patient");
        return;
      }
      setSessionKind("staff");
      setIsPrimary(!!me.primary);
      setRole(me.role === "readonly" ? "readonly" : "full");
      await refetch();
      void flushIfNeeded();
    } catch (err: any) {
      if (err instanceof AuthError) {
        setAuthed(false);
      } else {
        showToast("Error loading database: " + err.message, true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Decide initial auth from the presence of a stored token; a stale token is
  // caught on the first load (401 -> AuthError -> login screen).
  useEffect(() => {
    if (getToken()) {
      setAuthed(true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Global listeners: toast bus, connectivity, outbox, auth expiry.
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) showToast(ce.detail.message, !!ce.detail.isError);
    };
    const onOnline = () => {
      setOffline(false);
      void flushIfNeeded();
    };
    const onOffline = () => setOffline(true);
    const onOutbox = () => setOutboxCount(outboxSize());
    const onAuthExpired = () => {
      setAuthed(false);
      setDb(null);
      showToast("Session expired — please sign in again.", true);
    };

    window.addEventListener("clinical_toast", handleToastEvent);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("surgical_outbox_changed", onOutbox);
    window.addEventListener("surgical_auth_expired", onAuthExpired);
    return () => {
      window.removeEventListener("clinical_toast", handleToastEvent);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("surgical_outbox_changed", onOutbox);
      window.removeEventListener("surgical_auth_expired", onAuthExpired);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    setDb(null);
    setAuthed(false);
    setActiveTab("dash");
  };

  // Shared mutation runner: sets busy, updates db, surfaces errors.
  const runMutation = async (fn: () => Promise<any>, successMsg?: string) => {
    setBusy(true);
    try {
      const data = await fn();
      setDb(data);
      if (successMsg) showToast(successMsg);
      return data;
    } catch (err: any) {
      if (err instanceof OfflineError) {
        showToast("You're offline — reconnect to make this change.", true);
      } else {
        showToast(err.message, true);
      }
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // --- Optimistic offline helpers ----------------------------------------
  const applyOptimisticOperation = (op: OperationPayload) => {
    setDb((prev) => {
      if (!prev) return prev;
      const localOp: any = {
        id: "local_" + Date.now(),
        PatientID: op.PatientID,
        Age: op.Age,
        OperationDate: op.OperationDate,
        Procedures: op.Procedures,
        Surgeons: op.Surgeons,
        Procedure: op.Procedures.join(", "),
        Surgeon: op.Surgeons.join(", "),
        DrainPlaced: op.DrainPlaced ? "Yes" : "No",
        Notes: op.Notes || "",
        __pending: true
      };
      const followup = prev.followup.some((f) => f.PatientID === op.PatientID)
        ? prev.followup
        : [...prev.followup, { id: "local_fu_" + Date.now(), PatientID: op.PatientID, M1: "—", M3: "—", M6: "—", M12: "—", FinalOutcome: "Ongoing" }];
      const extraComps = (op.complications || []).map((c, i) => ({
        id: "local_c_" + Date.now() + "_" + i,
        PatientID: op.PatientID,
        Complication: c.Complication || "Other",
        Grade: c.Grade || "",
        DateDetected: c.DateDetected || new Date().toISOString().split("T")[0],
        Management: c.Management || "",
        Resolved: "No",
        ResolvedDate: "",
        __pending: true
      }));
      return { ...prev, operations: [...prev.operations, localOp], followup, complications: [...prev.complications, ...extraComps] };
    });
  };

  const applyOptimisticComplication = (comp: ComplicationPayload) => {
    setDb((prev) => {
      if (!prev) return prev;
      const op = prev.operations.find((o) => o.id === comp.OperationID);
      const localComp: any = {
        id: "local_c_" + Date.now(),
        OperationID: comp.OperationID,
        PatientID: comp.PatientID || op?.PatientID || "",
        Complication: comp.Complication || "Other",
        Grade: comp.Grade || "",
        DateDetected: comp.DateDetected || new Date().toISOString().split("T")[0],
        Management: comp.Management || "",
        Resolved: "No",
        ResolvedDate: "",
        __pending: true
      };
      return { ...prev, complications: [...prev.complications, localComp] };
    });
  };

  // ---------------------------------------------------- API Action Handlers
  const handleAddOperation = async (op: OperationPayload) => {
    setBusy(true);
    try {
      const data = await apiJson("/api/operations", { method: "POST", ...jsonBody(op) });
      setDb(data);
      showToast("Surgical case saved successfully! ✓");

      if (op.DrainPlaced) {
        setChainPrompt({
          type: "schedule-wound-check",
          patientID: op.PatientID,
          suggestedDate: new Date(new Date(op.OperationDate).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          suggestedTime: "10:00",
          appointmentType: "Wound check"
        });
      } else {
        setActiveTab("ops");
      }
    } catch (err: any) {
      if (err instanceof OfflineError) {
        enqueue("operation", op);
        applyOptimisticOperation(op);
        setOutboxCount(outboxSize());
        showToast("Offline — case queued, will sync when you're back online.");
        setActiveTab("ops");
        return;
      }
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateOperation = async (updatedOp: {
    id: string;
    PatientID: string;
    Age: number | "";
    OperationDate: string;
    Procedures: string[];
    Surgeons: string[];
    DrainPlaced: boolean;
    Notes: string;
  }) => {
    await runMutation(
      () => apiJson("/api/operations", { method: "PUT", ...jsonBody(updatedOp) }),
      "Operational changes saved successfully! ✓"
    );
  };

  const handleDeleteOperation = async (id: string) => {
    await runMutation(
      () => apiJson(`/api/operations/${encodeURIComponent(id)}`, { method: "DELETE" }),
      "Case deleted."
    );
  };

  const handleMarkDrainRemoved = async (operationId: string) => {
    setBusy(true);
    try {
      const data = await apiJson("/api/drains/remove", { method: "POST", ...jsonBody({ OperationID: operationId }) });
      setDb(data);
      showToast("Drain successfully marked as removed.");
      const op = data.operations.find((o: any) => o.id === operationId);
      setChainPrompt({
        type: "drain-removal-followup",
        patientID: op?.PatientID || "",
        suggestedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        suggestedTime: "11:00",
        appointmentType: "1-week review"
      });
    } catch (err: any) {
      if (err instanceof OfflineError) showToast("You're offline — reconnect to make this change.", true);
      else showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUndoDrainRemoval = async (operationId: string) => {
    await runMutation(
      () => apiJson("/api/drains/undo", { method: "POST", ...jsonBody({ OperationID: operationId }) }),
      "Drain removal undone. Back in situ status."
    );
  };

  const handleAddComplication = async (comp: ComplicationPayload) => {
    setBusy(true);
    try {
      const data = await apiJson("/api/complications", { method: "POST", ...jsonBody(comp) });
      setDb(data);
      showToast("Complication successfully logged to registry.");
    } catch (err: any) {
      if (err instanceof OfflineError) {
        enqueue("complication", comp);
        applyOptimisticComplication(comp);
        setOutboxCount(outboxSize());
        showToast("Offline — complication queued, will sync when you're back online.");
        return;
      }
      showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateComplication = async (updatedComp: {
    id: string;
    Complication: string;
    Grade: string;
    DateDetected: string;
    Management: string;
    Resolved: boolean;
  }) => {
    await runMutation(
      () => apiJson("/api/complications", { method: "PUT", ...jsonBody(updatedComp) }),
      "Complication registry log updated successfully."
    );
  };

  const handleDeleteComplication = async (id: string) => {
    await runMutation(
      () => apiJson(`/api/complications/${encodeURIComponent(id)}`, { method: "DELETE" }),
      "Complication event log deleted."
    );
  };

  const handleResolveComplication = async (id: string) => {
    await runMutation(
      () => apiJson(`/api/complications/resolve/${encodeURIComponent(id)}`, { method: "POST" }),
      "Complication marked resolved successfully. ✓"
    );
  };

  const handleSetFollowUp = async (operationId: string, field: string, value: string) => {
    await runMutation(
      () => apiJson("/api/followup", { method: "POST", ...jsonBody({ OperationID: operationId, field, value }) }),
      "Milestone record saved."
    );
  };

  const handleToggleCheckItem = async (operationId: string, item: string, done: boolean) => {
    await runMutation(() => apiJson("/api/checks", { method: "POST", ...jsonBody({ OperationID: operationId, item, done }) }));
  };

  const handleAddAppointment = async (appt: { PatientID: string; Date: string; Time: string; Type: string; Notes: string }) => {
    await runMutation(
      () => apiJson("/api/appointments", { method: "POST", ...jsonBody(appt) }),
      "Appointment successfully scheduled."
    );
  };

  const handleSetAppointmentStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      const data = await apiJson("/api/appointments/status", { method: "POST", ...jsonBody({ id, status }) });
      setDb(data);
      showToast("Appointment status updated.");

      if (status === "Done") {
        const appt = db?.appointments.find((a) => a.id === id);
        if (appt) {
          const typeLower = appt.Type.toLowerCase();
          const notesLower = (appt.Notes || "").toLowerCase();
          if (typeLower.includes("drain") || typeLower.includes("removal") || notesLower.includes("drain") || notesLower.includes("removal")) {
            const op = db!.operations.find((o) => o.PatientID === appt.PatientID && o.DrainPlaced === "Yes" && !db!.drains.some((d) => d.OperationID === o.id));
            if (op) {
              setChainPrompt({ type: "mark-drain-removed", patientID: appt.PatientID, operationID: op.id });
            }
          }
        }
      }
    } catch (err: any) {
      if (err instanceof OfflineError) showToast("You're offline — reconnect to make this change.", true);
      else showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    await runMutation(
      () => apiJson(`/api/appointments/${encodeURIComponent(id)}`, { method: "DELETE" }),
      "Appointment calendar entry deleted."
    );
  };

  const handleSaveConfig = async (configData: DBState["config"]) => {
    await runMutation(
      () => apiJson("/api/config/save", { method: "POST", ...jsonBody(configData) }),
      "Milestone offsets and alert periods successfully configured! ✓"
    );
  };

  const handleSaveList = async (type: "surgeons" | "procedures" | "checklist" | "complications", items: string[], quiet = false) => {
    await runMutation(
      () => apiJson("/api/lists/save", { method: "POST", ...jsonBody({ type, items }) }),
      quiet ? undefined : `Master list for ${type} updated.`
    );
  };

  const handleUploadPhoto = async (payload: { OperationID: string; filename: string; mimeType: string; dataBase64: string }) => {
    await runMutation(
      () => apiJson("/api/photos", { method: "POST", ...jsonBody(payload) }),
      "Photo uploaded! ✓"
    );
  };

  const handleDeletePhoto = async (id: string) => {
    await runMutation(
      () => apiJson(`/api/photos/${encodeURIComponent(id)}`, { method: "DELETE" }),
      "Photo deleted."
    );
  };

  const handleIssuePatientKey = async (operationId: string) => {
    setBusy(true);
    try {
      const data = await apiJson(`/api/operations/${encodeURIComponent(operationId)}/patient-key`, { method: "POST" });
      const { issuedPatientCode, ...dbState } = data;
      setDb(dbState);
      setPatientCodeReveal(issuedPatientCode);
    } catch (err: any) {
      if (err instanceof OfflineError) showToast("You're offline — reconnect to make this change.", true);
      else showToast(err.message, true);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleRevokePatientKey = async (operationId: string) => {
    await runMutation(
      () => apiJson(`/api/operations/${encodeURIComponent(operationId)}/patient-key`, { method: "DELETE" }),
      "Patient access revoked."
    );
  };

  const handleUploadBackup = async (backupData: any) => {
    await runMutation(
      () => apiJson("/api/backup/upload", { method: "POST", ...jsonBody(backupData) }),
      "Data restore successful! All records synced. ✓"
    );
  };

  const handleQuickAddList = (kind: "procedures" | "surgeons" | "complications", selectId: string): Promise<string | undefined> => {
    return new Promise((resolve) => {
      setQuickAddValue("");
      setQuickAddPrompt({ kind, selectId, resolve });
    });
  };

  const handleConfirmQuickAdd = async () => {
    if (!quickAddPrompt || !db) return;
    const v = quickAddValue.trim();
    if (!v) {
      quickAddPrompt.resolve(undefined);
      setQuickAddPrompt(null);
      return;
    }

    let targetType: "procedures" | "surgeons" | "checklist" | "complications" = "procedures";
    if (quickAddPrompt.kind === "surgeons") targetType = "surgeons";
    else if (quickAddPrompt.kind === "complications") targetType = "complications";

    const arr = [...(db.lists as any)[targetType]];
    if (!arr.some((x) => x.toLowerCase() === v.toLowerCase())) {
      arr.push(v);
    }
    try {
      await handleSaveList(targetType, arr, true);
      quickAddPrompt.resolve(v);
    } catch {
      quickAddPrompt.resolve(undefined);
    } finally {
      setQuickAddPrompt(null);
    }
  };

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
    } else if (cp.type === "mark-drain-removed" && cp.operationID) {
      await runMutation(
        () => apiJson("/api/drains/remove", { method: "POST", ...jsonBody({ OperationID: cp.operationID }) }),
        "Drain successfully marked as removed today. ✓"
      );
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

  // --- Auth gate ---------------------------------------------------------
  if (!authed) {
    return <LoginScreen themeColor={themeColor} onSuccess={() => setAuthed(true)} />;
  }

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-brand-bg flex flex-col justify-center items-center z-50 theme-${themeColor} transition-colors duration-300`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
          <p className="text-sm font-semibold text-brand-primary-light font-display tracking-wide animate-pulse">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (sessionKind === "patient") {
    return <PatientPortal themeColor={themeColor} />;
  }

  if (!db) {
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

  const navItems = [
    { id: "dash", label: t.tabDashboard, icon: LayoutDashboard },
    { id: "ops", label: t.tabOpsLog, icon: ClipboardList },
    { id: "appt", label: t.tabCalendar, icon: Calendar },
    { id: "drains", label: t.tabDrains, icon: Droplet },
    { id: "comps", label: t.tabComplications, icon: AlertTriangle },
    { id: "fu", label: t.tabFollowUps, icon: Bookmark },
    { id: "audit", label: t.auditLogTitle, icon: ScrollText },
    { id: "queue", label: isRTL ? "قائمة المزامنة" : "Sync Queue", icon: UploadCloud },
    { id: "set", label: t.tabSettings, icon: Settings }
  ];

  return (
    <div ref={rootRef} className={`min-h-screen flex flex-col md:flex-row bg-brand-bg text-white relative overflow-hidden font-sans antialiased theme-${themeColor} transition-colors duration-300`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-primary/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-secondary/15 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Busy Spinner Header Bar */}
      {busy && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-primary-light via-brand-secondary-light to-brand-primary animate-pulse z-50 shadow-sm" />
      )}

      {/* Stacked status banners (read-only / offline / pending sync) */}
      {(role === "readonly" || offline || outboxCount > 0) && (
        <div className="fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5">
          {role === "readonly" && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg backdrop-blur-md border bg-slate-900/80 border-white/20 text-white/70">
              <Lock className="w-3.5 h-3.5" />
              {isRTL ? "وصول للقراءة فقط" : "Read-only access"}
            </div>
          )}
          {(offline || outboxCount > 0) && (
            <button
              onClick={() => handleTabChange("queue")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg backdrop-blur-md border transition-all cursor-pointer ${
                offline
                  ? "bg-amber-950/80 border-amber-500/50 text-amber-200"
                  : "bg-brand-primary/15 border-brand-primary/40 text-brand-primary-light"
              }`}
            >
              <CloudOff className="w-3.5 h-3.5" />
              {offline
                ? outboxCount > 0
                  ? `Offline · ${outboxCount} queued`
                  : "Offline — changes will queue"
                : `${outboxCount} pending sync — tap to sync`}
            </button>
          )}
        </div>
      )}

      {/* MOBILE HEADER */}
      <header className="safe-top md:hidden bg-black/40 backdrop-blur-md text-white p-4 flex items-center justify-between sticky top-0 z-40 border-b border-white/10" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-slate-950 text-base shadow-sm shadow-brand-primary/25">
            ＋
          </div>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h1 className="font-display font-bold text-sm tracking-wide text-white">{db.config.practiceName || t.appTitle}</h1>
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
        className={`safe-bottom fixed md:sticky top-[60px] md:top-0 bottom-0 w-full md:w-64 bg-black/30 backdrop-blur-xl text-white z-30 transition-transform duration-300 md:translate-x-0 flex flex-col justify-between ${
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
                  <h1 className="font-display font-bold text-base tracking-wide leading-none text-white">{db.config.practiceName || t.appTitle}</h1>
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
                const showBadge = item.id === "queue" && outboxCount > 0;
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
                    <IconComp className={`w-4.5 h-4.5 ${isActive ? "text-brand-primary" : "text-white/40"}`} />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="text-[10px] font-bold bg-brand-primary text-slate-950 rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                        {outboxCount}
                      </span>
                    )}
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
          <div className="hidden md:block pt-4 border-t border-white/10 px-2 mt-6 space-y-3">
            <div className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}>
              <div className={`w-2 h-2 rounded-full ${offline ? "bg-amber-400" : "bg-brand-primary"} shadow`} />
              <span className="text-[10.5px] text-white/50 font-semibold uppercase tracking-wider">
                {offline ? (isRTL ? "غير متصل" : "Offline") : (isRTL ? "متصل" : "Online")}
              </span>
            </div>
            <div className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}>
              <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/80">
                ☺
              </div>
              <div className="overflow-hidden flex-1">
                <span className="text-[10.5px] text-white/40 block uppercase font-bold tracking-wider leading-none">
                  {t.loggedInAs}
                </span>
                <span className="text-xs font-mono font-semibold text-brand-primary truncate block mt-1 leading-none">
                  {db.user}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer ${isRTL ? "flex-row-reverse" : ""}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              {isRTL ? "تسجيل الخروج" : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN SCREEN CONTENT */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full relative z-10">
        <Suspense fallback={<TabFallback />}>
          {activeTab === "dash" && (
            <Dashboard db={db} lang={lang} onOpenDrawer={(caseId) => setSelectedCaseId(caseId)} onGotoDay={jumpToCalendarDate} />
          )}

          {activeTab === "ops" && (
            <OperationsLog
              db={db}
              lang={lang}
              onOpenDrawer={(caseId) => setSelectedCaseId(caseId)}
              onOpenEdit={(id) => {
                const op = db.operations.find((x) => x.id === id);
                if (op) setEditingOperation(op);
              }}
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
              onOpenDrawer={(caseId) => setSelectedCaseId(caseId)}
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
              onOpenDrawer={(caseId) => setSelectedCaseId(caseId)}
              onShowToast={(msg, err) => showToast(msg, err)}
            />
          )}

          {activeTab === "comps" && (
            <ComplicationsRegistry
              db={db}
              lang={lang}
              onAddComplication={handleAddComplication}
              onResolveComplication={handleResolveComplication}
              onOpenCompEdit={(id) => {
                const c = db.complications.find((x) => x.id === id);
                if (c) setEditingComplication(c);
              }}
              onOpenDrawer={(caseId) => setSelectedCaseId(caseId)}
              onQuickAddList={handleQuickAddList}
            />
          )}

          {activeTab === "fu" && (
            <FollowUpMilestones db={db} lang={lang} onSetFollowUp={handleSetFollowUp} onOpenDrawer={(caseId) => setSelectedCaseId(caseId)} />
          )}

          {activeTab === "audit" && <AuditLog db={db} lang={lang} />}

          {activeTab === "queue" && (
            <OfflineQueue lang={lang} offline={offline} onSync={flushIfNeeded} />
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
              isPrimary={isPrimary}
            />
          )}

          {activeTab === "new" && (
            <NewOperationForm db={db} lang={lang} onAddOperation={handleAddOperation} onQuickAddList={handleQuickAddList} />
          )}
        </Suspense>
      </main>

      {/* GLOBAL TOAST ALERTS */}
      {toast && (
        <div
          className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-2xl font-semibold text-xs transition-all duration-300 z-50 flex items-center gap-2 border backdrop-blur-md max-w-[92vw] ${
            toast.isError
              ? "bg-rose-950/80 border-rose-500 text-rose-200"
              : "bg-brand-primary/10 border-brand-primary/30 text-brand-primary-light"
          }`}
        >
          {toast.isError ? <AlertTriangle className="w-4.5 h-4.5 text-rose-400" /> : <Clock className="w-4.5 h-4.5 text-brand-primary" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* DRAWERS & MODALS CONDITIONAL MOUNT */}
      <PatientTimelineDrawer
        caseId={selectedCaseId}
        db={db}
        lang={lang}
        onClose={() => setSelectedCaseId(null)}
        onOpenEdit={(id) => {
          const op = db.operations.find((x) => x.id === id);
          if (op) setEditingOperation(op);
        }}
        onToggleCheckItem={handleToggleCheckItem}
        onAddComplication={handleAddComplication}
        onUploadPhoto={handleUploadPhoto}
        onDeletePhoto={handleDeletePhoto}
        onIssuePatientKey={handleIssuePatientKey}
        onRevokePatientKey={handleRevokePatientKey}
        readOnly={role === "readonly"}
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

      {/* PATIENT ACCESS CODE REVEAL MODAL */}
      {patientCodeReveal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-brand-bg/95 border border-white/20 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-white text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded-full flex items-center justify-center mx-auto">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg leading-snug">
                {isRTL ? "رمز وصول المريضة" : "Patient Access Code"}
              </h3>
              <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                {isRTL
                  ? "شاركي هذا الرمز مع المريضة. لن يظهر مرة أخرى بعد إغلاق هذه النافذة."
                  : "Share this code with the patient. It won't be shown again after you close this."}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl py-4 px-3">
              <span className="font-mono font-bold text-2xl tracking-[0.15em] text-brand-primary-light select-all">
                {patientCodeReveal.code}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(patientCodeReveal.code);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-white/10 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5 text-brand-primary" /> : <Copy className="w-3.5 h-3.5" />}
                {codeCopied ? (isRTL ? "تم النسخ" : "Copied") : isRTL ? "نسخ" : "Copy"}
              </button>
              <button
                onClick={() => {
                  const msg = isRTL
                    ? `رمز الدخول الخاص بك لرفع صور المتابعة: ${patientCodeReveal.code}`
                    : `Your access code for uploading follow-up photos: ${patientCodeReveal.code}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-primary hover:bg-brand-primary-hover rounded-xl text-xs font-bold text-white cursor-pointer border border-brand-primary/20 shadow transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> WhatsApp
              </button>
            </div>
            <button
              onClick={() => setPatientCodeReveal(null)}
              className="w-full py-2 px-3 text-xs font-semibold text-white/50 hover:text-white cursor-pointer transition-colors"
            >
              {isRTL ? "تم" : "Done"}
            </button>
          </div>
        </div>
      )}

      {/* CHAINED WORKFLOW DIALOG MODAL */}
      {chainPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-bg/95 border border-white/20 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-white animate-fade-in text-center space-y-4">
            <div className="w-12 h-12 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
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
                className="flex-1 py-2 px-4 bg-brand-primary hover:bg-brand-primary-hover transition-colors rounded-xl text-xs font-bold text-white cursor-pointer border border-brand-primary/30 shadow-lg shadow-brand-primary/10"
              >
                {t.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM QUICK-ADD PROMPT DIALOG */}
      {quickAddPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-bg/95 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-white animate-fade-in space-y-4">
            <div>
              <span className="font-mono text-[10px] font-bold text-brand-primary uppercase tracking-wider block">
                Quick Add Entry
              </span>
              <h3 className="font-display font-bold text-base mt-1 text-white">
                Add New {quickAddPrompt.kind === "procedures" ? "Surgical Procedure" : quickAddPrompt.kind === "surgeons" ? "Surgeon" : "Complication Type"}
              </h3>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                Name / Label
              </label>
              <input
                autoFocus
                type="text"
                value={quickAddValue}
                onChange={(e) => setQuickAddValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmQuickAdd();
                  } else if (e.key === "Escape") {
                    quickAddPrompt.resolve(undefined);
                    setQuickAddPrompt(null);
                  }
                }}
                placeholder={
                  quickAddPrompt.kind === "procedures"
                    ? "e.g., Facelift"
                    : quickAddPrompt.kind === "surgeons"
                    ? "e.g., Dr. Jane Smith"
                    : "e.g., Seroma"
                }
                className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  quickAddPrompt.resolve(undefined);
                  setQuickAddPrompt(null);
                }}
                className="flex-1 py-2 px-4 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-colors rounded-xl text-xs font-semibold text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickAdd}
                disabled={!quickAddValue.trim()}
                className="flex-1 py-2 px-4 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/5 disabled:text-white/20 transition-colors rounded-xl text-xs font-bold text-slate-950 cursor-pointer border border-brand-primary-light/20"
              >
                Add Option
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
