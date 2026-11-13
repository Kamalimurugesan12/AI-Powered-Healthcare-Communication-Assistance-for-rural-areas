import { useTranslation } from "react-i18next";

export default function HealthTipCard({ tip: tipProp }) {
  const { t } = useTranslation();
  const fallbackTips = t("home.healthTip.fallbackTips", { returnObjects: true });

  const tip =
    tipProp || fallbackTips[Math.floor(Math.random() * fallbackTips.length)];

  return (

    <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5">

      <h2 className="font-display text-xl text-primary">

        {t("home.healthTip.title")}

      </h2>

      <p className="mt-3 leading-7 text-foreground">

        {tip}

      </p>

    </section>

  );
}