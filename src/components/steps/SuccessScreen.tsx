import React from 'react';
import { CheckCircle2, Clock, MessageSquare, ShieldCheck } from 'lucide-react';

interface SuccessScreenProps {
  reference: string;
}

export default function SuccessScreen({ reference }: SuccessScreenProps) {
  return (
    <div className="w-full max-w-2xl mx-auto py-6">
      <div className="text-center mb-8">
        <div className="inline-flex justify-center items-center relative mb-4">
          <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-highlight opacity-75"></span>
          <span className="relative inline-flex rounded-full bg-highlight p-4 text-primary border border-border">
            <CheckCircle2 size={40} className="stroke-[2.5]" />
          </span>
        </div>
        <h2 className="text-2xl md:text-4xl font-extrabold text-text">Vielen Dank!</h2>
        <p className="text-base text-primary font-semibold mt-2">
          Ihre Anfrage wurde verifiziert und übermittelt.
        </p>
        {reference && (
          <p className="mt-3 inline-block bg-surface border border-border rounded-md px-4 py-2 font-mono text-sm text-text">
            Referenz: <strong>{reference}</strong>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7 space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5 md:p-6">
            <h3 className="font-bold text-text text-base md:text-lg mb-4 flex items-center gap-2">
              <Clock className="text-primary shrink-0" size={20} />
              So geht es jetzt weiter
            </h3>

            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">Bestätigungs-SMS unterwegs</p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                    Sie erhalten gleich eine SMS mit Ihrer Referenznummer
                    und einem Hinweis auf die Widerrufswege.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                  2
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">
                    Antwort innerhalb von 24 Stunden
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                    Unser Heizungsbau-Experte aus Bremen meldet sich telefonisch mit einer
                    kostenlosen und unverbindlichen Einschätzung zu Eignung, Machbarkeit,
                    Kosten und Förderung.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">
                    Persönliche Einschätzung statt Algorithmus
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                    Eine automatisierte Vor-Bewertung findet bewusst nicht statt –
                    der Experte schaut sich Ihre Angaben persönlich an.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="notice-success text-xs leading-relaxed">
            <strong>100 % kostenlos &amp; unverbindlich:</strong> Aus dieser Anfrage entsteht
            kein Vertrag und keine Zahlungspflicht. Sie können Ihre Einwilligung jederzeit
            ohne Angabe von Gründen widerrufen.
          </div>
        </div>

        <div className="md:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 text-left">
            <h4 className="font-bold text-text text-sm mb-2 flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              Einwilligung widerrufen
            </h4>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              Jederzeit formfrei und ohne Angabe von Gründen (Art. 7 Abs. 3 DSGVO):
            </p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-text">
                <MessageSquare size={12} className="text-primary shrink-0" />
                <a href="/widerruf/" className="hover:text-primary underline">
                  bremer-waermepumpe.de/widerruf
                </a>
                {reference && (
                  <span className="text-text-muted">(Ref. {reference})</span>
                )}
              </li>
            </ul>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 text-left text-xs text-text-muted leading-relaxed">
            <strong className="text-text block mb-1">Wer meldet sich?</strong>{" "}
            Der unter{' '}
            <a href="/fachpartner/" target="_blank" rel="noopener" className="underline text-primary">
              /fachpartner/
            </a>{' '}
            namentlich genannte Heizungsbau-Experte. Eine Weitergabe an hier nicht
            genannte Dritte findet nicht statt.
          </div>
        </div>
      </div>
    </div>
  );
}
