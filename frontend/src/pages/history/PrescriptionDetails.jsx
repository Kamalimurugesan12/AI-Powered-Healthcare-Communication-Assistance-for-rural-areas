import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowLeft } from "lucide-react";

import PageLoader from "@/components/common/PageLoader";
import { ocrApi } from "@/api/ocrApi";
import { extractErrorMessage } from "@/api/client";
import { useMedicineTranslation } from "@/i18n/useMedicineTranslation";

export default function PrescriptionDetails() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const translateMedicine = useMedicineTranslation();

  const [report, setReport] = useState(null);
  const [simplified, setSimplified] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [reportData, simplifiedData] = await Promise.all([
          ocrApi.get(id),
          ocrApi.getSimplified(id).catch(() => null),
        ]);
        if (cancelled) return;
        setReport(reportData);
        setSimplified(simplifiedData);
      } catch (err) {
        toast.error(extractErrorMessage(err, t("prescriptionDetails.loadErrorToast")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDownload = () => {
    if (!report) return;
    const content = [
      `Prescription — ${new Date(report.created_at).toLocaleDateString()}`,
      "",
      "ORIGINAL TEXT",
      report.ocr_text,
      "",
      simplified ? "SIMPLIFIED SUMMARY" : "",
      simplified?.simplified_text || "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  if (!report) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-muted-foreground">{t("prescriptionDetails.notFound")}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/history")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("prescriptionDetails.backToHistory")}
        </Button>
      </div>
    );
  }

  const summary = report.prescription_summary;

  return (
    <div className="min-h-screen bg-background p-6 pb-16">

      <button onClick={() => navigate("/history")} className="mb-4 flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> {t("prescriptionDetails.back")}
      </button>

      <h1 className="text-2xl font-semibold text-foreground">
        {t("prescriptionDetails.title")}
      </h1>

      <p className="mt-2 text-muted-foreground">
        {t("prescriptionDetails.subtitle")}
      </p>

      {/* Prescription Information */}
      <Card className="mt-6 rounded-xl p-6">

        <div className="space-y-4">

          <div>
            <p className="text-sm text-muted-foreground">{t("prescriptionDetails.dateLabel")}</p>
            <p className="font-medium">
              {new Date(report.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">{t("prescriptionDetails.doctorLabel")}</p>
            <p className="font-medium">{report.doctor_name || t("common.notSpecified")}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">{t("prescriptionDetails.languageLabel")}</p>
            <Badge>{(report.language || "en").toUpperCase()}</Badge>
          </div>

          {report.status?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.status.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          )}

        </div>

      </Card>

      {/* Original Prescription */}
      <Card className="mt-4 rounded-xl p-6">
        <h2 className="font-semibold">{t("prescriptionDetails.originalHeading")}</h2>
        <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
          {report.ocr_text || t("prescriptionDetails.originalEmpty")}
        </p>
      </Card>

      {/* Simplified */}
      <Card className="mt-4 rounded-xl p-6">
        <h2 className="font-semibold">{t("prescriptionDetails.simplifiedHeading")}</h2>
        <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
          {simplified?.simplified_text || summary?.summary || t("prescriptionDetails.simplifiedEmpty")}
        </p>
      </Card>

      {summary?.medicines?.length > 0 && (
        <Card className="mt-4 rounded-xl p-6">
          <h2 className="font-semibold">{t("prescriptionDetails.medicinesHeading")}</h2>
          <ul className="mt-3 space-y-2">
            {summary.medicines.map((m, i) => (
              <li key={i} className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="font-medium">{translateMedicine(m.name)}</span>
                {m.strength && ` · ${m.strength}`}
                {m.frequency_human && ` · ${m.frequency_human}`}
                {m.duration && ` · ${m.duration}`}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Download */}
      <Button className="mt-6" onClick={handleDownload}>
        <Download className="mr-2 h-4 w-4" />
        {t("prescriptionDetails.downloadButton")}
      </Button>

    </div>
  );
}
