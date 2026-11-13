import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import UploadSection from "./components/UploadSection";
import ImagePreview from "./components/ImagePreview";
import OCRResult from "./components/OCRResult";
import Spinner from "./components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ocrApi } from "@/api/ocrApi";
import { extractErrorMessage } from "@/api/client";

export default function Upload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [ocrResult, setOcrResult] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleImageChange = (event) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) return;

    setImageFile(selectedFile);
    setFileType(selectedFile.type);
    setError("");
    setOcrResult("");
    setReport(null);
    setProgress(0);

    if (selectedFile.type === "application/pdf") {
      setImagePreview(null);
    } else {
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleExtractText = async () => {
    if (!imageFile) {
      toast.error(t("upload.selectFileFirstToast"));
      return;
    }

    setLoading(true);
    setProgress(0);
    setError("");
    setOcrResult("");
    setReport(null);

    // Real OCR runs server-side as one call, so this progress bar animates
    // toward (not to) 100% while we wait, then snaps to 100 on success —
    // it's an indicator of "still working", not a real per-stage percentage.
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + 10));
    }, 400);

    try {
      const result = await ocrApi.extract(imageFile);
      clearInterval(interval);
      setProgress(100);
      setReport(result);
      setOcrResult(result.ocr_text);
      toast.success(t("upload.extractSuccessToast"));
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      const message = extractErrorMessage(err, t("upload.extractErrorToast"));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background">
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <Card>
          <CardContent className="p-6">
            <UploadSection
              onImageChange={handleImageChange}
              onExtract={handleExtractText}
            />

            <ImagePreview image={imagePreview} fileType={fileType} />

            {loading && (
              <>
                <Spinner />
                <Progress value={progress} className="mb-2" />
                <p className="text-center text-sm text-muted-foreground">
                  {t("upload.extractingPercent", { progress })}
                </p>
              </>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}

            <OCRResult result={ocrResult} />

            {report && (
              <Button
                className="mt-4 w-full"
                onClick={() => navigate(`/results/${report.id}`)}
              >
                {t("upload.viewFullResults")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
