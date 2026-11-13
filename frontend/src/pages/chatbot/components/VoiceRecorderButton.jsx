import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/**
 * Records a short voice clip via the browser's MediaRecorder API and hands
 * the resulting Blob to onRecordingComplete. Falls back to a disabled,
 * explanatory state if the browser doesn't support audio recording
 * (e.g. no microphone permission, non-secure context) instead of silently
 * doing nothing.
 */
export default function VoiceRecorderButton({ onRecordingComplete, disabled }) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const supported =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof window !== "undefined" &&
    window.MediaRecorder;

  const startRecording = async () => {
    if (!supported) {
      toast.error(t("chatbot.voiceUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setIsProcessing(true);
        try {
          await onRecordingComplete(blob);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      toast.error(t("chatbot.micDenied"));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  if (isProcessing) {
    return (
      <Button type="button" size="icon" variant="secondary" disabled className="shrink-0 rounded-full">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={isRecording ? "destructive" : "secondary"}
      className="shrink-0 rounded-full"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || !supported}
      title={supported ? (isRecording ? t("chatbot.stopRecording") : t("chatbot.askByVoice")) : t("chatbot.voiceNotSupportedHere")}
    >
      {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
    </Button>
  );
}
