import React, { useState, useEffect } from 'react';
import { currentConsentVersion } from '../lib/consent';

// Import step components
import Step1Heating from './steps/Step1Heating';
import Step2Age from './steps/Step2Age';
import Step3Building from './steps/Step3Building';
import Step4Owner from './steps/Step4Owner';
import Step5Location from './steps/Step5Location';
import Step6Timeline from './steps/Step6Timeline';
import Step7Address from './steps/Step7Address';
import Step8Name from './steps/Step8Name';
import Step9Phone from './steps/Step9Phone';
import Step10SMSVerify from './steps/Step10SMSVerify';
import DisqualifiedScreen from './steps/DisqualifiedScreen';
import SuccessScreen from './steps/SuccessScreen';

export interface FunnelData {
  heatingCurrent?: string;
  heatingAge?: string;
  buildingType?: string;
  isOwner?: boolean;
  heatingLocation?: string;
  timeline?: string;
  address?: {
    zip: string;
    city: string;
    street: string;
    houseNumber: string;
  };
  personalInfo?: {
    salutation: 'Herr' | 'Frau';
    name: string;
  };
  phone?: string;
}

export type StartLeadInput = {
  consentMarketing: boolean;
  consentTerms: boolean;
  phone: string;
};

export type StartLeadResult =
  | { ok: true; pendingToken: string; phoneMasked: string; expiresInSeconds: number }
  | { ok: false; error: string };

export type VerifyLeadResult =
  | { ok: true; reference: string }
  | { ok: false; error: string };

const TOTAL_STEPS = 10;
const SUCCESS_STEP = 11;

function splitName(full: string): { vorname: string; nachname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { vorname: parts[0], nachname: "" };
  return {
    vorname: parts.slice(0, -1).join(" "),
    nachname: parts[parts.length - 1],
  };
}

