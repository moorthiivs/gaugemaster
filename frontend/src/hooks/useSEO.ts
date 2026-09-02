import { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

/**
 * Enterprise SEO & Structured Data Management Hook
 * Dynamically updates document title, meta descriptions, OpenGraph, Twitter cards,
 * canonical URLs, robots directives, and dynamic JSON-LD structured data scripts.
 */
export function useSEO({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  noIndex = false,
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
      document.title = title.includes("Gaugemaster") ? title : `${title} | Gaugemaster`;
    }

    // Helper to safely set or update meta tag by name or property
    const setMeta = (attr: "name" | "property", key: string, content: string) => {
      let element = document.querySelector(`meta[${attr}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // 2. Update Standard Description & Keywords
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }

    if (keywords) {
      setMeta("name", "keywords", keywords);
    }

    // 3. Update OpenGraph and Twitter Titles
    if (title) {
      setMeta("property", "og:title", title);
      setMeta("name", "twitter:title", title);
    }

    // 4. Update Images
    if (ogImage) {
      setMeta("property", "og:image", ogImage);
      setMeta("name", "twitter:image", ogImage);
    }

    // 5. Update Robots (index/noindex)
    const robotsContent = noIndex
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
    setMeta("name", "robots", robotsContent);

    // 6. Update Canonical Link
    if (canonical) {
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute("href", canonical);
    }

    // 7. Dynamic JSON-LD Structured Data Injection
    const SCRIPT_ID = "dynamic-seo-jsonld";
    let scriptEl = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = SCRIPT_ID;
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    // Cleanup dynamic JSON-LD on unmount
    return () => {
      const el = document.getElementById(SCRIPT_ID);
      if (el) el.remove();
    };
  }, [title, description, keywords, canonical, ogImage, noIndex, jsonLd]);
}
