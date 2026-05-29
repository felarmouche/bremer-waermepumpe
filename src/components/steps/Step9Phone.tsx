import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, ArrowLeft, Loader2, ArrowRight, Shield } from 'lucide-react';
import { currentConsentVersion } from '../../lib/consent';
import type { StartLeadInput, StartLeadResult } from '../FunnelParent';

const phoneSchema = z.object({
  phone: z
    .string()
    .min(9, 'Die Telefonnummer ist zu kurz')
    .regex(/^(\+49|0)1\d{8,11}$/, 'Bitte geben Sie eine gültige deutsche Mobilnummer an (z. B. 017612345678)'),
  consent_marketing: z
    .boolean()
    .refine((v) => v === true, 'Die Einwilligung zur Erstberatung ist erforderlich.'),
  consent_terms: z
    .boolean()
    .refine((v) => v === true, 'Bitte bestätigen Sie die Nutzungsbedingungen und den Datenschutz.'),
});

type PhoneFormData = z.infer<typeof phoneSchema>;

interface Step9Props {
  data?: string;
  onSubmit: (input: StartLeadInput) => Promise<StartLeadResult>;
  onBack: () => void;
}

export default function Step9Phone({ data, onSubmit, onBack }: Step9Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: data || '',
      consent_marketing: false,
      consent_terms: false,
    },
  });

  const onFormSubmit = async (formData: PhoneFormData) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const res = await onSubmit({
        phone: formData.phone,
        consentMarketing: formData.consent_marketing,
        consentTerms: formData.consent_terms,
      });
      if (!res.ok) setServerError(res.error);
    } catch (err) {
      console.error(err);
      setServerError('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 9 von 10
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Wie können wir Sie erreichen?
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Geben Sie Ihre deutsche Handynummer an. Wir senden Ihnen gleich einen kostenlosen SMS-Bestätigungscode.
        </p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5 bg-surface border border-border rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-2 pb-4 border-b border-border mb-2">
          <Phone className="text-primary" size={20} />
          <h3 className="font-bold text-text text-base">Rufnummer verifizieren</h3>
        </div>

        <div>
          <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            Mobilnummer (nur deutsche Handynummern)
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="z. B. 017612345678"
            autoComplete="tel"
            inputMode="tel"
            className={`input-base ${errors.phone || serverError ? 'border-red-400 focus:border-red-500' : ''}`}
            {...register('phone')}
            disabled={isLoading}
          />
          {errors.phone && (
            <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.phone.message}</p>
          )}
        </div>

        {/* Consent block — must be ticked before SMS is sent (Art. 7 DSGVO) */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-text-muted">
            <Shield className="text-primary shrink-0 mt-0.5" size={14} />
            <span>
              <strong className="text-text">Rechtliche Hinweise</strong> – Erforderlich für die Weiterleitung Ihrer Anfrage an einen SHK-Betrieb.
            </span>
          </div>

          {/* Consent 1: Datenweitergabe + Kontaktaufnahme (Fallback vorhanden) */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              {...register('consent_marketing')}
              className="mt-1 h-4 w-4 accent-primary shrink-0 cursor-pointer"
              disabled={isLoading}
            />
            <span className="text-xs text-text-muted leading-relaxed">
              {currentConsentVersion.marketingLabelHtml ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: currentConsentVersion.marketingLabelHtml,
                  }}
                />
              ) : (
                currentConsentVersion.marketingLabel || (
                  <>
                    Ich willige ein, dass meine oben eingegebenen Daten an den namentlich genannten Fachpartner weitergeleitet werden und dieser mich einmalig telefonisch kontaktieren darf, um mir eine kostenlose, unverbindliche Einschätzung zu geben. Meine Einwilligung kann ich jederzeit formfrei widerrufen (z. B. per E-Mail an bremerwaermepumpen@web.de oder über /widerruf/).
                  </>
                )
              )}
            </span>
          </label>
          {errors.consent_marketing && (
            <p className="text-xs font-semibold text-red-600 leading-snug pl-7">
              {errors.consent_marketing.message}
            </p>
          )}

          {/* Consent 2: AGB + Datenschutz (Hier drastisch gekürzt) */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              {...register('consent_terms')}
              className="mt-1 h-4 w-4 accent-primary shrink-0 cursor-pointer"
              disabled={isLoading}
            />
            <span className="text-xs text-text-muted leading-relaxed">
              Ich stimme den{' '}
              <a href="/agb/" target="_blank" rel="noopener" className="underline text-primary font-semibold">
                Nutzungsbedingungen
              </a>{' '}
              zu und habe die{' '}
              <a href="/datenschutz/" target="_blank" rel="noopener" className="underline text-primary font-semibold">
                Datenschutzerklärung
              </a>{' '}
              zur Kenntnis genommen.
            </span>
          </label>
          {errors.consent_terms && (
            <p className="text-xs font-semibold text-red-600 leading-snug pl-7">
              {errors.consent_terms.message}
            </p>
          )}
        </div>

        {/* SMS hint (BGH note) */}
        <div className="p-3 bg-highlight border border-border rounded-lg text-[11px] leading-relaxed text-text-muted">
          {currentConsentVersion.smsNoticeLabelHtml ? (
            <span dangerouslySetInnerHTML={{ __html: currentConsentVersion.smsNoticeLabelHtml }} />
          ) : (
            currentConsentVersion.smsNoticeLabel || (
              <>
                Bevor Ihre Daten übermittelt werden, senden wir Ihnen einen Bestätigungscode per SMS (BGH I ZR 164/09). Erst nach Code-Eingabe gilt Ihre Einwilligung als erteilt. Es entstehen keine Kosten.
              </>
            )
          )}
        </div>

        {serverError && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded p-2.5 leading-snug">
            {serverError}
          </p>
        )}

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
                <Loader2 size={16} className="animate-spin" /> Sende Code...
              </>
            ) : (
              <>
                Code anfordern <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}