export default function FunnelParent() {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FunnelData>({});
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string>("");
  const [reference, setReference] = useState<string>("");

  // Restore from localStorage on mount.
  //
  // Persisted is only a non-personal subset of FunnelData (quiz answers from
  // steps 1–6). Personal data — address, personalInfo, phone — has never been
  // written to localStorage, so any reload past step 6 lands the user back on
  // step 7 with their identity fields blank.
  useEffect(() => {
    try {
      const savedStep = localStorage.getItem('bremer_funnel_step');
      const savedData = localStorage.getItem('bremer_funnel_data');
      const savedDisqualified = localStorage.getItem('bremer_funnel_disqualified');

      if (savedData) {
        const parsed = JSON.parse(savedData) as Partial<FunnelData>;
        // Whitelist quiz fields only; ignore any personal data that
        // might exist in older payloads written before this restriction.
        setFormData({
          heatingCurrent: parsed.heatingCurrent,
          heatingAge: parsed.heatingAge,
          buildingType: parsed.buildingType,
          isOwner: parsed.isOwner,
          heatingLocation: parsed.heatingLocation,
          timeline: parsed.timeline,
        });
      }
      if (savedStep) {
        const restoredStep = parseInt(savedStep, 10);
        // If a stale entry points past the personal-data steps, snap back
        // to the first step that asks for address (7), since address /
        // personalInfo / phone are no longer in localStorage.
        setStep(restoredStep > 7 ? 7 : restoredStep);
      }
      if (savedDisqualified) setIsDisqualified(savedDisqualified === 'true');
    } catch (e) {
      console.error('Error reading from localStorage:', e);
    }
  }, []);

  // Persist quiz progress only. Address, name and phone (steps 7–9) are
  // personal data and must never touch localStorage — see § 25 TDDDG and
  // Ziffer 9a der Datenschutzerklärung.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (step >= SUCCESS_STEP) {
        localStorage.removeItem('bremer_funnel_step');
        localStorage.removeItem('bremer_funnel_data');
        localStorage.removeItem('bremer_funnel_disqualified');
        return;
      }
      const quizOnly = {
        heatingCurrent: formData.heatingCurrent,
        heatingAge: formData.heatingAge,
        buildingType: formData.buildingType,
        isOwner: formData.isOwner,
        heatingLocation: formData.heatingLocation,
        timeline: formData.timeline,
      };
      localStorage.setItem('bremer_funnel_step', step.toString());
      localStorage.setItem('bremer_funnel_data', JSON.stringify(quizOnly));
      localStorage.setItem('bremer_funnel_disqualified', isDisqualified ? 'true' : 'false');
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }, [step, formData, isDisqualified]);

  const handleNext = (fieldData: unknown) => {
    let updatedData = { ...formData };

    if (step === 1) updatedData.heatingCurrent = fieldData as string;
    else if (step === 2) updatedData.heatingAge = fieldData as string;
    else if (step === 3) updatedData.buildingType = fieldData as string;
    else if (step === 4) {
      updatedData.isOwner = fieldData as boolean;
      if (fieldData === false) {
        setIsDisqualified(true);
        setFormData(updatedData);
        return;
      }
    } else if (step === 5) updatedData.heatingLocation = fieldData as string;
    else if (step === 6) updatedData.timeline = fieldData as string;
    else if (step === 7) updatedData.address = fieldData as FunnelData['address'];
    else if (step === 8) updatedData.personalInfo = fieldData as FunnelData['personalInfo'];

    setFormData(updatedData);
    setStep(step + 1);
  };

  const handleBack = () => {
    if (isDisqualified) {
      setIsDisqualified(false);
      return;
    }
    if (step > 1) setStep(step - 1);
  };

  /**
   * Step 9 submit: collects the phone number plus both consent checkboxes,
   * combines them with the quiz answers in formData, and posts to
   * /api/lead/start. On success the API returns a pendingToken (KV-backed,
   * 30 min TTL) that step 10 uses to confirm the SMS code.
   */
  const handleStartLead = async (input: StartLeadInput): Promise<StartLeadResult> => {
    if (!formData.personalInfo || !formData.address) {
      return { ok: false, error: "Bitte vorherige Schritte vollständig ausfüllen." };
    }

    const { vorname, nachname } = splitName(formData.personalInfo.name);

    const payload = {
      salutation: formData.personalInfo.salutation,
      vorname,
      nachname,
      telefon: input.phone,
      strasse: formData.address.street,
      hausnummer: formData.address.houseNumber,
      plz: formData.address.zip,
      ort: formData.address.city,
      heatingCurrent: formData.heatingCurrent,
      heatingAge: formData.heatingAge,
      buildingType: formData.buildingType,
      isOwner: formData.isOwner,
      heatingLocation: formData.heatingLocation,
      timeline: formData.timeline,
      consent_marketing: input.consentMarketing,
      consent_terms: input.consentTerms,
      consent_version: currentConsentVersion.version,
    };

    try {
      const res = await fetch("/api/lead/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        pendingToken?: string;
        phoneMasked?: string;
        expiresInSeconds?: number;
      };
      if (!res.ok || !json.ok || !json.pendingToken) {
        return { ok: false, error: json.error || "Fehler beim Starten der Anfrage." };
      }
      setPendingToken(json.pendingToken);
      setPhoneMasked(json.phoneMasked ?? input.phone);
      setFormData({ ...formData, phone: input.phone });
      setStep(10);
      return {
        ok: true,
        pendingToken: json.pendingToken,
        phoneMasked: json.phoneMasked ?? input.phone,
        expiresInSeconds: json.expiresInSeconds ?? 600,
      };
    } catch (e) {
      return { ok: false, error: "Verbindung fehlgeschlagen. Bitte erneut versuchen." };
    }
  };

  const handleResendCode = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!pendingToken) return { ok: false, error: "Sitzung abgelaufen. Bitte erneut starten." };
    try {
      const res = await fetch("/api/lead/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingToken }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || "Code konnte nicht erneut gesendet werden." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Verbindung fehlgeschlagen." };
    }
  };

  const handleVerifyCode = async (code: string): Promise<VerifyLeadResult> => {
    if (!pendingToken) return { ok: false, error: "Sitzung abgelaufen. Bitte erneut starten." };
    try {
      const res = await fetch("/api/lead/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        reference?: string;
      };
      if (!res.ok || !json.ok || !json.reference) {
        return { ok: false, error: json.error || "Code-Bestätigung fehlgeschlagen." };
      }
      setReference(json.reference);
      setStep(SUCCESS_STEP);
      return { ok: true, reference: json.reference };
    } catch {
      return { ok: false, error: "Verbindung fehlgeschlagen." };
    }
  };

  const calculateProgress = () => {
    if (isDisqualified || step >= SUCCESS_STEP) return 100;
    return Math.min(Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 90) + 10, 100);
  };

  const getProgressText = () => {
    const percent = calculateProgress();
    if (percent < 30) return 'Erste Objektdaten erfasst';
    if (percent < 60) return 'Prüfung läuft – fast geschafft';
    if (percent < 95) return 'Persönliche Details verifizieren';
    return 'Vollständig geprüft!';
  };

  const progressPercent = calculateProgress();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="bg-background border border-border shadow-xl rounded-2xl overflow-hidden md:min-h-[500px] flex flex-col justify-between transition-all duration-300">
        {!isDisqualified && step < SUCCESS_STEP && (
          <div className="w-full bg-surface-alt border-b border-border p-4 md:px-6">
            <div className="flex justify-between items-center text-xs font-bold text-text-muted mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                {getProgressText()}
              </span>
              <span>{progressPercent}% geschafft</span>
            </div>
            <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex-1 p-6 md:p-10 flex items-center justify-center">
          <div className="w-full transition-opacity duration-300 ease-in-out opacity-100">
            {isDisqualified ? (
              <DisqualifiedScreen onBack={handleBack} />
            ) : (
              <>
                {step === 1 && <Step1Heating data={formData.heatingCurrent} onNext={handleNext} />}
                {step === 2 && <Step2Age data={formData.heatingAge} onNext={handleNext} onBack={handleBack} />}
                {step === 3 && <Step3Building data={formData.buildingType} onNext={handleNext} onBack={handleBack} />}
                {step === 4 && <Step4Owner data={formData.isOwner} onNext={handleNext} onBack={handleBack} />}
                {step === 5 && <Step5Location data={formData.heatingLocation} onNext={handleNext} onBack={handleBack} />}
                {step === 6 && <Step6Timeline data={formData.timeline} onNext={handleNext} onBack={handleBack} />}
                {step === 7 && <Step7Address data={formData.address} onNext={handleNext} onBack={handleBack} />}
                {step === 8 && <Step8Name data={formData.personalInfo} onNext={handleNext} onBack={handleBack} />}
                {step === 9 && (
                  <Step9Phone
                    data={formData.phone}
                    onSubmit={handleStartLead}
                    onBack={handleBack}
                  />
                )}
                {step === 10 && (
                  <Step10SMSVerify
                    phoneMasked={phoneMasked || formData.phone || ''}
                    onVerify={handleVerifyCode}
                    onResend={handleResendCode}
                    onBack={handleBack}
                  />
                )}
                {step === SUCCESS_STEP && (
                  <SuccessScreen reference={reference} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
