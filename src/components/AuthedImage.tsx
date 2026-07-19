import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { ImageOff } from "lucide-react";

/** Renders an <img> whose source requires the Bearer auth token — a plain
 *  <img src="/api/photos/:id"> can't attach the header, so this fetches the
 *  bytes via apiFetch and renders them as a blob URL instead. */
export const AuthedImage: React.FC<{ src: string; alt: string; className?: string; onClick?: () => void }> = ({
  src,
  alt,
  className,
  onClick
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);

    apiFetch(src)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load image");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-white/30 ${className || ""}`}>
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }

  if (!url) {
    return <div className={`bg-white/5 animate-pulse ${className || ""}`} />;
  }

  return <img src={url} alt={alt} className={className} onClick={onClick} />;
};
