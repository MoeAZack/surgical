import React, { useEffect, useState } from "react";
import { apiJson } from "../api";
import { KeyRound, Plus, Trash2, ShieldCheck, Eye, Pencil } from "lucide-react";

interface AccessKey {
  id: string;
  label: string;
  role: "full" | "readonly";
  createdAt: string;
}

/** Lets the primary master key holder issue additional sign-in keys for other
 *  staff (e.g. other surgeons), each with its own label and permission level,
 *  without sharing the primary key. Only rendered for the primary session. */
export const AccessKeysPanel: React.FC<{ lang: "en" | "ar" }> = ({ lang }) => {
  const isRTL = lang === "ar";
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newRole, setNewRole] = useState<"full" | "readonly">("full");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await apiJson("/api/keys");
      setKeys(data.keys || []);
    } catch {
      /* toast via global handler on 401; otherwise silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!label.trim() || newKey.trim().length < 4) {
      setError(isRTL ? "الاسم والمفتاح (٤ أحرف على الأقل) مطلوبان" : "Name and a key of at least 4 characters are required.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiJson("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), key: newKey.trim(), role: newRole })
      });
      setKeys(data.keys || []);
      setLabel("");
      setNewKey("");
      setNewRole("full");
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: isRTL ? "تمت إضافة مفتاح الدخول! ✓" : "Access key added! ✓" } }));
    } catch (err: any) {
      setError(err.message || "Failed to add key.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const data = await apiJson(`/api/keys/${id}`, { method: "DELETE" });
      setKeys(data.keys || []);
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: isRTL ? "تم إبطال مفتاح الدخول." : "Access key revoked." } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: err.message, isError: true } }));
    }
  };

  const handleToggleRole = async (k: AccessKey) => {
    const nextRole = k.role === "full" ? "readonly" : "full";
    try {
      const data = await apiJson(`/api/keys/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole })
      });
      setKeys(data.keys || []);
      window.dispatchEvent(new CustomEvent("clinical_toast", {
        detail: { message: isRTL ? `تم تغيير الصلاحية إلى ${nextRole === "full" ? "كاملة" : "للقراءة فقط"}` : `Permission changed to ${nextRole === "full" ? "Full access" : "Read-only"}.` }
      }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent("clinical_toast", { detail: { message: err.message, isError: true } }));
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
      <h3 className="font-display font-bold text-white text-base border-b border-white/10 pb-3 flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4 text-brand-primary" /> {isRTL ? "مفاتيح الدخول" : "Access Keys"}
      </h3>
      <p className="text-xs text-white/50 leading-relaxed mb-4 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-brand-primary shrink-0 mt-0.5" />
        {isRTL
          ? "أضف مفاتيح دخول إضافية لجراحين أو موظفين آخرين لتسجيل الدخول دون مشاركة مفتاحك الرئيسي. يمكنك جعل أي مفتاح للقراءة فقط."
          : "Issue additional sign-in keys for other surgeons or staff so they can log in without sharing your primary key. Any key can be made read-only."}
      </p>

      {!loading && (
        <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto pr-1">
          {keys.length === 0 ? (
            <p className="text-xs text-white/30 italic py-2">{isRTL ? "لا توجد مفاتيح إضافية بعد." : "No additional keys yet."}</p>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{k.label}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${
                      k.role === "readonly"
                        ? "bg-amber-950/50 border-amber-500/30 text-amber-300"
                        : "bg-brand-primary/10 border-brand-primary/20 text-brand-primary-light"
                    }`}>
                      {k.role === "readonly" ? (isRTL ? "قراءة فقط" : "Read-only") : (isRTL ? "كاملة" : "Full access")}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40">
                    {isRTL ? "أُضيف في" : "Added"} {new Date(k.createdAt).toLocaleDateString(isRTL ? "ar" : "en-GB")}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleRole(k)}
                    title={isRTL ? "تبديل الصلاحية" : "Toggle permission"}
                    className="text-white/40 hover:text-brand-primary-light p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {k.role === "readonly" ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(k.id)}
                    title={isRTL ? "إبطال" : "Revoke"}
                    className="text-white/40 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2 pt-3 border-t border-white/10">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder={isRTL ? "الاسم (مثال: د. سارة)" : "Name (e.g. Dr. Sarah)"}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="py-2 px-3 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30"
          />
          <input
            type="password"
            placeholder={isRTL ? "مفتاح جديد" : "New key"}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="py-2 px-3 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-brand-primary bg-white/5 text-white placeholder-white/30"
          />
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setNewRole("full")}
            className={`flex-1 py-1.5 rounded-lg font-semibold border cursor-pointer transition-colors ${
              newRole === "full"
                ? "bg-brand-primary/15 border-brand-primary/40 text-brand-primary-light"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {isRTL ? "صلاحية كاملة" : "Full access"}
          </button>
          <button
            type="button"
            onClick={() => setNewRole("readonly")}
            className={`flex-1 py-1.5 rounded-lg font-semibold border cursor-pointer transition-colors ${
              newRole === "readonly"
                ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {isRTL ? "قراءة فقط" : "Read-only"}
          </button>
        </div>
        {error && <p className="text-rose-400 text-[10.5px] font-semibold">⚠ {error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 text-white py-2 rounded-xl font-semibold text-xs transition-colors cursor-pointer border border-brand-primary/20 shadow-lg flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {submitting ? (isRTL ? "جارٍ الإضافة..." : "Adding...") : (isRTL ? "إضافة مفتاح دخول" : "Add Access Key")}
        </button>
      </form>
    </div>
  );
};
