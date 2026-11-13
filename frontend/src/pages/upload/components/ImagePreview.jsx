import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

function ImagePreview({ image, fileType }) {
  const { t } = useTranslation();
  if (!image) return null;

  if (fileType === "application/pdf") {
    return (
      <Card className="mb-6 fade-in">
        <CardContent className="flex items-center gap-2 p-4">
          <span className="text-2xl">📄</span>
          <span className="text-foreground">{t("upload.pdfSelected")}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 fade-in">
      <img
        src={image}
        alt="Preview"
        className="w-72 rounded-xl shadow-md border border-border"
      />
    </div>
  );
}

export default ImagePreview;
