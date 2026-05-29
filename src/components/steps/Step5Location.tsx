import React from 'react';
import { Home, ArrowLeft } from 'lucide-react';

interface Step5Props {
  data?: string;
  onNext: (location: string) => void;
  onBack: () => void;
}

export default function Step5Location({ data, onNext, onBack }: Step5Props) {
  const options = [
    { value: 'Keller', label: 'Keller / Souterrain', desc: 'Häufigster Aufstellort' },
    { value: 'Erdgeschoss', label: 'Erdgeschoss (EG)', desc: 'Hauswirtschaftsraum / Flur' },
    { value: 'Obergeschoss', label: 'Obergeschoss (OG)', desc: 'Nischen oder Abstellräume' },
    { value: 'Dachgeschoss', label: 'Dachgeschoss (DG) / Dachheizzentrale', desc: 'Unter dem Dach' },
  ];

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 5 von 11
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Wo im Haus befindet sich Ihre Heizung?
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Der aktuelle Aufstellort beeinflusst den Aufwand für Leitungswege und Schornsteinsanierungen.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {options.map((opt) => {
          const isActive = data === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onNext(opt.value)}
              className={`group flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-300 relative overflow-hidden focus:outline-none ${
                isActive
                  ? 'border-primary bg-primary/[0.04] shadow-sm'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-alt hover:shadow-xs'
              }`}
            >
              <div
                className={`p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-primary text-white' : 'bg-background text-text-muted group-hover:text-text'
                }`}
              >
                <Home size={24} />
              </div>
              <div className="flex-1 pr-6">
                <h3 className="font-bold text-text text-base md:text-lg transition-colors group-hover:text-primary">
                  {opt.label}
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-snug">
                  {opt.desc}
                </p>
              </div>
              {isActive && (
                <div className="absolute top-4 right-4 text-primary">
                  <div className="bg-primary text-white rounded-full p-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
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
