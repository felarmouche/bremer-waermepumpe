export type ConsentVersion = {
  version: string;
  validFrom: string;
  marketingLabel: string;
  marketingLabelHtml?: string;
  termsLabel: string;
  smsNoticeLabel?: string;
  smsNoticeLabelHtml?: string;
};

export const consentVersions: ConsentVersion[] = [
  {
    version: "consent-v1-2026-05-29",
    validFrom: "2026-05-29",
    marketingLabel:
      "Ich willige ein, dass meine Daten an den auf der Fachpartner-Seite namentlich genannten SHK-Betrieb weitergeleitet werden und dieser mich telefonisch zu einer Wärmepumpe kontaktieren darf. Die Einwilligung kann ich jederzeit widerrufen (z. B. über /widerruf/).",
    marketingLabelHtml:
      "Ich willige ein, dass meine Daten an den auf der <a href=\"/fachpartner/\" class=\"underline text-primary font-semibold\" target=\"_blank\" rel=\"noopener\">Fachpartner-Seite</a> namentlich genannten SHK-Betrieb weitergeleitet werden und dieser mich telefonisch zu einer Wärmepumpe kontaktieren darf. Die Einwilligung kann ich jederzeit widerrufen (z. B. über <a href=\"/widerruf/\" class=\"underline\">/widerruf/</a>).",
    termsLabel:
      "Ich stimme den Nutzungsbedingungen zu und habe die Datenschutzerklärung zur Kenntnis genommen.",

  },
];

export const currentConsentVersion =
  consentVersions[consentVersions.length - 1];
