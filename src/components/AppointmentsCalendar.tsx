import React, { useState, useEffect } from "react";
import { DBState, Appointment } from "../types";
import { fmt, iso, now0 } from "../utils";
import { ChevronLeft, ChevronRight, Calendar, Plus, Clock, FileText, Trash2 } from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

interface AppointmentsCalendarProps {
  db: DBState;
  onAddAppointment: (appt: { PatientID: string; Date: string; Time: string; Type: string; Notes: string }) => Promise<void>;
  onSetStatus: (id: string, status: string) => Promise<void>;
  onDeleteAppointment: (id: string) => Promise<void>;
  onOpenDrawer: (pid: string) => void;
  selectedDateFromDash?: string;
  onClearDashDate?: () => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const AppointmentsCalendar: React.FC<AppointmentsCalendarProps> = ({
  db,
  onAddAppointment,
  onSetStatus,
  onDeleteAppointment,
  onOpenDrawer,
  selectedDateFromDash,
  onClearDashDate
}) => {
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [calM, setCalM] = useState(new Date().getMonth());
  const [selDate, setSelDate] = useState(iso(now0()));

  // Form states
  const [pidInput, setPidInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [typeInput, setTypeInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);

  useEffect(() => {
    if (selectedDateFromDash) {
      const d = new Date(selectedDateFromDash);
      if (!isNaN(d.getTime())) {
        setCalY(d.getFullYear());
        setCalM(d.getMonth());
        setSelDate(selectedDateFromDash);
      }
      if (onClearDashDate) onClearDashDate();
    }
  }, [selectedDateFromDash]);

  const appointments = db.appointments;
  const listConfig = db.lists;

  useEffect(() => {
    if (listConfig.apptTypes && listConfig.apptTypes.length > 0 && !typeInput) {
      setTypeInput(listConfig.apptTypes[0]);
    }
  }, [listConfig, typeInput]);

  const calShift = (n: number) => {
    let m = calM + n;
    let y = calY;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setCalM(m);
    setCalY(y);
  };

  const calToday = () => {
    const t = now0();
    setCalY(t.getFullYear());
    setCalM(t.getMonth());
    setSelDate(iso(t));
  };

  const getStatusColor = (s: string) => {
    if (s === "Done") return "bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20 line-through opacity-75";
    if (s === "No-show") return "bg-rose-950/60 text-rose-300 border border-rose-500/30";
    if (s === "Cancelled") return "bg-white/5 text-white/40 border border-white/5 line-through opacity-60";
    return "bg-sky-950/60 text-sky-300 border border-sky-500/30";
  };

  const apptsOn = (ds: string) => {
    return appointments
      .filter((a) => a.Date === ds)
      .sort((a, b) => String(a.Time).localeCompare(String(b.Time)));
  };

  const handleAddAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pidInput.trim()) return;

    setSubmitting(true);
    try {
      await onAddAppointment({
        PatientID: pidInput.trim(),
        Date: selDate,
        Time: timeInput,
        Type: typeInput || "Other",
        Notes: notesInput
      });
      // reset form
      setPidInput("");
      setTimeInput("");
      setNotesInput("");
    } catch {
      // toast is already fired by parent handler
    } finally {
      setSubmitting(false);
    }
  };

