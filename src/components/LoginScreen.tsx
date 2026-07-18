import React, { useState } from "react";
import { login } from "../api";
import { Lock, LogIn, ShieldCheck } from "lucide-react";

interface LoginScreenProps {
  themeColor: string;
  onSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ themeColor, onSuccess }) => {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await login(key.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Login failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 bg-brand-bg flex flex-col justify-center items-center p-6 theme-${themeColor} transition-colors duration-300 overflow-hidden`}>
      {/* Ambient mesh gradients */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-brand-primary/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-brand-secondary/15 rounded-full blur-[150px] pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 animate-fade-in"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary-light to-brand-secondary flex items-center justify-center text-slate-950 text-2xl font-bold shadow-lg shadow-brand-primary/25 mb-4">
            ＋
          </div>
          <h1 className="font-display font-bold text-xl text-white tracking-tight">Surgical Case Tracker</h1>
          <p className="text-xs text-white/50 mt-1 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" /> Secure Practice Access
          </p>
        </div>

        <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
          Master Key
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            autoFocus
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              if (error) setError("");
            }}
            placeholder="Enter master key"
            className={`w-full py-2.5 pl-9 pr-3 rounded-xl text-sm bg-white/5 text-white placeholder-white/30 border ${
              error ? "border-rose-500/70" : "border-white/10 focus:border-brand-primary"
            } focus:outline-none transition-colors`}
          />
        </div>

        {error && (
          <p className="text-rose-400 text-xs mt-2 font-semibold">⚠ {error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !key.trim()}
          className="w-full mt-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-brand-primary/20 shadow-lg"
        >
          <LogIn className="w-4 h-4" />
          {submitting ? "Verifying…" : "Sign In"}
        </button>

        <p className="text-[10px] text-white/30 text-center mt-5 leading-relaxed">
          Sessions stay active for 30 days on this device.
        </p>
      </form>
    </div>
  );
};
