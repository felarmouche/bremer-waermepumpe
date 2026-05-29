import React from 'react';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';

interface Step6Props {
  data?: string;
  onNext: (timeline: string) => void;
  onBack: () => void;
}

export default function Step6Timeline({ data, onNext, onBack }: Step6Props) {
  const options = [
    { value: 'Sofort', label: 'Schnellstmöglich', desc: 'Akuter Ausfall oder dringender Tausch' },
    { value: 'In 1-3 Monaten', label: 'In 1–3 Monaten', desc: 'Nahe Zukunft / Planung läuft bereits' },
    { value: 'In 3-6 Monaten', label: 'In 3–6 Monaten', desc: 'Perfekt für den nächsten Heizperiodenwechsel' },
    { value: 'In 6-12 Monaten', label: 'In 6–12 Monaten', desc: 'Längerfristiges Vorhaben' },
    { value: 'Heizungswechsel nicht geplant', label: 'Nur informieren', desc: 'Derzeit kein Tausch geplant (Beratung)' },
  ];

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 6 von 11
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Wann soll die neue Heizung installiert werden?
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Diese Angabe hilft unserem lokalen Handwerker bei der Kapazitätsplanung und Beratung.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {options.map((opt) => {
          const isActive = data === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onNext(opt.value)}
              className={`group flex flex-col justify-between p-5 rounded-xl border text-left transition-all duration-300 relative overflow-hidden focus:outline-none min-h-[120px] ${
                isActive
                  ? 'border-primary bg-primary/[0.04] shadow-sm'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-alt hover:shadow-xs'
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span
                  className={`p-2 rounded-lg transition-colors ${
                    isActive ? 'bg-primary text-white' : 'bg-background text-text-muted group-hover:text-text'
                  }`}
                >
                  <Calendar size={20} />
                </span>
                {isActive && (
                  <span className="text-primary bg-primary text-white rounded-full p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-text text-base transition-colors group-hover:text-primary">
                  {opt.label}
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-snug">
                  {opt.desc}
                </p>
              </div>
            </button>
          );
        })}
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
