import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

// @ts-ignore
import { ResultPanel } from "@/components/healthcare/ResultPanel";
import { ActionToolbar } from "@/components/healthcare/ActionToolbar";
import { ocrApi } from "@/api/ocrApi";
import { extractErrorMessage } from "@/api/client";

export function Workspace() {
  const { t } = useTranslation();
  const { reportId } = useParams();

  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [resultLanguage, setResultLanguage] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [loading, setLoading] = useState(Boolean(reportId));
  const [report, setReport] = useState<any>(null);
  const [resultData, setResultData] = useState<any>(null);

  // Load the stored report + its (already pipeline-generated) English
  // simplification the moment we land on /results/:reportId.
  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [reportData, simplified] = await Promise.all([
          ocrApi.get(reportId),
          ocrApi.getSimplified(reportId).catch(() => null),
        ]);
        if (cancelled) return;

        setReport(reportData);
        setResultLanguage("en");
        setSelectedLanguage(reportData.language || "en");

        const entities = reportData.entities || {};
        const summary = reportData.prescription_summary;

        setResultData({
          originalText: reportData.ocr_text,
          simplifiedText: simplified?.simplified_text || summary?.summary || "",
          translatedText: "",
          language: "en",
          summary: summary?.summary || "",
          keyFindings: [
            ...(entities.disease || []),
            ...(entities.diagnosis || []),
            ...(entities.lab_tests || []),
          ],
          interpretation: summary?.summary || "",
          recommendations: summary?.instructions || [],
          doctorAdvice: [...(summary?.warnings || []), summary?.follow_up].filter(Boolean),
          readabilityScore: null,
          highlightedChanges: [],
        });
      } catch (err) {
        toast.error(extractErrorMessage(err, t("results.loadReportFailed")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const handleTranslate = async () => {
    if (!reportId) {
      toast.error(t("results.uploadFirstTranslate"));
      return;
    }
    setIsTranslating(true);
    try {
      const translated = await ocrApi.translate(reportId, selectedLanguage);
      setResultData((prev: any) => ({
        ...prev,
        translatedText: translated.translated_text,
        language: selectedLanguage,
      }));
      setResultLanguage(selectedLanguage);
    } catch (err) {
      toast.error(extractErrorMessage(err, t("results.translateFailed")));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSimplify = async () => {
    if (!reportId) {
      toast.error(t("results.uploadFirstSimplify"));
      return;
    }
    setIsTranslating(true);
    try {
      const simplified = await ocrApi.getSimplified(reportId);
      setResultData((prev: any) => ({ ...prev, simplifiedText: simplified.simplified_text }));
      setResultLanguage("en");
    } catch (err) {
      toast.error(extractErrorMessage(err, t("results.simplifyFailed")));
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="container max-w-[85%] py-8 h-[calc(100vh-8rem)] flex flex-col">
      <ActionToolbar
        language={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        onTranslate={handleTranslate}
        onSimplify={handleSimplify}
        translateDisabled={!reportId}
      />
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {t("results.loadingReport")}
        </div>
      ) : (
        <ResultPanel
          language={resultLanguage}
          isTranslating={isTranslating}
          resultData={resultData}
        />
      )}
    </div>
  );
}