  // Generate calendar grid
  const renderCalendarCells = () => {
    const first = new Date(calY, calM, 1);
    const firstDayIndex = first.getDay(); // 0 is Sunday
    const start = new Date(calY, calM, 1 - firstDayIndex);
    const todayS = iso(now0());
    const cells = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const ds = iso(d);
      const isOtherMonth = d.getMonth() !== calM;
      const dayAppts = apptsOn(ds);
      const shown = dayAppts.slice(0, 3);

      cells.push(
        <div
          key={i}
          onClick={() => setSelDate(ds)}
          className={`min-h-[92px] border-b border-r border-white/10 p-2 cursor-pointer transition-all flex flex-col justify-between ${
            isOtherMonth ? "bg-white/0 text-white/20 hover:bg-white/5" : "bg-white/5 text-white hover:bg-white/10"
          } ${ds === todayS ? "bg-brand-primary/10" : ""} ${ds === selDate ? "ring-2 ring-brand-primary ring-inset bg-white/15" : ""}`}
        >
          <div className="flex justify-between items-center">
            <span
              className={`text-xs font-display font-semibold inline-grid place-items-center rounded-full ${
                ds === todayS ? "w-5 h-5 bg-brand-primary text-slate-950 font-medium" : isOtherMonth ? "text-white/20" : "text-white/80"
              }`}
            >
              {d.getDate()}
            </span>
            {dayAppts.length > 3 && (
              <span className="text-[9px] bg-white/10 text-white/60 font-bold px-1.5 py-0.5 rounded-full border border-white/5">
                +{dayAppts.length - 3}
              </span>
            )}
          </div>

          <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
            {shown.map((appt) => (
              <div
                key={appt.id}
                className={`text-[9.5px] font-semibold px-1 py-0.5 rounded truncate max-w-full ${getStatusColor(
                  appt.Status
                )}`}
              >
                {appt.Time ? `${appt.Time} ` : ""}
                {appt.PatientID}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  const activeDayAppts = apptsOn(selDate);
  const selectedDateObject = new Date(selDate);

  return (
    <div className="space-y-6 animate-fade-in" id="appointments-view">
      <div>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight">Practice Schedule</h2>
        <p className="text-sm text-white/60 mt-1">
          Short-term patient visits before the standard follow-up schedule kicks in.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Calendar Grid Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-primary" />
              <h3 className="font-display font-bold text-white text-lg leading-none">
                {MONTHS[calM]} {calY}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => calShift(-1)}
                className="p-2 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={calToday}
                className="py-1.5 px-3 border border-white/10 rounded-xl hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => calShift(1)}
                className="p-2 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-display font-semibold text-[10.5px] uppercase tracking-wider text-white/40 py-2.5">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 border-l border-white/5">
            {renderCalendarCells()}
          </div>
        </div>

        {/* Selected Day Agenda & Form */}
        <div className="space-y-6">
          {/* Day Agenda Panel */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
            <h4 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center justify-between">
              <span>Agenda for:</span>
              <span className="text-brand-primary text-sm font-semibold font-sans">
                {selectedDateObject.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short"
                })}
              </span>
            </h4>

            <div className="divide-y divide-white/10 max-h-[300px] overflow-y-auto mt-4 space-y-1.5 pr-1">
              {activeDayAppts.length > 0 ? (
                activeDayAppts.map((a) => (
                  <div key={a.id} className="py-3 flex flex-col gap-2 group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-white/40" />
                        <span className="font-mono text-xs font-bold text-white/80">{a.Time || "—"}</span>
                      </div>
                      <span className="text-xs font-display font-semibold py-0.5 px-2 rounded-full bg-white/10 border border-white/5 text-white/80">
                        {a.Type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Check if patient ID exists in operations log */}
                      {db.operations.some((op) => op.PatientID === a.PatientID) ? (
                        <button
                          onClick={() => onOpenDrawer(a.PatientID)}
                          className="font-mono text-xs font-bold text-brand-primary-light hover:text-brand-primary hover:underline cursor-pointer"
                        >
                          {a.PatientID}
                        </button>
                      ) : (
                        <span className="font-sans text-xs font-bold text-white/80">{a.PatientID}</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <select
                          value={a.Status}
                          onChange={(e) => onSetStatus(a.id, e.target.value)}
                          className="text-[11px] font-semibold py-1 px-2 border border-white/10 rounded-lg focus:outline-none focus:border-brand-primary bg-[#0A2E2A] text-white"
                        >
                          {listConfig.apptStatus.map((status) => (
                            <option key={status} value={status} className="bg-[#0A2E2A] text-white">
                              {status}
                            </option>
                          ))}
                        </select>
                        {deletingRow === a.id ? (
                          <div className="flex items-center gap-1.5 animate-fade-in">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onDeleteAppointment(a.id);
                                } finally {
                                  setDeletingRow(null);
                                }
                              }}
                              className="text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRow(null)}
                              className="text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingRow(a.id)}
                            className="p-1.5 border border-white/10 rounded-lg hover:border-rose-400 text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {a.Notes && (
                      <div className="text-xs text-white/60 mt-1 flex items-start gap-1 bg-white/5 p-2 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-white/40 shrink-0 mt-0.5" />
                        <span className="leading-normal">{a.Notes}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-sm py-8 text-center">No appointments scheduled for this date.</p>
              )}
            </div>
          </div>

          {/* Add Appointment Form */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
            <h4 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-1">
              <Plus className="w-4 h-4 text-brand-primary" /> Add Visit
            </h4>

            <form onSubmit={handleAddAppt} className="space-y-4 mt-4">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                  Patient ID or Name
                </label>
                <input
                  type="text"
                  list="app-pids"
                  value={pidInput}
                  onChange={(e) => setPidInput(e.target.value)}
                  placeholder="e.g. PS-0142 or Walk-In Name"
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 bg-white/5 text-white placeholder-white/30"
                  required
                />
                <datalist id="app-pids">
                  {db.operations.map((o) => (
                    <option key={o.id} value={o.PatientID} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 bg-white/5 text-white placeholder-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Visit Type
                  </label>
                  <select
                    value={typeInput}
                    onChange={(e) => setTypeInput(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 bg-[#0A2E2A] text-white"
                  >
                    {listConfig.apptTypes.map((t) => (
                      <option key={t} value={t} className="bg-[#0A2E2A] text-white">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Notes
                  </label>
                  <VoiceInputButton
                    lang="en"
                    onTranscript={(text) => setNotesInput((prev) => prev ? prev + " " + text : text)}
                  />
                </div>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Sutures count, diagnostic criteria..."
                  className="w-full py-2 px-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 bg-white/5 text-white placeholder-white/30"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !pidInput}
                className="w-full bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 disabled:cursor-default text-white py-2.5 rounded-xl font-semibold text-sm transition-colors mt-2 cursor-pointer border border-brand-primary/20 shadow-lg"
              >
                {submitting ? "Scheduling..." : "Add Appointment"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
