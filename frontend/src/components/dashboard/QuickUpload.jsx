import { Camera, FileUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function QuickUpload() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (

    <section className="rounded-3xl bg-card p-5 shadow-card">

      <h2 className="font-display text-2xl">
        {t("home.quickUpload.title")}
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        {t("home.quickUpload.description")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">

        <button
          onClick={() => navigate("/upload")}
          className="flex flex-col items-center rounded-2xl bg-primary py-5 text-white transition hover:scale-105"
        >
          <Camera size={28} />

          <span className="mt-3">
            {t("home.quickUpload.camera")}
          </span>

        </button>

        <button
          onClick={() => navigate("/upload")}
          className="flex flex-col items-center rounded-2xl border py-5 transition hover:border-primary hover:text-primary"
        >

          <FileUp size={28} />

          <span className="mt-3">
            {t("home.quickUpload.uploadPdf")}
          </span>

        </button>

      </div>

    </section>

  );
}
