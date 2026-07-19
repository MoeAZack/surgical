import React, { useState } from "react";
import { DBState } from "../types";
import { apiFetch } from "../api";
import { AccessKeysPanel } from "./AccessKeysPanel";
import { Sliders, Link as LinkIcon, Users, Clipboard, AlertTriangle, ListChecks, Download, Upload, Palette, Building2, Rows3, CloudCheck, FileSpreadsheet } from "lucide-react";

interface SettingsPanelProps {
  db: DBState;
  lang?: "en" | "ar";
  themeColor: "emerald" | "teal" | "indigo" | "rose" | "violet" | "amber" | "slate" | "blue";
  onThemeColorChange: (color: "emerald" | "teal" | "indigo" | "rose" | "violet" | "amber" | "slate" | "blue") => void;
  onSaveConfig: (config: DBState["config"]) => Promise<void>;
  onSaveList: (type: "surgeons" | "procedures" | "checklist" | "complications", items: string[], quiet?: boolean) => Promise<void>;
  onUploadBackup: (backupData: any) => Promise<void>;
  isPrimary: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  db,
  lang = "en",
  themeColor,
  onThemeColorChange,
  onSaveConfig,
  onSaveList,
  onUploadBackup,
  isPrimary
}) => {
  // Config state
  const [drainAlert, setDrainAlert] = useState(db.config.DrainAlertDays);
  const [fu1, setFu1] = useState(db.config.FU1);
  const [fu2, setFu2] = useState(db.config.FU2);
  const [fu3, setFu3] = useState(db.config.FU3);
  const [fu4, setFu4] = useState(db.config.FU4);
  const [practiceName, setPracticeName] = useState(db.config.practiceName || "");
  const [defaultRowsPerPage, setDefaultRowsPerPage] = useState(db.config.defaultRowsPerPage || 10);
  const [savingConfig, setSavingConfig] = useState(false);

  // List states
  const [surgeons, setSurgeons] = useState<string[]>([...db.lists.surgeons]);
  const [newSurgeon, setNewSurgeon] = useState("");

  const [procedures, setProcedures] = useState<string[]>([...db.lists.procedures]);
  const [newProcedure, setNewProcedure] = useState("");

  const [checklist, setChecklist] = useState<string[]>([...db.lists.checklistItems]);
  const [newCheckItem, setNewCheckItem] = useState("");

  const [complications, setComplications] = useState<string[]>([...db.lists.complications]);
  const [newComplication, setNewComplication] = useState("");

  // Backup states
  const [uploadingBackup, setUploadingBackup] = useState(false);

  // Handle saving configuration
  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await onSaveConfig({
        DrainAlertDays: Number(drainAlert),
        FU1: Number(fu1),
        FU2: Number(fu2),
        FU3: Number(fu3),
        FU4: Number(fu4),
        practiceName,
        defaultRowsPerPage: Number(defaultRowsPerPage)
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Add an item and persist immediately (no separate Save press needed).
  const addAndSave = async (
    type: "surgeons" | "procedures" | "checklist" | "complications",
    value: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    inputSetter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const val = value.trim();
    if (!val) return;
    if (list.some((p) => p.toLowerCase() === val.toLowerCase())) {
      inputSetter("");
      return;
    }
    const next = [...list, val];
    setList(next);
    inputSetter("");
    try {
      await onSaveList(type, next);
    } catch {
      /* toast fired by parent */
    }
  };

  // Remove an item and persist immediately.
  const removeAndSave = async (
    type: "surgeons" | "procedures" | "checklist" | "complications",
    index: number,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const next = list.filter((_, i) => i !== index);
    setList(next);
    try {
      await onSaveList(type, next);
    } catch {
      /* toast fired by parent */
    }
  };

  // Authenticated file download (endpoints require a session token, so a
  // plain <a href> won't work — fetch as a blob and save it).
  const downloadAuthed = async (path: string, filename: string, failureLabel: string) => {
    try {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: `${failureLabel}: ${err.message}`, isError: true } }));
    }
  };

  const handleDownloadBackup = () => downloadAuthed("/api/backup/download", "surgical_case_tracker_backup.json", "Backup download failed");
  const handleExportCsv = () => downloadAuthed("/api/export/csv", `surgical_cases_export_${new Date().toISOString().split("T")[0]}.csv`, "Export failed");

  // Handle change of an item in list (persisted on blur via persistOnBlur below).
  const changeLocalItem = (index: number, val: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  // Persist a renamed item once the field loses focus, so edits save without a
  // separate Save button while not firing a request on every keystroke.
  const persistOnBlur = (type: "surgeons" | "procedures" | "checklist" | "complications", list: string[]) => {
    onSaveList(type, list, true).catch(() => {});
  };

  // Handle backup file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBackup(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        await onUploadBackup(parsed);
        window.dispatchEvent(new CustomEvent("clinical_toast", { 
          detail: { message: "Database successfully restored from backup! ✓", isError: false } 
        }));
      } catch (err: any) {
        window.dispatchEvent(new CustomEvent("clinical_toast", { 
          detail: { message: "Failed to parse backup file: " + err.message, isError: true } 
        }));
      } finally {
        setUploadingBackup(false);
        // Clear input
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-fade-in" id="settings-view">
      <div>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight">System Settings</h2>
        <p className="text-sm text-white/60 mt-1">
          Adjust alert configurations, milestone offsets, and editable surgeons, procedures, and checklists.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert & Schedule Config Form */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-2">
          <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-5">
            <Sliders className="w-4 h-4 text-brand-primary" /> General, Alerts & Milestone Schedule
          </h3>

          <form onSubmit={handleConfigSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> Practice Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cairo Aesthetic Surgery"
                  maxLength={60}
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Rows3 className="w-3 h-3" /> Default Rows Per Page
                </label>
                <select
                  value={defaultRowsPerPage}
                  onChange={(e) => setDefaultRowsPerPage(Number(e.target.value))}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-brand-bg text-white"
                >
                  {[5, 10, 25, 50].map((n) => (
                    <option key={n} value={n} className="bg-brand-bg text-white">{n} rows</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                  Drain Alert (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={drainAlert}
                  onChange={(e) => setDrainAlert(Number(e.target.value))}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                  M1 (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={fu1}
                  onChange={(e) => setFu1(Number(e.target.value))}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                  M2 (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={fu2}
                  onChange={(e) => setFu2(Number(e.target.value))}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                  M3 (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={fu3}
                  onChange={(e) => setFu3(Number(e.target.value))}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                  M4 (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={fu4}
                  onChange={(e) => setFu4(Number(e.target.value))}
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-white/5 text-white"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 disabled:cursor-default text-white py-2 px-5 rounded-xl font-semibold text-sm transition-colors cursor-pointer border border-brand-primary/20 shadow-lg"
              >
                {savingConfig ? "Saving Schedule..." : "Save Config Schedule"}
              </button>
            </div>
          </form>
        </div>

        {/* Accent Theme + Session */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-brand-primary" /> Visual Accent Theme
            </h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Choose a clinical color palette to personalize your workspace interface:
            </p>
            <div className="grid grid-cols-4 gap-1.5 pt-3">
              {[
                { id: "emerald", label: "Emerald", color: "bg-emerald-500 border-emerald-400" },
                { id: "teal", label: "Teal", color: "bg-teal-500 border-teal-400" },
                { id: "indigo", label: "Indigo", color: "bg-indigo-500 border-indigo-400" },
                { id: "rose", label: "Rose", color: "bg-rose-500 border-rose-400" },
                { id: "violet", label: "Violet", color: "bg-violet-500 border-violet-400" },
                { id: "amber", label: "Amber", color: "bg-amber-500 border-amber-400" },
                { id: "slate", label: "Slate", color: "bg-zinc-400 border-zinc-300" },
                { id: "blue", label: "Blue", color: "bg-blue-500 border-blue-400" }
              ].map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => onThemeColorChange(th.id as any)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                    themeColor === th.id
                      ? "bg-white/10 border-white/40 shadow-md scale-105"
                      : "bg-white/5 border-white/5 hover:border-white/15"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${th.color} border shadow-inner`} />
                  <span className="text-[9px] font-bold text-white/80">{th.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between">
            <span className="text-xs text-white/40">Current Session User:</span>
            <span className="text-xs font-mono font-bold text-brand-primary">{db.user}</span>
          </div>
        </div>

        {/* Backup & Data Recovery */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-2">
          <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-2">
            <LinkIcon className="w-4 h-4 text-brand-primary" /> Backup & Data Recovery
          </h3>
          <p className="text-xs text-white/60 leading-normal flex items-start gap-1.5 mt-2">
            <CloudCheck className="w-3.5 h-3.5 text-brand-primary shrink-0 mt-0.5" />
            Every change here saves straight to the cloud automatically, and a dated backup is written to storage every day. The buttons below are an extra manual safety net — export a snapshot before major changes, or restore from a prior export if needed.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full border border-white/10 hover:border-brand-primary/30 bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0 text-brand-primary" />
              Download Snapshot (.json)
            </button>

            <label className="w-full border border-white/10 hover:border-brand-primary/30 bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer relative">
              <Upload className="w-4 h-4 shrink-0 text-brand-primary" />
              <span>{uploadingBackup ? "Restoring..." : "Restore Snapshot (.json)"}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={uploadingBackup}
              />
            </label>

            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full sm:col-span-2 border border-white/10 hover:border-brand-primary/30 bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-brand-primary" />
              Export Cases as CSV (Excel-compatible)
            </button>
          </div>
        </div>

        {isPrimary && <AccessKeysPanel lang={lang} />}
      </div>

      {/* Editable List Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Surgeons list */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-brand-primary" /> Surgeons List
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto mb-4 pr-1">
            {surgeons.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={s}
                  onChange={(e) => changeLocalItem(i, e.target.value, setSurgeons)}
                  onBlur={() => persistOnBlur("surgeons", surgeons)}
                  className="flex-1 py-1 px-3 border border-white/10 focus:border-brand-primary bg-white/5 text-white rounded-lg text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAndSave("surgeons", i, surgeons, setSurgeons)}
                  className="text-white/40 hover:text-rose-400 font-bold p-1 text-sm shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New surgeon..."
              value={newSurgeon}
              onChange={(e) => setNewSurgeon(e.target.value)}
              className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white"
            />
            <button
              type="button"
              onClick={() => addAndSave("surgeons", newSurgeon, surgeons, setSurgeons, setNewSurgeon)}
              className="bg-white/10 hover:bg-white/15 text-white py-1.5 px-3.5 rounded-xl font-semibold text-xs shrink-0 cursor-pointer"
            >
              Add
            </button>
          </div>

        </div>

        {/* Procedures list */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-4">
            <Clipboard className="w-4 h-4 text-brand-primary" /> Surgical Procedures
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto mb-4 pr-1">
            {procedures.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p}
                  onChange={(e) => changeLocalItem(i, e.target.value, setProcedures)}
                  onBlur={() => persistOnBlur("procedures", procedures)}
                  className="flex-1 py-1 px-3 border border-white/10 focus:border-brand-primary bg-white/5 text-white rounded-lg text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAndSave("procedures", i, procedures, setProcedures)}
                  className="text-white/40 hover:text-rose-400 font-bold p-1 text-sm shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New procedure..."
              value={newProcedure}
              onChange={(e) => setNewProcedure(e.target.value)}
              className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white"
            />
            <button
              type="button"
              onClick={() => addAndSave("procedures", newProcedure, procedures, setProcedures, setNewProcedure)}
              className="bg-white/10 hover:bg-white/15 text-white py-1.5 px-3.5 rounded-xl font-semibold text-xs shrink-0 cursor-pointer"
            >
              Add
            </button>
          </div>

        </div>

        {/* Checklist list */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-brand-primary" /> Patient Checklist Items
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto mb-4 pr-1">
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={c}
                  onChange={(e) => changeLocalItem(i, e.target.value, setChecklist)}
                  onBlur={() => persistOnBlur("checklist", checklist)}
                  className="flex-1 py-1 px-3 border border-white/10 focus:border-brand-primary bg-white/5 text-white rounded-lg text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAndSave("checklist", i, checklist, setChecklist)}
                  className="text-white/40 hover:text-rose-400 font-bold p-1 text-sm shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New checklist item..."
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white"
            />
            <button
              type="button"
              onClick={() => addAndSave("checklist", newCheckItem, checklist, setChecklist, setNewCheckItem)}
              className="bg-white/10 hover:bg-white/15 text-white py-1.5 px-3.5 rounded-xl font-semibold text-xs shrink-0 cursor-pointer"
            >
              Add
            </button>
          </div>

          <p className="text-[10px] text-white/40 mt-3 leading-normal">
            * Renaming an item un-ticks it on existing patients, as checked records are saved by the checklist string.
          </p>

        </div>

        {/* Complications list */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-brand-primary" /> Complication Types
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto mb-4 pr-1">
            {complications.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={c}
                  onChange={(e) => changeLocalItem(i, e.target.value, setComplications)}
                  onBlur={() => persistOnBlur("complications", complications)}
                  className="flex-1 py-1 px-3 border border-white/10 focus:border-brand-primary bg-white/5 text-white rounded-lg text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAndSave("complications", i, complications, setComplications)}
                  className="text-white/40 hover:text-rose-400 font-bold p-1 text-sm shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New complication..."
              value={newComplication}
              onChange={(e) => setNewComplication(e.target.value)}
              className="flex-1 py-2 px-3 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white"
            />
            <button
              type="button"
              onClick={() => addAndSave("complications", newComplication, complications, setComplications, setNewComplication)}
              className="bg-white/10 hover:bg-white/15 text-white py-1.5 px-3.5 rounded-xl font-semibold text-xs shrink-0 cursor-pointer"
            >
              Add
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
