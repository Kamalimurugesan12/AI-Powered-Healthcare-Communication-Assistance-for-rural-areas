// src/i18n/useMedicineTranslation.js
//
// React hook that gives components a `translateMedicine(text)` function
// which:
//   1. Is reactive to the app-wide i18next language (re-renders whenever
//      the user changes language via the existing Profile selector or
//      on initial load from localStorage — see ./config.js).
//   2. Looks the text up in the local i18next medicine-name dictionary
//      first (fast, synchronous, works offline).
//   3. Falls back to the app's existing /translate API for medicine names
//      the local dictionary doesn't cover, so unknown names still get a
//      real translation attempt instead of silently staying in English —
//      and if that also fails, the original (English) value is shown
//      rather than breaking the UI.
//
// The original value passed in is never mutated; only the returned,
// rendered string is translated.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { translateMedicineText } from "./medicineTranslation";
import { translateApi } from "@/api/translateApi";

// Module-level cache shared across components/instances so we only ever
// ask the backend once per (language, text) pair for the lifetime of the
// page. Value is `null` while a request is in flight.
const fallbackCache = new Map();

// Heuristic for "this string is basically just a medicine/report name",
// e.g. a `Medicine.name` field or a short dashboard/history title — as
// opposed to a full paragraph of raw OCR text. We only send the former to
// the backend fallback API: sending whole multi-line OCR paragraphs would
// (a) be wasteful and (b) risk the backend's general phrase-bank rewriting
// unrelated prose the user never asked to have translated here.
function looksLikeName(text) {
  return text.length <= 60 && text.trim().split(/\s+/).length <= 4;
}

export function useMedicineTranslation() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const [, setTick] = useState(0);
  const inFlight = useRef(new Set());

  const translateMedicine = (text) => {
    if (!text || typeof text !== "string") return text;
    if (!lang || lang === "en") return text;

    const dictionaryResult = translateMedicineText(text, lang);

    // Either something in the local dictionary already matched, or this
    // doesn't look like an isolated name worth asking the backend about —
    // in both cases we're done.
    if (dictionaryResult !== text || !looksLikeName(text)) {
      return dictionaryResult;
    }

    // Nothing in the local dictionary matched a short, name-like string —
    // fall back to the app's existing /translate API (same TranslationService
    // used elsewhere) rather than leaving it silently untranslated.
    const cacheKey = `${lang}::${text}`;
    if (fallbackCache.has(cacheKey)) {
      const cached = fallbackCache.get(cacheKey);
      return cached ?? text;
    }

    if (!inFlight.current.has(cacheKey)) {
      inFlight.current.add(cacheKey);
      fallbackCache.set(cacheKey, null);

      translateApi
        .translateText(text, lang)
        .then((translated) => {
          fallbackCache.set(cacheKey, translated && translated !== text ? translated : text);
          setTick((n) => n + 1); // trigger a re-render once resolved
        })
        .catch(() => {
          // Fallback failed — keep the original value rather than breaking the UI.
          fallbackCache.set(cacheKey, text);
        });
    }

    return text; // show the original while the fallback request is in flight
  };

  return translateMedicine;
}
