import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const cta = z.object({
    label: z.string(),
    href: z.string(),
});

const pages = defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "./src/content/pages" }),
    schema: ({ image }) =>
        z.object({
            title: z.string().max(70),
            description: z.string().max(170),
            canonical: z.string().url().optional(),
            noindex: z.boolean().optional(),
            lastUpdated: z.string().optional(),
            hero: z.object({
                headline: z.string(),
                subtext: z.string(),
                imageSrc: image(),
                primaryCTA: cta,
                secondaryCTA: cta.optional(),
            }),
            trustItems: z
                .array(z.object({ text: z.string() }))
                .default([]),
            breadcrumb: z
                .array(
                    z.object({
                        label: z.string(),
                        href: z.string().optional(),
                    }),
                )
                .default([]),
            ctaBlock: z
                .object({
                    headline: z.string(),
                    text: z.string().optional(),
                    variant: z
                        .enum(["default", "highlight"])
                        .default("default"),
                    primaryCTA: cta,
                    secondaryCTA: cta.optional(),
                })
                .optional(),
            faqs: z
                .array(
                    z.object({
                        question: z.string(),
                        answer: z.string(),
                    }),
                )
                .default([]),
            faqHeading: z.string().optional(),
            schema: z
                .object({
                    type: z.enum(["Article", "HowTo"]).optional(),
                    datePublished: z.string().optional(),
                    dateModified: z.string().optional(),
                    howToName: z.string().optional(),
                    howToDescription: z.string().optional(),
                    howToSteps: z
                        .array(
                            z.object({
                                name: z.string(),
                                text: z.string(),
                            }),
                        )
                        .optional(),
                })
                .optional(),
        }),
});

export const collections = { pages };
