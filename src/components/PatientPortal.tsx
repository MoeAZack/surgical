import React, { useEffect, useRef, useState } from "react";
import { PatientPortalPhoto } from "../types";
import { apiJson, logout } from "../api";
import { AuthedImage } from "./AuthedImage";
import { ImagePlus, Trash2, LogOut, X, Camera } from "lucide-react";

const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

interface PatientPortalProps {
  themeColor: string;
}

/** Minimal, mobile-first portal for a patient-scoped access code. Deliberately
 *  shows no clinical data — no procedure name, dates, or record contents —
 *  just an upload area for her own complication/follow-up photos and a grid
 *  of what she's already sent. */
export const PatientPortal: React.FC<PatientPortalProps> = ({ themeColor }) => {
  const [lang, setLang] = useState<"en" | "ar">(() => (localStorage.getItem("lang") as "en" | "ar") || "en");
  const isRTL = lang === "ar";
  const toggleLang = () => {
    const next = lang === "en" ? "ar" : "en";
    setLang(next);
    localStorage.setItem("lang", next);
  };

  const [photos, setPhotos] = useState<PatientPortalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiJson("/api/patient/case")
      .then((data) => setPhotos(data.photos || []))
      .catch(() => setError(isRTL ? "تعذر تحميل الصور." : "Couldn't load your photos."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError(isRTL ? "الملفات المدعومة صور فقط." : "Only image files are supported.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(isRTL ? "يجب أن تكون الصورة أقل من 6 ميغابايت." : "Image must be under 6MB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        const data = await apiJson("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: base64 })
        });
        setPhotos(data.photos || []);
      } catch (err: any) {
        setError(err.message || (isRTL ? "فشل الرفع." : "Upload failed."));
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploading(false);
      setError(isRTL ? "فشل قراءة الملف." : "Failed to read the file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string) => {
    try {
      const data = await apiJson(`/api/photos/${encodeURIComponent(id)}`, { method: "DELETE" });
      setPhotos(data.photos || []);
    } catch (err: any) {
      setError(err.message || (isRTL ? "فشل الحذف." : "Delete failed."));
    }
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <div className={`min-h-screen bg-brand-bg text-white relative overflow-hidden font-sans antialiased theme-${themeColor} transition-colors duration-300`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-primary/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-secondary/15 rounded-full blur-[150px] pointer-events-none" />

      <header className="relative z-10 bg-black/30 backdrop-blur-md border-b border-white/10 safe-top">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-slate-950 text-base shadow-sm shadow-brand-primary/25">
              ＋
            </div>
            <span className="font-display font-bold text-sm tracking-wide text-white">
              {isRTL ? "بوابة رفع الصور" : "Photo Upload"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/80 font-bold hover:bg-white/15 transition-all cursor-pointer"
            >
              {lang === "en" ? "AR" : "EN"}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[11px] bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 font-semibold cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {isRTL ? "خروج" : "Sign Out"}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/30 text-brand-primary flex items-center justify-center mx-auto">
            <Camera className="w-6 h-6" />
          </div>
          <h1 className="font-display font-bold text-xl text-white">
            {isRTL ? "شارك صورة مع طبيبك" : "Share a photo with your surgeon"}
          </h1>
          <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
            {isRTL
              ? "استخدمي هذا الرابط لإرسال صور المتابعة أو أي ملاحظة قد تستدعي مراجعة. سيقوم فريق العيادة بمراجعتها."
              : "Use this to send follow-up or possible-complication photos. Your clinical team will review them."}
          </p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelected} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-white/10 disabled:text-white/30 text-white py-3.5 rounded-2xl font-semibold text-sm transition-colors cursor-pointer border border-brand-primary/20 shadow-lg"
        >
          <ImagePlus className="w-5 h-5" />
          {uploading ? (isRTL ? "جارٍ الرفع..." : "Uploading…") : (isRTL ? "رفع صورة" : "Upload a Photo")}
        </button>

        {error && (
          <p className="text-rose-400 text-xs font-semibold text-center">⚠ {error}</p>
        )}

        <div>
          <h2 className="text-[10.5px] font-bold text-white/40 uppercase tracking-wider mb-3">
            {isRTL ? "الصور المرسلة" : "Your Uploaded Photos"}
          </h2>
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5">
                  <AuthedImage
                    src={`/api/photos/${p.id}`}
                    alt={p.filename}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setPreviewId(p.id)}
                  />
                  <button
                    onClick={() => handleDelete(p.id)}
                    title={isRTL ? "حذف" : "Delete"}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
              <p className="text-white/40 text-xs italic">
                {isRTL ? "لم تقومي برفع أي صور بعد." : "You haven't uploaded any photos yet."}
              </p>
            </div>
          )}
        </div>
      </main>

      {previewId && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6" onClick={() => setPreviewId(null)}>
          <button
            onClick={() => setPreviewId(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <AuthedImage src={`/api/photos/${previewId}`} alt="Uploaded photo" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
};
