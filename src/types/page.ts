// Gemeinsames Datenmodell für die Content-Seiten unter src/pages/.
// Ersetzt das frühere `const data: any` und gibt Compile-Time-Validierung,
// die zuvor die (gelöschte) Content-Collection-Konfiguration geboten hat.

export interface CTALink {
  label: string;
  href: string;
}

export interface HeroData {
  headline: string;
  subtext: string;
  primaryCTA: CTALink;
  secondaryCTA?: CTALink;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface CtaBlock {
  headline: string;
  text?: string;
  variant?: "default" | "highlight";
  primaryCTA: CTALink;
  secondaryCTA?: CTALink;
}

export interface TrustItem {
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PageSchemaData {
  type?: "Article" | "HowTo";
  datePublished?: string;
  dateModified?: string;
  howToName?: string;
  howToDescription?: string;
  howToSteps?: { name: string; text: string }[];
}

export interface PageData {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
  lastUpdated?: string;
  hero: HeroData;
  trustItems: TrustItem[];
  breadcrumb: BreadcrumbItem[];
  ctaBlock?: CtaBlock;
  faqHeading?: string;
  faqs: FaqItem[];
  schema?: PageSchemaData;
}
