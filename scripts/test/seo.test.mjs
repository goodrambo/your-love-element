import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const contracts = JSON.parse(readFileSync(resolve(root, "harness/contracts.json"), "utf8"));
const origin = contracts.production.site_url;

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function firstMatch(html, expression, label) {
  const match = html.match(expression);
  assert.ok(match, `Missing ${label}`);
  return match[1].trim();
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => JSON.parse(match[1]));
}

function graphTypes(html) {
  return new Set(
    jsonLdBlocks(html)
      .flatMap((payload) => payload["@graph"] || [payload])
      .flatMap((item) => Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]])
      .filter(Boolean),
  );
}

function plainText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function visibleFaqEntries(html, relativePath) {
  const section = firstMatch(
    html,
    /<section[^>]+id=["']faq["'][^>]*>([\s\S]*?)<\/section>/i,
    `${relativePath} visible FAQ section`,
  );

  return [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => ({
    question: plainText(match[1]),
    answer: plainText(match[2]),
  }));
}

function structuredFaqEntries(html, relativePath) {
  const faqPage = jsonLdBlocks(html)
    .flatMap((payload) => payload["@graph"] || [payload])
    .find((item) => item["@type"] === "FAQPage");

  assert.ok(faqPage, `${relativePath} must include FAQPage JSON-LD`);
  return faqPage.mainEntity.map((entry) => ({
    question: entry.name.trim(),
    answer: entry.acceptedAnswer.text.trim(),
  }));
}

function structuredItem(html, type, relativePath) {
  const matches = jsonLdBlocks(html)
    .flatMap((payload) => payload["@graph"] || [payload])
    .filter((item) => item["@type"] === type);

  assert.equal(matches.length, 1, `${relativePath} must include exactly one ${type} JSON-LD item`);
  return matches[0];
}

test("indexable pages have unique search metadata and sitemap entries", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const titles = new Set();
  const descriptions = new Set();

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const title = firstMatch(html, /<title>([^<]+)<\/title>/i, `${relativePath} title`);
    const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, `${relativePath} description`);
    const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, `${relativePath} canonical`);
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

    assert.equal(h1Count, 1, `${relativePath} must have exactly one h1`);
    assert.ok(canonical.startsWith(`${origin}/`), `${relativePath} canonical must use the production origin`);
    assert.ok(!titles.has(title), `${relativePath} title must be unique`);
    assert.ok(!descriptions.has(description), `${relativePath} description must be unique`);
    titles.add(title);
    descriptions.add(description);

    if (noindex) {
      assert.ok(!sitemapUrls.has(canonical), `${relativePath} is noindex and must stay out of the sitemap`);
    } else {
      assert.ok(sitemapUrls.has(canonical), `${relativePath} is indexable and must be in the sitemap`);
    }
  }
});

test("every indexable page exposes one valid keyboard skip target", () => {
  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) continue;

    const skipLinks = [...html.matchAll(/<a[^>]+class=["'][^"']*\bskip-link\b[^"']*["'][^>]+href=["']#([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    assert.equal(skipLinks.length, 1, `${relativePath} must expose exactly one skip link`);

    const target = skipLinks[0][1];
    const label = plainText(skipLinks[0][2]);
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.ok(label, `${relativePath} skip link must have an accessible label`);
    assert.match(html, new RegExp(`\\bid=["']${escapedTarget}["']`, "i"), `${relativePath} skip link target must exist`);
  }
});

test("sitemap dates and robots discovery instructions are valid", () => {
  const sitemap = read("sitemap.xml");
  const robots = read("robots.txt");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const lastModified = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);

  assert.equal(new Set(urls).size, urls.length, "Sitemap URLs must be unique");
  assert.ok(urls.every((url) => url.startsWith(`${origin}/`)), "Sitemap URLs must use the production origin");
  assert.ok(lastModified.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)), "Sitemap lastmod values must use YYYY-MM-DD");
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.match(robots, new RegExp(`Sitemap:\\s*${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\/sitemap\\.xml`, "i"));
});

