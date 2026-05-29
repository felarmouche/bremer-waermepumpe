import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, ArrowLeft, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import type { VerifyLeadResult } from '../FunnelParent';

const verifySchema = z.object({
  code: z
    .string()
    .length(6, 'Der Verifizierungscode muss genau 6-stellig sein')
    .regex(/^\d+$/, 'Der Code darf nur Ziffern enthalten'),
});

type VerifyFormData = z.infer<typeof verifySchema>;

interface Step10Props {
  phoneMasked: string;
  onVerify: (code: string) => Promise<VerifyLeadResult>;
  onResend: () => Promise<{ ok: boolean; error?: string }>;
  onBack: () => void;
}

// Narrow shim for the WebOTP API (TypeScript lib.dom.d.ts doesn't ship this yet).
type WebOtpCredential = { code?: string } | null;
type WebOtpCredentialsContainer = CredentialsContainer & {
  get(options: { otp: { transport: string[] }; signal?: AbortSignal }): Promise<WebOtpCredential>;
};

export default function Step10SMSVerify({ phoneMasked, onVerify, onResend, onBack }: Step10Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: '' },
  });

  // Android Chrome / Edge: WebOTP API auto-reads the SMS code when the SMS
  // payload ends with `@<host> #<code>` (must match origin exactly).
  // iOS Safari achieves the same thing via autocomplete="one-time-code" on
  // the <input>, so no JS hook is needed on iOS.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const creds = navigator.credentials as WebOtpCredentialsContainer | undefined;
    if (!creds || typeof creds.get !== 'function') return;
    if (!('OTPCredential' in window)) return;

    const ac = new AbortController();
    abortRef.current = ac;
    creds
      .get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((cred) => {
        if (cred?.code && /^[0-9]{6}$/.test(cred.code)) {
          setValue('code', cred.code, { shouldValidate: true });
          // Auto-submit once the code arrives
          void doSubmit({ code: cred.code });
        }
      })
      .catch(() => {
        /* user cancelled or no SMS — silent */
      });
    return () => {
      ac.abort();
      abortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setValue]);

  const doSubmit = async (formData: VerifyFormData) => {
    setIsLoading(true);
    setServerError(null);
    setSuccessMsg(null);
    try {
      const res = await onVerify(formData.code);
      if (!res.ok) setServerError(res.error);
      // success → parent advances the step
    } catch (err) {
      console.error(err);
      setServerError('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (formData: VerifyFormData) => doSubmit(formData);

  const handleResend = async () => {
    if (!canResend) return;
    setIsLoading(true);
    setServerError(null);
    setSuccessMsg(null);
    try {
      const res = await onResend();
      if (!res.ok) {
        setServerError(res.error || 'Fehler beim erneuten Senden.');
      } else {
        setSuccessMsg('Ein neuer Bestätigungscode wurde per SMS an Sie versendet.');
        setCountdown(30);
        setCanResend(false);
      }
    } catch (err) {
      console.error(err);
      setServerError('Fehler beim Verbindungsaufbau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 10 von 10
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Verifizierungscode eingeben
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Wir haben einen 6-stelligen Code an{' '}
          <span className="font-bold text-text">{phoneMasked}</span> gesendet.
          Auf modernen Smartphones erscheint der Code automatisch als Tastatur-Vorschlag.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 bg-surface border border-border rounded-xl p-6 md:p-8"
      >
        <div className="flex items-center gap-2 pb-4 border-b border-border mb-2">
          <Lock className="text-primary" size={20} />
          <h3 className="font-bold text-text text-base">Sicherheitsüberprüfung</h3>
        </div>

        <div>
          <label
            htmlFor="code"
            className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2 text-center"
          >
            6-stelliger SMS-Code
          </label>
          <input
            id="code"
            type="text"
            maxLength={6}
            placeholder="000000"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            className="w-full rounded-md border border-border bg-surface px-4 py-4 text-center font-mono text-3xl tracking-[0.5em] text-text outline-none transition-colors placeholder:text-text-muted focus:border-border-strong placeholder:tracking-normal"
            {...register('code')}
            disabled={isLoading}
            autoFocus
          />
          {errors.code && (
            <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug text-center">
              {errors.code.message}
            </p>
          )}
          {serverError && (
            <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug text-center">
              {serverError}
            </p>
          )}
          {successMsg && (
            <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded p-2.5 mt-2.5 text-center leading-snug">
              {successMsg}
            </p>
          )}
        </div>

        <div className="text-center pt-2">
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
              disabled={isLoading}
            >
              <RefreshCw size={12} /> Code erneut senden
            </button>
          ) : (
            <p className="text-xs text-text-muted">
              Code erneut senden in <span className="font-bold">{countdown}s</span>
            </p>
          )}
        </div>

        <div className="p-3 bg-highlight border border-border rounded-lg text-[11px] leading-relaxed text-text-muted text-center">
          Tipp: Auf Android-Chrome und iOS schlägt Ihr Smartphone den Code direkt vor,
          sobald die SMS ankommt – Sie müssen nichts kopieren.
        </div>

        <div className="pt-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex items-center gap-2"
            disabled={isLoading}
          >
            <ArrowLeft size={16} /> Zurück
          </button>

          <button
            type="submit"
            className="btn-accent flex items-center gap-2 cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Überprüfe...
              </>
            ) : (
              <>
                Code bestätigen <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
