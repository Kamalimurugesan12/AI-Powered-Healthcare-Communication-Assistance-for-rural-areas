import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

function CameraCapture({ onCapture }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState("");

  const openCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error(err);
      setError(t("upload.cameraError"));
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      onCapture(file);
      closeCamera();
    }, "image/jpeg");
  };

  return (
    <div>
      {!isCameraOpen ? (
        <Button type="button" onClick={openCamera} className="cursor-pointer">
          {t("upload.useCamera")}
        </Button>
      ) : (
        <div className="mt-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-72 rounded-xl border border-border"
          />
          <div className="flex gap-2 mt-2">
            <Button type="button" onClick={capturePhoto}>
              {t("upload.capture")}
            </Button>
            <Button type="button" onClick={closeCamera} variant="outline">
              {t("upload.cancel")}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-destructive text-sm mt-2">{error}</p>}
    </div>
  );
}

export default CameraCapture;
