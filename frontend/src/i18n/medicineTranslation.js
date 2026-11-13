// src/i18n/medicineTranslation.js
//
// Translates medicine names (extracted by the OCR + NLP pipeline) for
// display, without ever touching the original value that was extracted.
//
// This intentionally reuses the app's existing i18next instance/resource
// bundles (see ./config.js and ./locales/*.json -> `common.medicineNames`)
// instead of introducing a second translation mechanism. Static UI labels
// already go through `t("some.key")`; this module applies the same
// dictionary-lookup approach to dynamic, OCR/NLP-extracted medicine name
// strings, which can't be looked up by a fixed key because the value isn't
// known until runtime.
import i18n from "./config";

// Cache of { regex, dictionary } built once per language, invalidated
// whenever the i18next language (or its resource bundle) changes.
let patternCache = new Map();

function getMedicineDictionary(lang) {
  const bundle = i18n.getResourceBundle(lang, "translation");
  return bundle?.common?.medicineNames || null;
}

function buildPattern(dictionary) {
  const keys = Object.keys(dictionary);
  if (keys.length === 0) return null;

  // Longest names first so multi-word / overlapping names (e.g. a brand
  // name that contains a shorter generic name) aren't partially matched.
  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
  const escaped = sortedKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return {
    regex: new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi"),
    dictionary,
  };
}

function getPattern(lang) {
  if (patternCache.has(lang)) return patternCache.get(lang);

  const dictionary = getMedicineDictionary(lang);
  const pattern = dictionary ? buildPattern(dictionary) : null;
  patternCache.set(lang, pattern);
  return pattern;
}

// Resource bundles can theoretically be swapped/reloaded; drop the cache
// whenever the active language changes so we never serve a stale pattern.
i18n.on("languageChanged", () => {
  patternCache = new Map();
});

/**
 * Translate any medicine-name substrings found in `text` into `lang` using
 * the app's i18next medicine-name dictionary. Everything else in the
 * string — dosages, strengths, units, numbers, punctuation, other words —
 * is left completely untouched, so callers never need to separate the
 * medicine name from its surrounding text themselves.
 *
 * Returns the original `text` unchanged when:
 *  - `lang` is "en" (or falsy) — English is never rewritten.
 *  - `text` is empty/nullish.
 *  - No dictionary entries match anything in `text`.
 *
 * This function is pure and never mutates its input; the original
 * OCR/NLP-extracted value passed in by the caller is preserved.
 */
export function translateMedicineText(text, lang) {
  if (!text || typeof text !== "string") return text;
  if (!lang || lang === "en") return text;

  const pattern = getPattern(lang);
  if (!pattern) return text;

  return text.replace(pattern.regex, (match) => {
    const translated = pattern.dictionary[match.toLowerCase()];
    return translated || match;
  });
}

/**
 * Translate a single, already-isolated medicine name (e.g. the `name`
 * field on a structured `Medicine` entity from the NLP pipeline). This is
 * the same lookup as `translateMedicineText`, exposed under a clearer name
 * for call sites that only ever pass a bare medicine name.
 */
export function translateMedicineName(name, lang) {
  return translateMedicineText(name, lang);
}

/**
 * Whether `name` has a known translation for `lang` in the local
 * dictionary. Used to decide when to fall back to the backend translation
 * API for names the curated dictionary doesn't cover.
 */
export function hasLocalMedicineTranslation(name, lang) {
  if (!name || !lang || lang === "en") return true;
  const dictionary = getMedicineDictionary(lang);
  if (!dictionary) return false;
  return Object.prototype.hasOwnProperty.call(dictionary, name.trim().toLowerCase());
}
