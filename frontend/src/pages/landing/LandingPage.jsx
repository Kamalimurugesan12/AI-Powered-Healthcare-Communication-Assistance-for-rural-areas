import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LandingInput } from "./LandingInput";
import { LandingAccordion } from "./LandingAccordion";
import { Mail, Phone, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

const translatedGreetings = [
  { lang: "Hindi", text: "आपका स्वास्थ्य, आपकी भाषा में" },
  { lang: "Marathi", text: "तुमचं आरोग्य, तुमच्या भाषेत" },
  { lang: "Tamil", text: "உங்கள் ஆரோக்கியம், உங்கள் மொழியில்" },
  { lang: "Telugu", text: "మీ ఆరోగ్యం, మీ భాషలో" },
  { lang: "Kannada", text: "ನಿಮ್ಮ ಆರೋಗ್ಯ, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ" },
];

function useRotatingIndex(length, intervalMs) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((p) => (p + 1) % length), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);
  return index;
}

function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rotatingIndex = useRotatingIndex(translatedGreetings.length, 2600);
  return (
    <section className="px-6 md:px-12 pt-16 pb-20 md:pt-24 md:pb-28 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-5">
            {t("landing.hero.eyebrow")}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight text-foreground">
            {t("landing.hero.titleLine1")}
            <br />
            <span className="text-primary">{t("landing.hero.titleLine2")}</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-md">
            {t("landing.hero.description")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={() => navigate("/login")}>{t("landing.hero.tryItNow")}</Button>
            <Button variant="outline" size="lg" className="border-border text-foreground">
              {t("landing.hero.seeHowItWorks")}
            </Button>
          </div>
        </div>
        <Card className="p-8 shadow-sm border-border">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">
            {t("landing.hero.sameMessage", { count: translatedGreetings.length })}
          </p>
          <div className="h-24 flex items-center">
            <p key={rotatingIndex} className="font-serif text-2xl md:text-3xl text-foreground">
              {translatedGreetings[rotatingIndex].text}
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            {translatedGreetings.map((g, i) => (
              <span
                key={g.lang}
                className={`h-1.5 rounded-full transition-all ${
                  i === rotatingIndex ? "w-6 bg-accent" : "w-1.5 bg-foreground/10"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {translatedGreetings[rotatingIndex].lang}
          </p>
        </Card>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useTranslation();
  const features = t("landing.features.items", { returnObjects: true });
  return (
    <section id="features" className="px-6 md:px-12 py-20 bg-secondary">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-serif text-3xl text-foreground mb-12">{t("landing.features.heading")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="border-border">
              <CardContent className="pt-6">
                <h3 className="font-medium text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  const steps = t("landing.howItWorks.steps", { returnObjects: true });
  return (
    <section id="how-it-works" className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
      <h2 className="font-serif text-3xl text-foreground mb-12">{t("landing.howItWorks.heading")}</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
        {steps.map((step, i) => (
          <div key={step.title} className="relative">
            <p className="font-serif text-4xl text-accent mb-3">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="font-medium text-foreground mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-5 left-full w-8 border-t border-dashed border-border" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useTranslation();
  const faqs = t("landing.faq.items", { returnObjects: true });
  return (
    <section id="faq" className="px-6 md:px-12 py-20 bg-secondary">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-serif text-3xl text-foreground mb-8">{t("landing.faq.heading")}</h2>
        <LandingAccordion items={faqs} />
      </div>
    </section>
  );
}

function Contact() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }
  return (
    <section id="contact" className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <h2 className="font-serif text-3xl text-foreground mb-4">{t("landing.contact.heading")}</h2>
          <p className="text-muted-foreground mb-8 max-w-sm">
            {t("landing.contact.description")}
          </p>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /><span>support@healthexplained.in</span></div>
            <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-primary" /><span>+91 98765 43210</span></div>
            <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-primary" /><span>{t("landing.contact.address")}</span></div>
          </div>
        </div>
        <Card className="border-border">
          <CardContent className="pt-6">
            {submitted ? (
              <p className="text-primary font-medium">{t("landing.contact.thanks")}</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <LandingInput placeholder={t("landing.contact.namePlaceholder")} required />
                <LandingInput type="email" placeholder={t("landing.contact.emailPlaceholder")} required />
                <Textarea placeholder={t("landing.contact.messagePlaceholder")} required />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">{t("landing.contact.send")}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function LandingFooter() {
  const { t } = useTranslation();
  return (
    <footer className="px-6 md:px-12 py-12 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between gap-6 border-t border-border pt-8">
        <div>
          <p className="font-serif text-lg text-foreground">{t("common.appName")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("landing.footer.tagline")}</p>
        </div>
        <div className="flex gap-8 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">{t("landing.footer.about")}</a>
          <a href="#contact" className="hover:text-foreground">{t("landing.footer.contact")}</a>
          <a href="#" className="hover:text-foreground">{t("landing.footer.privacy")}</a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-background min-h-screen font-sans overflow-x-hidden">
      <Hero />
      <Features />
      <HowItWorks />
      <FAQ />
      <Contact />
      <LandingFooter />
    </div>
  );
}
