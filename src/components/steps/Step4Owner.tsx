import React from 'react';
import { UserCheck, UserX, ArrowLeft } from 'lucide-react';

interface Step4Props {
  data?: boolean;
  onNext: (isOwner: boolean) => void;
  onBack: () => void;
}

export default function Step4Owner({ data, onNext, onBack }: Step4Props) {
  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 4 von 11
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Sind Sie Eigentümer der Immobilie?
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Heizungswechsel dürfen in Deutschland rechtlich nur vom Eigentümer beauftragt oder beantragt werden.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
        {/* Option: Ja */}
        <button
          type="button"
          onClick={() => onNext(true)}
          className={`group flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-300 relative overflow-hidden focus:outline-none ${
            data === true
              ? 'border-primary bg-primary/[0.04] shadow-sm'
              : 'border-border bg-surface hover:border-border-strong hover:bg-surface-alt hover:shadow-xs'
          }`}
        >
          <div
            className={`p-3 rounded-lg transition-colors ${
              data === true ? 'bg-primary text-white' : 'bg-background text-text-muted group-hover:text-text'
            }`}
          >
            <UserCheck size={24} />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="font-bold text-text text-base md:text-lg transition-colors group-hover:text-primary">
              Ja, ich bin Eigentümer
            </h3>
            <p className="text-xs text-text-muted mt-1 leading-snug">
              Ich besitze das Objekt selbst oder in einer Eigentümergemeinschaft.
            </p>
          </div>
          {data === true && (
            <div className="absolute top-4 right-4 text-primary">
              <div className="bg-primary text-white rounded-full p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>

        {/* Option: Nein */}
        <button
          type="button"
          onClick={() => onNext(false)}
          className={`group flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-300 relative overflow-hidden focus:outline-none ${
            data === false
              ? 'border-primary bg-primary/[0.04] shadow-sm'
              : 'border-border bg-surface hover:border-border-strong hover:bg-surface-alt hover:shadow-xs'
          }`}
        >
          <div
            className={`p-3 rounded-lg transition-colors ${
              data === false ? 'bg-primary text-white' : 'bg-background text-text-muted group-hover:text-text'
            }`}
          >
            <UserX size={24} />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="font-bold text-text text-base md:text-lg transition-colors group-hover:text-primary">
              Nein, ich bin Mieter
            </h3>
            <p className="text-xs text-text-muted mt-1 leading-snug">
              Ich wohne zur Miete oder pachte die Immobilie.
            </p>
          </div>
          {data === false && (
            <div className="absolute top-4 right-4 text-primary">
              <div className="bg-primary text-white rounded-full p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Zurück
        </button>
      </div>
    </div>
  );
}
