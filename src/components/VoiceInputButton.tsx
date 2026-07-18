import React, { useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputButtonProps {
  lang?: "en" | "ar";
  onTranscript: (text: string) => void;
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  lang = "en",
  onTranscript,
  className = ""
}) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const toggleListening = () => {
    if (!supported) {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = lang === "ar" ? "ar-SA" : "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        if (resultText) {
          onTranscript(resultText);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        className={`p-2 rounded-xl border border-white/5 text-white/20 bg-white/5 opacity-50 cursor-not-allowed ${className}`}
        title={lang === "ar" ? "الإملاء الصوتي غير مدعوم في هذا المتصفح" : "Voice dictation is not supported in this browser"}
      >
        <Mic className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
        isListening
          ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse"
          : "bg-white/5 border-white/10 hover:border-brand-primary text-white/60 hover:text-white hover:bg-white/10"
      } ${className}`}
      title={
        isListening
          ? lang === "ar"
            ? "جاري الاستماع... اضغط للتوقف"
            : "Listening... click to stop"
          : lang === "ar"
          ? "إملاء صوتي"
          : "Voice dictation"
      }
    >
      {isListening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
    </button>
  );
};
