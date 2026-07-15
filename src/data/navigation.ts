export type NavLink = {
  href: string;
  label: string;
  navLabel?: string;
  description?: string;
};

export type NavCluster = {
  id: string;
  label: string;
  description?: string;
  inHeader: boolean;
  inFooter: boolean;
  links: NavLink[];
};

export const navClusters: NavCluster[] = [
  {
    id: "ratgeber",
    label: "Ratgeber",
    description: "Lokale Einordnung rund um Wärmepumpen in Bremen.",
    inHeader: true,
    inFooter: true,
    links: [
      {
        href: "/",
        label: "Wärmepumpe Bremen",
        navLabel: "Wärmepumpe",
        description: "Startseite & Überblick für Bremen.",
      },
      {
        href: "/waermepumpe-altbau-bremen/",
        label: "Wärmepumpe im Altbau",
        navLabel: "Altbau",
        description: "Eignung und Einwände rund um Bestandsgebäude.",
      },
      {
        href: "/waermepumpe-kosten-bremen/",
        label: "Kosten Bremen",
        navLabel: "Kosten",
        description: "Realistische Kosten und Eigenanteil in Bremen.",
      },
      {
        href: "/waermepumpe-foerderung-bremen/",
        label: "Förderung Bremen",
        navLabel: "Förderung",
        description: "KfW 458, BAFA, BAB – strukturiert für Bremen.",
      },
    ],
  },
  {
    id: "kosten-detail",
    label: "Kosten im Detail",
    description: "Vertiefende Spokes zu Wärmepumpen-Kosten.",
    inHeader: false,
    inFooter: true,
    links: [
      {
        href: "/waermepumpe-altbau-kosten/",
        label: "Altbau Kosten",
        description: "Kostenrahmen für Bestandsgebäude inkl. Heizkörper-Posten.",
      },
      {
        href: "/luft-wasser-waermepumpe-kosten/",
        label: "Luft-Wasser-Wärmepumpe",
        description: "Detail zur häufigsten Bauart in Bremen.",
      },
      {
        href: "/waermepumpe-kosten-einfamilienhaus/",
        label: "Einfamilienhaus",
        description: "Kosten nach Wohnfläche mit Amortisationsrechnung.",
      },
    ],
  },
  {
    id: "foerderung-detail",
    label: "Förderung im Detail",
    description: "Vertiefende Spokes zur Wärmepumpen-Förderung.",
    inHeader: false,
    inFooter: true,
    links: [
      {
        href: "/kfw-458-waermepumpe/",
        label: "KfW 458",
        description: "Antragsweg und förderfähige Kosten Schritt für Schritt.",
      },
      {
        href: "/bafa-foerderung-waermepumpe/",
        label: "BAFA-Förderung",
        description: "Heizungsoptimierung, iSFP, Energieberatung.",
      },
      {
        href: "/waermepumpe-foerderung-2026/",
        label: "Förderung 2026",
        description: "KfW-Änderungen, GEG und Lärmgrenzen im Jahresüberblick.",
      },
      {
        href: "/bab-heizungstausch-bremen/",
        label: "BAB Heizungstausch",
        description: "Status des Bremer Programms und Förder-Alternativen.",
      },
    ],
  },
  {
    id: "vergleich-praxis",
    label: "Vergleich & Praxis",
    description: "Entscheidungs- und Praxisfragen rund um Wärmepumpen in Bremen.",
    inHeader: false,
    inFooter: true,
    links: [
      {
        href: "/waermepumpe-oder-gasheizung-bremen/",
        label: "Wärmepumpe oder Gasheizung",
        description: "Kosten, Förderung und GEG-Pflicht im Vergleich.",
      },
      {
        href: "/waermepumpe-abstand-nachbar-bremen/",
        label: "Abstand zum Nachbarn",
        description: "BremLBO, Grenzabstand, TA Lärm und Schallschutz.",
      },
    ],
  },
  {
    id: "entscheidung",
    label: "Entscheidungshilfe",
    description: "Erste Einschätzung für Ihr Haus.",
    inHeader: false,
    inFooter: true,
    links: [
      {
        href: "/check/",
        label: "Wärmepumpen-Check",
        navLabel: "Check",
        description: "Eignungs- und Fördercheck direkt im Browser.",
      },
    ],
  },
  {
    id: "ueber",
    label: "Über",
    inHeader: true,
    inFooter: true,
    links: [
      {
        href: "/kontakt/",
        label: "Kontakt",
        description: "Hintergrund, Zielsetzung und Kontakt.",
      },
    ],
  },
  {
    id: "rechtliches",
    label: "Rechtliches",
    inHeader: false,
    inFooter: true,
    links: [
      { href: "/impressum/", label: "Impressum" },
      { href: "/datenschutz/", label: "Datenschutz" },
      { href: "/agb/", label: "Nutzungsbedingungen" },
      { href: "/widerruf/", label: "Widerruf" },
      { href: "/fachpartner/", label: "Fachpartner" },
    ],
  },
];

export const primaryCta: NavLink = {
  href: "/check/",
  label: "Eignung & Förderung prüfen",
};

export const headerClusters = navClusters.filter((c) => c.inHeader);
export const footerClusters = navClusters.filter((c) => c.inFooter);

export const headerLinks: NavLink[] = headerClusters.flatMap((c) => c.links);

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname.startsWith(href);
}