test("homepage exposes the entity, product, answer, and content-cluster signals", () => {
  const html = read("index.html");
  const types = graphTypes(html);

  for (const type of ["Organization", "WebSite", "WebPage", "Product", "FAQPage"]) {
    assert.ok(types.has(type), `Homepage JSON-LD must include ${type}`);
  }
  assert.match(html, /<h2[^>]*>What are the five love elements\?<\/h2>/i);
  assert.match(html, /href=["']\/five-elements-love-compatibility\/["']/i);
  assert.match(html, /href=["']\/how-it-works\/["']/i);
  assert.match(html, /\$9\.99/);
});

test("homepage keeps the preview-to-purchase path explicit and trustworthy", () => {
  const html = read("index.html");
  const styles = read("styles.css");
  const script = read("script.js");

  assert.match(html, /href=["']#unlockReport["'][^>]*data-track-cta=["']preview_offer["']/i);
  assert.match(html, /id=["']unlockReport["']/i);
  assert.match(html, /One-time \$9\.99 USD purchase with secure checkout by Lemon Squeezy\./i);
  assert.match(html, /id=["']checkoutEmail["'][^>]*aria-describedby=["']checkoutEmailHelp["'][^>]*required/i);
  assert.ok(html.indexOf('id="unlockReport"') < html.indexOf('id="shareCardPanel"'), "The purchase offer must appear before sharing tools");
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.nav-actions\s*{\s*display:\s*none;/i);
  assert.match(script, /Choose your birth month\./);
  assert.match(script, /Enter your birth day\./);
  assert.match(script, /Local preview mode keeps checkout safely disabled\./);
});

test("share cards use a privacy-safe attributable referral URL", () => {
  const html = read("index.html");
  const script = read("script.js");
  const shareUrlMatch = script.match(/const shareReferralUrl = "([^"]+)";/);

  assert.ok(shareUrlMatch, "script.js must define one fixed share referral URL");
  const shareUrl = new URL(shareUrlMatch[1]);
  assert.equal(shareUrl.origin, origin);
  assert.equal(shareUrl.pathname, "/");
  assert.deepEqual(Object.fromEntries(shareUrl.searchParams), {
    utm_source: "share_card",
    utm_medium: "referral",
    utm_campaign: "organic_share",
    utm_content: "result_card",
  });
  for (const privateKey of ["answer", "element", "email", "session", "reading_id", "order_id", "customer_id"]) {
    assert.equal(shareUrl.searchParams.has(privateKey), false, `share URL must not include ${privateKey}`);
  }
  assert.match(script, /discover yours:\\n\$\{shareReferralUrl\}/);
  assert.match(html, /class=["']copy-link-button["'][^>]*id=["']copyShareLinkButton["'][^>]*>Copy link<\/button>/i);
  assert.match(script, /navigator\.clipboard\.writeText\(shareReferralUrl\)/);
  assert.match(script, /Referral link copied\./);
  assert.match(script, /Copying is not available in this browser\./);
  assert.doesNotMatch(script, /trackMetaCustomEvent\(["']share_card_link_copied["']/);
});

test("homepage serves an optimized, layout-stable hero image", () => {
  const html = read("index.html");
  const sitemap = read("sitemap.xml");
  const optimizedAsset = resolve(root, "assets/hero-soulmate-report.webp");
  const structuredData = JSON.stringify(jsonLdBlocks(html));

  assert.ok(statSync(optimizedAsset).size < 200_000, "Optimized hero image must stay below 200 KB");
  assert.match(html, /<img[^>]+class=["']hero-image["'][^>]+src=["']assets\/hero-soulmate-report\.webp["'][^>]+width=["']1672["'][^>]+height=["']941["'][^>]+fetchpriority=["']high["'][^>]+decoding=["']async["']/i);
  assert.match(html, /<img[^>]+src=["']assets\/hero-soulmate-report\.webp["'][^>]+width=["']1672["'][^>]+height=["']941["'][^>]+loading=["']lazy["'][^>]+decoding=["']async["'][^>]+alt=["']A sample future partner portrait["']/i);
  assert.doesNotMatch(html, /src=["']assets\/hero-soulmate-report\.png["']/i);
  assert.match(structuredData, /https:\/\/yourloveelement\.com\/assets\/hero-soulmate-report\.webp/);
  assert.doesNotMatch(structuredData, /hero-soulmate-report\.png/);
  assert.match(sitemap, /xmlns:image=["']http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1["']/i);
  assert.match(sitemap, /<image:loc>https:\/\/yourloveelement\.com\/assets\/hero-soulmate-report\.webp<\/image:loc>/i);
});

test("informational cookie UI does not claim to offer preferences", () => {
  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    assert.doesNotMatch(html, /Cookie preferences/i, `${relativePath} must label the single-action UI as a notice`);
  }
});

test("editorial pages are answer-first, transparent, and structured", () => {
  for (const relativePath of ["five-elements-love-compatibility/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const types = graphTypes(html);

    for (const type of ["WebPage", "Article", "BreadcrumbList", "FAQPage"]) {
      assert.ok(types.has(type), `${relativePath} JSON-LD must include ${type}`);
    }
    assert.match(html, /<strong>Short answer:<\/strong>/i);
    assert.match(html, /Published and reviewed by Your Love Element/i);
    assert.match(html, /content=["']index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1["']/i);
    assert.ok(jsonLdBlocks(html).every((payload) => JSON.stringify(payload).length > 100), `${relativePath} JSON-LD must not be empty`);
  }
});

test("editorial breadcrumbs form one canonical two-level hierarchy", () => {
  for (const relativePath of ["five-elements-love-compatibility/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    const page = structuredItem(html, "WebPage", relativePath);
    const breadcrumb = structuredItem(html, "BreadcrumbList", relativePath);
    const entries = breadcrumb.itemListElement;

    assert.equal(page.breadcrumb?.["@id"], breadcrumb["@id"], `${relativePath} WebPage must reference its breadcrumb`);
    assert.ok(breadcrumb["@id"].startsWith(canonical), `${relativePath} breadcrumb id must stay under its canonical URL`);
    assert.ok(Array.isArray(entries), `${relativePath} breadcrumb items must be an array`);
    assert.equal(entries.length, 2, `${relativePath} breadcrumb must contain Home and the current page`);
    assert.deepEqual(entries.map((entry) => entry.position), [1, 2], `${relativePath} breadcrumb positions must be contiguous`);
    assert.ok(entries.every((entry) => entry["@type"] === "ListItem"), `${relativePath} breadcrumb entries must be ListItem values`);
    assert.equal(entries[0].name, "Home", `${relativePath} breadcrumb must start at Home`);
    assert.equal(entries[0].item, `${origin}/`, `${relativePath} Home breadcrumb must use the production root`);
    assert.equal(entries[1].item, canonical, `${relativePath} current-page breadcrumb must match the canonical URL`);
    assert.ok(entries[1].name?.trim(), `${relativePath} current-page breadcrumb must have a name`);
  }
});

test("editorial FAQ schema exactly matches the visible questions and answers", () => {
  for (const relativePath of ["five-elements-love-compatibility/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const visible = visibleFaqEntries(html, relativePath);
    const structured = structuredFaqEntries(html, relativePath);

    assert.ok(visible.length >= 3, `${relativePath} must expose a useful visible FAQ`);
    assert.deepEqual(structured, visible, `${relativePath} FAQ schema must not drift from visible content`);
  }
});

test("methodology states the AI and traditional-chart boundaries", () => {
  const html = read("how-it-works/index.html");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  assert.match(text, /The free preview does not use generative AI/i);
  assert.match(text, /The paid full report does use AI after payment is verified/i);
  assert.match(text, /does not collect birth year, birth time, birthplace/i);
  assert.match(text, /cannot verify a soulmate/i);
});
