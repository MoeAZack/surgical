import React, { useEffect, useState } from "react";
import { getOutbox, removeItem, OutboxItem } from "../outbox";
import { UploadCloud, Trash2, Wifi, WifiOff, CheckCircle2, ClipboardList, AlertTriangle } from "lucide-react";

interface OfflineQueueProps {
  lang: "en" | "ar";
  offline: boolean;
  onSync: () => Promise<void>;
}

export const OfflineQueue: React.FC<OfflineQueueProps> = ({ lang, offline, onSync }) => {
  const isRTL = lang === "ar";
  const [items, setItems] = useState<OutboxItem[]>(getOutbox());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(getOutbox());
    window.addEventListener("surgical_outbox_changed", refresh);
    return () => window.removeEventListener("surgical_outbox_changed", refresh);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
      setItems(getOutbox());
    }
  };

  const describe = (item: OutboxItem): string => {
    const p = item.payload || {};
    if (item.kind === "operation") {
      const procs = Array.isArray(p.Procedures) ? p.Procedures.join(", ") : p.Procedure || "";
      return `${p.PatientID || "—"} · ${procs || "Case"}`;
    }
    return `${p.PatientID || "—"} · ${p.Complication || "Complication"}`;
  };

  return (
    <div className="space-y-6 animate-fade-in" dir={isRTL ? "rtl" : "ltr"}>
      <div className={isRTL ? "text-right" : "text-left"}>
        <h2 className="text-3xl font-display font-semibold text-white tracking-tight">
          {isRTL ? "قائمة المزامنة" : "Sync Queue"}
        </h2>
        <p className="text-sm text-white/60 mt-1">
          {isRTL
            ? "تُحفظ الحالات الجديدة مباشرة على السحابة. عند انقطاع الاتصال، تُدرَج هنا وتُزامَن تلقائياً عند عودة الإنترنت."
            : "New records save straight to the cloud. If the connection drops, they queue here and sync automatically once you're back online."}
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {offline ? (
              <WifiOff className="w-4 h-4 text-amber-400" />
            ) : (
              <Wifi className="w-4 h-4 text-brand-primary" />
            )}
            <span className="text-sm font-semibold text-white">
              {offline ? (isRTL ? "غير متصل" : "Offline") : (isRTL ? "متصل" : "Online")}
            </span>
            <span className="text-xs text-white/40 font-mono">
              · {items.length} {isRTL ? "في الانتظار" : "queued"}
            </span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || offline || items.length === 0}
            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 text-white py-2 px-4 rounded-xl font-semibold text-xs transition-colors cursor-pointer border border-brand-primary/20 shadow-lg"
          >
            <UploadCloud className={`w-4 h-4 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? (isRTL ? "جاري المزامنة..." : "Syncing…") : (isRTL ? "مزامنة الآن" : "Sync now")}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-brand-primary/70 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white/70">
              {isRTL ? "كل شيء متزامن ✓" : "Everything is synced ✓"}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {isRTL
                ? "لا توجد سجلات في انتظار المزامنة."
                : "No records are waiting to upload."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {items.map((item) => (
              <div key={item.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.kind === "operation" ? "bg-brand-primary/15 text-brand-primary" : "bg-amber-500/15 text-amber-400"}`}>
                    {item.kind === "operation" ? <ClipboardList className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{describe(item)}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">
                      {item.kind === "operation" ? (isRTL ? "حالة جراحية" : "Surgical case") : (isRTL ? "مضاعفة" : "Complication")}
                      {" · "}
                      {new Date(item.createdAt).toLocaleString(isRTL ? "ar" : "en-GB")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    removeItem(item.id);
                    setItems(getOutbox());
                  }}
                  title={isRTL ? "إزالة من القائمة" : "Discard queued entry"}
                  className="text-white/40 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
