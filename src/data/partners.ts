export type Partner = {
  id: string;
  firmierung: string;
  inhaber: string;
  anschrift: { strasse: string; plz: string; ort: string };
  telefon: string;
  email: string;
  webseite?: string;
  ustId?: string;
  handelsregister?: { gericht: string; nummer: string };
  handwerkskammer?: string;
  spezialgebiete?: string[];
  datenschutzUrl?: string;
  isPlaceholder?: boolean;
};

export type PartnerVersion = {
  version: string;
  validFrom: string;
  partners: Partner[];
};

export const partnerVersions: PartnerVersion[] = [
  {
    version: "v3-2026-05-29",
    validFrom: "2026-05-29T00:00:00Z",
    partners: [
      {
        id: "fritz-group-bremen",
        firmierung: "Fritz Group",
        inhaber: "Göller, Paul Wolfang Johannes ",
        anschrift: {
          strasse: "Osterdeich 59A",
          plz: "28203",
          ort: "Bremen",
        },
        telefon: "0421 37703556",
        email: "moin@fritts.solar",
        spezialgebiete: [
          "Wärmepumpen",
          "Heizungsbau",
          "Photovoltaik",
        ],
        datenschutzUrl: "https://www.fritts.group/datenschutz",
        isPlaceholder: false,
      },
    ],
  },
];

export const currentPartnerVersion =
  partnerVersions[partnerVersions.length - 1];

export function getPartnersByVersion(v: string): PartnerVersion | undefined {
  return partnerVersions.find((pv) => pv.version === v);
}

export const MAX_PARTNERS_PER_LEAD = 1;
