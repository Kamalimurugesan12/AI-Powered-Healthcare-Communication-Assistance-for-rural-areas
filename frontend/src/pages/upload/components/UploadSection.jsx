import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import CameraCapture from "./CameraCapture";

function UploadSection({ onImageChange, onExtract }) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
  ];

  const validateAndSend = (file) => {
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      setError(t("upload.invalidFileType"));
      return;
    }
    setError("");
    onImageChange({ target: { files: [file] } });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSend(droppedFile);
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSend(selectedFile);
  };

  const handleCameraCapture = (file) => {
    validateAndSend(file);
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-foreground mb-3">
        {t("upload.sectionHeading")}
      </h2>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30"
        }`}
      >
        <p className="text-muted-foreground mb-3">
          {t("upload.dragDrop")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFileInputChange}
            className="block text-sm text-muted-foreground"
          />
          <CameraCapture onCapture={handleCameraCapture} />
        </div>
        {error && (
          <p className="text-destructive text-sm mt-3">
            {error}
          </p>
        )}
      </div>
      <Button onClick={onExtract} className="mt-4">
        {t("upload.extractText")}
      </Button>
    </div>
  );
}

export default UploadSection;
