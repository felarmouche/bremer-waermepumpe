import React from 'react';
import { ShieldAlert, ArrowLeft, Share2 } from 'lucide-react';

interface DisqualifiedProps {
  onBack: () => void;
}

export default function DisqualifiedScreen({ onBack }: DisqualifiedProps) {
  return (
    <div className="w-full max-w-xl mx-auto text-center py-6">
      <div className="inline-flex p-4 rounded-full bg-red-50 text-red-600 border border-red-100 mb-6">
        <ShieldAlert size={48} />
      </div>

      <h2 className="text-2xl md:text-3xl font-extrabold text-text mb-4">
        Eigentümer-Zustimmung erforderlich
      </h2>
      
      <div className="space-y-4 text-sm text-text-muted leading-relaxed text-left bg-surface border border-border rounded-xl p-6 md:p-8 mb-6">
        <p>
          Vielen Dank für Ihr Interesse an unserem Wärmepumpen-Check! Als regionaler Meisterbetrieb aus Bremen 
          freuen wir uns über jede Anfrage zur Energiewende.
        </p>
        <p className="font-semibold text-text">
          Warum können wir für Mieter keine direkte Anfrage bearbeiten?
        </p>
        <p>
          Die Installation einer Wärmepumpe sowie die Anträge auf staatliche Fördermittel (wie den Klimabonus der KfW) 
          greifen tief in die Bausubstanz ein. Sie dürfen in Deutschland rechtlich ausschließlich vom <strong>Eigentümer 
          der Immobilie</strong> beauftragt und beantragt werden.
        </p>
        <p>
          <strong>Unser Tipp:</strong> Sprechen Sie mit Ihrem Vermieter oder Ihrer Hausverwaltung über das Thema 
          Modernisierung! Teilen Sie gerne diesen Link, damit der Eigentümer den kostenlosen Machbarkeitscheck für Ihr 
          Gebäude durchführen kann.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
        >
          <ArrowLeft size={16} /> Zurück &amp; korrigieren
        </button>

        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Bremer Wärmepumpen-Check',
                url: window.location.href
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Link in die Zwischenablage kopiert! Teilen Sie ihn mit Ihrem Vermieter.');
            }
          }}
          className="btn-accent flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
        >
          <Share2 size={16} /> Link teilen
        </button>
      </div>
    </div>
  );
}
