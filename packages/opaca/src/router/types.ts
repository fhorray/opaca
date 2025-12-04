export interface BunaMetaRobots {
  /** Allow indexing of this page */
  index?: boolean;
  /** Allow following links on this page */
  follow?: boolean;
  /** Disallow showing cached version */
  noarchive?: boolean;
  /** Disallow showing snippets in search results */
  nosnippet?: boolean;
  /** Disallow indexing images */
  noimageindex?: boolean;
  /** Disallow using description from open directory */
  noodp?: boolean;
  /** Disallow translating this page in search */
  notranslate?: boolean;
}

export interface BunaMetaOpenGraphImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
}

export type BunaMetaOpenGraphType =
  | "website"
  | "article"
  | "profile"
  | "product"
  | "video.movie"
  | "video.episode"
  | "video.tv_show"
  | "video.other";

export interface BunaMetaOpenGraph {
  title?: string;
  description?: string;
  url?: string;
  siteName?: string;
  type?: BunaMetaOpenGraphType;
  images?: BunaMetaOpenGraphImage[];
  locale?: string;
}

export type BunaMetaTwitterCard = "summary" | "summary_large_image" | "app" | "player";

export interface BunaMetaTwitter {
  card?: BunaMetaTwitterCard;
  site?: string; // @site_handle
  creator?: string; // @creator_handle
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface BunaMetaAlternateHrefLang {
  href: string;
  hrefLang: string;
}

/**
 * BunaMeta
 * --------
 * Describes all metadata needed to build the <head> of an HTML document.
 */
export interface BunaMeta {
  /** <title> tag content */
  title: string;

  /** <meta name="description" /> */
  description?: string;

  /** <meta name="keywords" /> as array, will be joined with commas */
  keywords?: string[];

  /**
   * Robots configuration.
   * Can be a raw string ("index,follow") or a structured object.
   */
  robots?: string | BunaMetaRobots;

  /** <html lang="..." /> */
  htmlLang?: string;

  /** <meta charset="utf-8" /> */
  charset?: string;

  /** <meta name="viewport" /> */
  viewport?: string;

  /** <meta name="author" /> */
  author?: string;

  /** <link rel="canonical" /> */
  canonicalUrl?: string;

  /** <meta name="theme-color" /> */
  themeColor?: string;

  /** <meta name="color-scheme" /> (e.g. "light dark") */
  colorScheme?: string;

  /** Favicon URL <link rel="icon" /> */
  faviconUrl?: string;

  /**
   * Alternate language/region versions
   * -> <link rel="alternate" hrefLang="..." href="..." />
   */
  alternates?: BunaMetaAlternateHrefLang[];

  /**
   * Open Graph tags (Facebook, LinkedIn, etc.)
   * -> <meta property="og:*" />
   */
  openGraph?: BunaMetaOpenGraph;

  /**
   * Twitter Card tags
   * -> <meta name="twitter:*" />
   */
  twitter?: BunaMetaTwitter;

  /**
   * JSON-LD structured data
   * Will be rendered inside <script type="application/ld+json">
   */
  structuredData?: Record<string, unknown> | Record<string, unknown>[];

  /**
   * Extra custom meta tags (escape hatch)
   * Example: { name: "x-custom", content: "foo" }
   * or: { property: "og:locale:alternate", content: "en_US" }
   */
  extraMeta?: Array<{
    name?: string;
    property?: string;
    content: string;
    httpEquiv?: string;
  }>;

  /**
   * Extra <link> tags
   * Example: preconnect, dns-prefetch, stylesheets, etc.
   */
  extraLinks?: Array<{
    rel: string;
    href: string;
    as?: string;
    type?: string;
    crossOrigin?: string;
    media?: string;
  }>;
}
