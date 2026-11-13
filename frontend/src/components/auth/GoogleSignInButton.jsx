import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { extractErrorMessage } from "@/api/client";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Renders Google's official "Continue with Google" button using Google
 * Identity Services (GIS) and completes login against
 * POST /api/v1/auth/google once Google returns an ID token.
 *
 * Requires:
 *  - The GIS script tag in index.html (<script src="https://accounts.google.com/gsi/client">)
 *  - VITE_GOOGLE_CLIENT_ID set in frontend/.env, matching the backend's GOOGLE_CLIENT_ID
 */
export default function GoogleSignInButton({ onSuccess, label = "signin_with" }) {
  const { t } = useTranslation();
  const { googleLogin } = useAuth();
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [scriptMissing, setScriptMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function handleCredentialResponse(response) {
      try {
        await googleLogin(response.credential);
        toast.success(t("auth.google.signedIn"));
        onSuccess?.();
      } catch (err) {
        toast.error(extractErrorMessage(err, t("auth.google.failed")));
      }
    }

    function initialize() {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        // GIS script hasn't finished loading yet (it's `async defer`); retry shortly.
        setTimeout(initialize, 200);
        return;
      }
      if (!GOOGLE_CLIENT_ID) {
        setScriptMissing(true);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: "popup",
      });

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: 340,
          text: label,
          shape: "rectangular",
        });
      }
      setReady(true);
    }

    initialize();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (scriptMissing) {
    return (
      <button
        type="button"
        disabled
        title={t("auth.google.unavailableTitle")}
        className="flex w-full items-center justify-center gap-3 rounded-md border py-2.5 text-sm text-muted-foreground opacity-60"
      >
        {t("auth.google.unavailable")}
      </button>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <div ref={buttonRef} />
      {!ready && (
        <div className="flex w-full items-center justify-center gap-3 rounded-md border py-2.5 text-sm text-muted-foreground">
          {t("auth.google.loading")}
        </div>
      )}
    </div>
  );
}
