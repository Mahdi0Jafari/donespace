---
name: seo-master
description: A comprehensive guide and set of rules for implementing 2026 SEO standards, including Technical SEO, Entity & On-Page strategies, Core Web Vitals, AI Crawlers, and Generative Engine Optimization (GEO).
---

# Comprehensive SEO Master Guide for Google & AI Search (2026 Standards)

Reaching rank #1 and dominating AI Overviews requires **Trust, Entity Authority, and Technical Excellence**. Search engines and AI answer engines (Google Gemini, SearchGPT, Perplexity) prioritize verifiable facts, lightning-fast delivery, and structured data.

---

## 1. Content, Entity & On-Page SEO

* **Generative Engine Optimization (GEO) & Answer-First:**
  * State the direct answer/conclusion in the first 1–2 paragraphs (reducing Time-to-Value).
  * Structure content modularly with clear H2/H3s, concise bullet points, and high Information Gain.
* **Entity SEO & Knowledge Graph:**
  * Connect topics to recognized entities using structured data (`sameAs` links to Wikidata, official profiles, Wikipedia).
  * Build semantic topical authority using Topic Clusters (Pillar Pages + interconnected sub-topic Cluster Pages).
* **Search Intent & Table of Contents:**
  * Align explicitly with Intent: Informational, Commercial, Navigational, or Transactional.
  * Always include a Jump-linked Table of Contents (generates Google Rich Sitelinks).
* **E-E-A-T (Experience, Expertise, Authoritativeness, Trust):**
  * Include clear author schema with bio, real credentials, citations of primary sources, and first-hand empirical data.
* **Semantic HTML & Meta Tags:**
  * Use proper tags: `<main>`, `<article>`, `<section>`, `<nav>`, `<aside>`, `<figure>`.
  * Title tags (< 60 chars) and Meta Descriptions (< 155 chars) with primary keyword near the beginning.
  * Complete Open Graph (`og:*`) and Twitter Card metadata for rich social crawling.

---

## 2. Technical SEO & AI Crawlability

* **Indexing & Crawl Budget:**
  * Clean `robots.txt` and verified dynamic XML Sitemap in Google Search Console.
  * Canonical tags (`rel="canonical"`) on all pages to prevent duplicate content penalties.
  * Proper multi-language handling with `hreflang` where applicable.
* **AI Bot Management & `llms.txt`:**
  * Maintain an `/llms.txt` and `/llms-full.txt` markdown summary for LLM context ingestion.
  * Configure access policies for AI crawlers (e.g., `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`).
* **Rich Schema Markup (JSON-LD):**
  * Implement explicit JSON-LD: `Organization`, `Article`, `Product`, `FAQPage`, `BreadcrumbList`, and `VideoObject`.
* **Site Architecture & URL Hygiene:**
  * Flat hierarchy: all critical pages accessible within 3 clicks from root.
  * Clean, lowercase, hyphen-separated URLs. Proper 301 redirects and custom 404 monitoring.

---

## 3. Core Web Vitals & Asset Performance

* **LCP (Largest Contentful Paint) < 2.5s:**
  * Preload critical hero assets and use `fetchpriority="high"` on LCP images.
  * Serve modern formats (**AVIF / WebP**) with explicit `width` and `height` attributes.
* **INP (Interaction to Next Paint) < 200ms:**
  * Minimize main thread blocking; break up long tasks (>50ms) using web workers or asynchronous yields.
* **CLS (Cumulative Layout Shift) < 0.1:**
  * Reserve layout dimensions for dynamic widgets, ads, and embeds. Use `font-display: swap` to avoid FOIT.
* **TTFB (Time to First Byte) < 800ms:**
  * Utilize Edge CDN caching, HTTP/3, and optimized server-side rendering (SSR / SSG).
* **Mobile-First Design:** Complete touch friendliness, fluid responsiveness, and no layout clipping.

---

## 4. Modern Off-Page & Authority Building

* **Digital PR & Original Research:**
  * Publish industry benchmark reports, free calculation tools, and unique data studies that naturally attract editorial backlinks.
* **Brand Mentions & Citation Velocity:**
  * Track and reclaim unlinked brand mentions. Ensure consistent NAP (Name, Address, Phone) across directories.
* **Strict Penalty Prevention:**
  * Zero tolerance for link buying schemes, private blog networks (PBNs), or automated spam redirects.

---

## 5. AI Content Strategy & Humanization

* **Information Gain Score:**
  * Every page must contain unique data, real screenshots, quotes, or case studies that raw AI cannot generate.
* **Clear, Scannable Rhythm:**
  * Avoid monotonous AI sentence structures. Use punchy sentences, callouts (`[!NOTE]`, `[!TIP]`), comparison tables, and active voice.
