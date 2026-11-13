import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { useMedicineTranslation } from "@/i18n/useMedicineTranslation";

function OCRResult({ result }) {
  const { t } = useTranslation();
  const translateMedicine = useMedicineTranslation();

  // `result` is the raw OCR/NLP text exactly as extracted — it is never
  // modified. We only translate recognized medicine-name substrings in
  // what's rendered here; dosages, units, and everything else pass through
  // untouched, and the original `result` value used elsewhere (e.g. saved
  // with the report) is unaffected.
  const displayedResult = translateMedicine(result);

  return (
    <div>
      <h3 className="text-xl font-semibold text-foreground mb-3">{t("upload.ocrResultHeading")}</h3>
      <Textarea
        rows="10"
        value={displayedResult}
        readOnly
        placeholder={t("upload.ocrResultPlaceholder")}
        className="bg-muted/30 resize-none"
      />
    </div>
  );
}

export default OCRResult;
