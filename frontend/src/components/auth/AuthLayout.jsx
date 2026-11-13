import { HeartPulse, ShieldCheck, Languages, BrainCircuit } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AuthLayout({
  title,
  subtitle,
  children,
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">

      {/* Left Section */}
      <div className="hidden lg:flex flex-col justify-center bg-primary text-primary-foreground p-16">
        <div className="max-w-lg">

          <div className="flex items-center gap-3 mb-8">
            <HeartPulse className="w-10 h-10" />
            <h1 className="text-4xl font-bold">
              {t("auth.layout.brand")}
            </h1>
          </div>

          <p className="text-lg text-primary-foreground/80 mb-10">
            {t("auth.layout.tagline")}
          </p>

          <div className="space-y-6">

            <div className="flex gap-4">
              <ShieldCheck className="w-7 h-7 mt-1 text-accent" />
              <div>
                <h3 className="font-semibold">{t("auth.layout.secureTitle")}</h3>
                <p className="text-primary-foreground/80 text-sm">
                  {t("auth.layout.secureDescription")}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Languages className="w-7 h-7 mt-1 text-accent" />
              <div>
                <h3 className="font-semibold">{t("auth.layout.languageTitle")}</h3>
                <p className="text-primary-foreground/80 text-sm">
                  {t("auth.layout.languageDescription")}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <BrainCircuit className="w-7 h-7 mt-1 text-accent" />
              <div>
                <h3 className="font-semibold">{t("auth.layout.aiTitle")}</h3>
                <p className="text-primary-foreground/80 text-sm">
                  {t("auth.layout.aiDescription")}
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center justify-center p-6">

        <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-10">

          <h2 className="text-3xl font-bold text-foreground mb-2">
            {title}
          </h2>

          <p className="text-muted-foreground mb-8">
            {subtitle}
          </p>

          {children}

          <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            <div className="flex justify-center gap-6">
              <a href="#" className="hover:text-primary">
                {t("auth.layout.privacyPolicy")}
              </a>

              <a href="#" className="hover:text-primary">
                {t("auth.layout.terms")}
              </a>

              <a href="#" className="hover:text-primary">
                {t("auth.layout.support")}
              </a>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
