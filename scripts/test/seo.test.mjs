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

function uniqueMetaContent(html, attribute, value, label) {
  const matches = [
    ...html.matchAll(new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${value}["'])[^>]*\\bcontent=["']([^"']+)["'][^>]*>`, "gi")),
  ];
  assert.equal(matches.length, 1, `${label} must appear exactly once`);
  return matches[0][1].trim();
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

function isFollowableAnchor(anchor) {
  const rel = anchor.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] || "";
  const relTokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
  const downloads = /\bdownload(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|>)/i.test(anchor);
  return !relTokens.has("nofollow") && !downloads;
}

function wildcardRobotsDisallowsRoot(robots) {
  let userAgents = [];
  let groupHasRules = false;

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;

    const directive = line.match(/^([^:]+):\s*(.*)$/);
    if (!directive) continue;

    const name = directive[1].trim().toLowerCase();
    const value = directive[2].trim().toLowerCase();
    if (name === "user-agent") {
      if (groupHasRules) {
        userAgents = [];
        groupHasRules = false;
      }
      userAgents.push(value);
      continue;
    }

    if (!userAgents.length) continue;
    groupHasRules = true;
    if (name === "disallow" && value === "/" && userAgents.includes("*")) return true;
  }

  return false;
}

function robotsMetaDirectives(html, label) {
  const matches = [
    ...html.matchAll(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*\bcontent=["']([^"']*)["'][^>]*>/gi),
  ];
  assert.ok(matches.length <= 1, `${label} must not expose duplicate robots meta directives`);
  return new Set(
    (matches[0]?.[1] || "")
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean),
  );
}

test("indexable pages have unique search metadata and sitemap entries", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const indexableCanonicals = new Set();
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
      indexableCanonicals.add(canonical);
      assert.ok(sitemapUrls.has(canonical), `${relativePath} is indexable and must be in the sitemap`);
    }
  }

  assert.deepEqual(
    [...sitemapUrls].sort(),
    [...indexableCanonicals].sort(),
    "Sitemap must contain exactly the configured indexable canonical URLs",
  );
});

test("sitemap pages never opt out of indexing or link following", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  let checkedPages = 0;

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    if (!sitemapUrls.has(canonical)) continue;

    checkedPages += 1;
    const directives = robotsMetaDirectives(html, relativePath);
    assert.ok(!directives.has("noindex"), `${relativePath} is in the sitemap and must not emit noindex`);
    assert.ok(!directives.has("nofollow"), `${relativePath} is in the sitemap and must not emit nofollow`);
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must have an indexable local page contract");
});

test("every indexable page receives a crawlable internal link from another page", () => {
  const indexablePages = new Map();

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) continue;

    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    indexablePages.set(new URL(canonical).pathname, {
      canonical,
      html,
      inboundSources: new Set(),
      relativePath,
    });
  }

  for (const [sourcePath, sourcePage] of indexablePages) {
    for (const match of sourcePage.html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
      if (!isFollowableAnchor(match[0])) continue;

      const targetUrl = new URL(match[1], sourcePage.canonical);
      if (targetUrl.origin !== origin || targetUrl.pathname === sourcePath) continue;

      indexablePages.get(targetUrl.pathname)?.inboundSources.add(sourcePath);
    }
  }

  for (const page of indexablePages.values()) {
    assert.ok(
      page.inboundSources.size > 0,
      `${page.relativePath} must receive a crawlable internal link from another indexable page`,
    );
  }
});

test("crawlable internal-link coverage excludes nofollow and download anchors", () => {
  assert.equal(isFollowableAnchor('<a href="/guide/">Guide</a>'), true);
  assert.equal(isFollowableAnchor('<a href="/guide/" rel="ugc nofollow">Guide</a>'), false);
  assert.equal(isFollowableAnchor('<a href="/guide/" rel="NOFOLLOW sponsored">Guide</a>'), false);
  assert.equal(isFollowableAnchor('<a href="/guide/" download>Guide</a>'), false);
  assert.equal(isFollowableAnchor('<a href="/guide/" download="guide.html">Guide</a>'), false);
});

test("same-origin fragment links resolve to one configured page target", () => {
  const pagesByPath = new Map();

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    pagesByPath.set(new URL(canonical).pathname, { html, relativePath });
  }

  let checkedLinks = 0;
  for (const { html, relativePath } of pagesByPath.values()) {
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );

    for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
      const targetUrl = new URL(match[1], canonical);
      if (targetUrl.origin !== origin || !targetUrl.hash) continue;

      checkedLinks += 1;
      const targetPage = pagesByPath.get(targetUrl.pathname);
      assert.ok(targetPage, `${relativePath} fragment link must target a configured local page: ${match[1]}`);

      const targetId = decodeURIComponent(targetUrl.hash.slice(1));
      const idMatches = [...targetPage.html.matchAll(/\bid=["']([^"']+)["']/gi)]
        .filter((idMatch) => idMatch[1] === targetId);
      assert.equal(
        idMatches.length,
        1,
        `${relativePath} fragment link must resolve to one target in ${targetPage.relativePath}: ${match[1]}`,
      );
    }
  }

  assert.ok(checkedLinks > 0, "At least one same-origin fragment link must be covered");
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
    const targetElement = html.match(new RegExp(`<[^>]*\\bid=["']${escapedTarget}["'][^>]*>`, "i"))?.[0] || "";
    assert.match(targetElement, /\btabindex=["']-1["']/i, `${relativePath} skip link target must receive programmatic focus`);
  }
});

test("core navigation identifies the current page exactly once", () => {
  const corePages = [
    ["index.html", "/"],
    ["five-elements-love-compatibility/index.html", "/five-elements-love-compatibility/"],
    ["how-it-works/index.html", "/how-it-works/"],
  ];

  for (const [relativePath, expectedPath] of corePages) {
    const html = read(relativePath);
    const currentLinks = [...html.matchAll(/<a\b([^>]*\baria-current=["']page["'][^>]*)>/gi)];

    assert.equal(currentLinks.length, 1, `${relativePath} must identify one current-page link`);
    const href = firstMatch(currentLinks[0][1], /\bhref=["']([^"']+)["']/i, `${relativePath} current-page href`);
    assert.equal(new URL(href, origin).pathname, expectedPath, `${relativePath} current-page link must match its route`);
  }
});

test("core acquisition pages keep complete social preview metadata", () => {
  const corePages = [
    ["index.html", "website"],
    ["five-elements-love-compatibility/index.html", "article"],
    ["how-it-works/index.html", "article"],
  ];

  for (const [relativePath, expectedType] of corePages) {
    const html = read(relativePath);
    const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, `${relativePath} canonical`);
    const ogType = uniqueMetaContent(html, "property", "og:type", `${relativePath} og:type`);
    const ogLocale = uniqueMetaContent(html, "property", "og:locale", `${relativePath} og:locale`);
    const ogSiteName = uniqueMetaContent(html, "property", "og:site_name", `${relativePath} og:site_name`);
    const ogTitle = uniqueMetaContent(html, "property", "og:title", `${relativePath} og:title`);
    const ogDescription = uniqueMetaContent(html, "property", "og:description", `${relativePath} og:description`);
    const ogUrl = uniqueMetaContent(html, "property", "og:url", `${relativePath} og:url`);
    const ogImage = uniqueMetaContent(html, "property", "og:image", `${relativePath} og:image`);
    const ogImageWidth = uniqueMetaContent(html, "property", "og:image:width", `${relativePath} og:image:width`);
    const ogImageHeight = uniqueMetaContent(html, "property", "og:image:height", `${relativePath} og:image:height`);
    const ogImageAlt = uniqueMetaContent(html, "property", "og:image:alt", `${relativePath} og:image:alt`);
    const twitterCard = uniqueMetaContent(html, "name", "twitter:card", `${relativePath} twitter:card`);
    const twitterTitle = uniqueMetaContent(html, "name", "twitter:title", `${relativePath} twitter:title`);
    const twitterDescription = uniqueMetaContent(html, "name", "twitter:description", `${relativePath} twitter:description`);
    const twitterImage = uniqueMetaContent(html, "name", "twitter:image", `${relativePath} twitter:image`);
    const twitterImageAlt = uniqueMetaContent(html, "name", "twitter:image:alt", `${relativePath} twitter:image:alt`);

    assert.equal(ogType, expectedType, `${relativePath} Open Graph type must match its page role`);
    assert.equal(ogLocale, "en_US", `${relativePath} Open Graph locale must match the English-market site`);
    assert.equal(ogSiteName, "Your Love Element", `${relativePath} Open Graph site name must stay stable`);
    assert.equal(ogUrl, canonical, `${relativePath} Open Graph URL must match canonical`);
    assert.equal(ogImage, `${origin}/assets/social-preview.png`, `${relativePath} must use the production social preview asset`);
    assert.equal(ogImageWidth, "1200", `${relativePath} Open Graph image width must remain explicit`);
    assert.equal(ogImageHeight, "630", `${relativePath} Open Graph image height must remain explicit`);
    assert.equal(twitterCard, "summary_large_image", `${relativePath} must request a large Twitter preview`);
    assert.equal(twitterTitle, ogTitle, `${relativePath} social preview titles must agree`);
    assert.equal(twitterImage, ogImage, `${relativePath} social preview images must agree`);
    assert.equal(twitterImageAlt, ogImageAlt, `${relativePath} social preview image alternatives must agree`);
    assert.ok(ogDescription, `${relativePath} Open Graph description must not be empty`);
    assert.ok(twitterDescription, `${relativePath} Twitter description must not be empty`);
  }
});

test("social preview asset matches its declared format, dimensions, and transfer budget", () => {
  const assetPath = resolve(root, "assets/social-preview.png");
  const asset = readFileSync(assetPath);

  assert.ok(asset.length >= 24, "Social preview asset must contain a complete PNG header");
  assert.deepEqual(
    [...asset.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    "Social preview asset must remain a PNG",
  );
  assert.equal(asset.toString("ascii", 12, 16), "IHDR", "Social preview asset must start with an IHDR chunk");
  assert.equal(asset.readUInt32BE(16), 1200, "Social preview asset width must match Open Graph metadata");
  assert.equal(asset.readUInt32BE(20), 630, "Social preview asset height must match Open Graph metadata");
  assert.ok(statSync(assetPath).size <= 200_000, "Social preview asset must stay within a 200 KB transfer budget");
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

test("wildcard robots rules never block the whole site", () => {
  assert.equal(wildcardRobotsDisallowsRoot(read("robots.txt")), false);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: *\nDisallow: /"), true);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: Googlebot\nDisallow: /"), false);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: *\nDisallow: /private/"), false);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: *\nDisallow: / # block all"), true);
});

test("core acquisition freshness signals agree with sitemap", () => {
  const sitemap = read("sitemap.xml");
  const sitemapDates = new Map(
    [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g)]
      .map((match) => [match[1], match[2]]),
  );
  const pages = [
    ["index.html", ["WebPage"]],
    ["five-elements-love-compatibility/index.html", ["WebPage", "Article"]],
    ["how-it-works/index.html", ["WebPage", "Article"]],
  ];

  for (const [relativePath, structuredTypes] of pages) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    const sitemapDate = sitemapDates.get(canonical);

    assert.ok(sitemapDate, `${relativePath} must have a sitemap lastmod value`);
    for (const type of structuredTypes) {
      const item = structuredItem(html, type, relativePath);
      assert.equal(
        item.dateModified,
        sitemapDate,
        `${relativePath} ${type} dateModified must match sitemap lastmod`,
      );
    }
  }
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

test("core schema graphs keep canonical entity references connected", () => {
  const homepage = read("index.html");
  const homepageCanonical = firstMatch(
    homepage,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    "homepage canonical",
  );
  const organization = structuredItem(homepage, "Organization", "index.html");
  const website = structuredItem(homepage, "WebSite", "index.html");
  const webpage = structuredItem(homepage, "WebPage", "index.html");
  const product = structuredItem(homepage, "Product", "index.html");
  const faq = structuredItem(homepage, "FAQPage", "index.html");

  assert.equal(organization["@id"], `${homepageCanonical}#organization`);
  assert.equal(organization.url, homepageCanonical);
  assert.equal(website["@id"], `${homepageCanonical}#website`);
  assert.equal(website.url, homepageCanonical);
  assert.equal(website.publisher?.["@id"], organization["@id"]);
  assert.equal(webpage["@id"], `${homepageCanonical}#webpage`);
  assert.equal(webpage.url, homepageCanonical);
  assert.equal(webpage.isPartOf?.["@id"], website["@id"]);
  assert.equal(product["@id"], `${homepageCanonical}#full-report`);
  assert.equal(product.brand?.["@id"], organization["@id"]);
  assert.equal(product.offers?.url, `${homepageCanonical}#preview`);
  assert.equal(faq["@id"], `${homepageCanonical}#faq`);

  for (const relativePath of ["five-elements-love-compatibility/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    const editorialPage = structuredItem(html, "WebPage", relativePath);
    const article = structuredItem(html, "Article", relativePath);

    assert.equal(editorialPage["@id"], `${canonical}#webpage`);
    assert.equal(editorialPage.url, canonical);
    assert.equal(editorialPage.isPartOf?.["@id"], website["@id"]);
    assert.equal(article["@id"], `${canonical}#article`);
    assert.equal(article.mainEntityOfPage?.["@id"], editorialPage["@id"]);
    assert.equal(article.author?.["@id"], organization["@id"]);
    assert.equal(article.publisher?.["@id"], organization["@id"]);
  }
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

test("free quiz announces automatic step changes without changing its visual progress bar", () => {
  const html = read("index.html");

  assert.match(
    html,
    /<div[^>]+class=["']quiz-topline["'][^>]+role=["']status["'][^>]+aria-live=["']polite["'][^>]+aria-atomic=["']true["'][^>]*>/i,
  );
  assert.equal((html.match(/class=["']quiz-topline["']/gi) || []).length, 1, "The quiz must expose one step-announcement region");
  assert.match(html, /<div[^>]+class=["']progress["'][^>]+aria-hidden=["']true["']/i);
});

test("free quiz exposes its no-email helper as the form description", () => {
  const html = read("index.html");

  assert.match(html, /<form[^>]+id=["']reading["'][^>]+aria-describedby=["']quizHelper["'][^>]*>/i);
  assert.match(
    html,
    /<p[^>]+class=["']quiz-helper["'][^>]+id=["']quizHelper["'][^>]*>\s*Your answers shape the preview before any checkout or email field appears\.\s*<\/p>/i,
  );
  assert.equal((html.match(/\bid=["']quizHelper["']/gi) || []).length, 1, "The quiz helper id must be unique");
});

test("free quiz advances through one guarded form submit path", () => {
  const html = read("index.html");
  const script = read("script.js");

  assert.match(html, /<button[^>]+id=["']nextButton["'][^>]+type=["']submit["'][^>]*>/i);
  assert.match(
    script,
    /form\?\.addEventListener\(["']submit["'],\s*\(event\)\s*=>\s*\{\s*event\.preventDefault\(\);\s*window\.clearTimeout\(autoAdvanceTimer\);\s*advanceFreeQuiz\(["']continue["']\);\s*\}\);/i,
  );
  assert.match(script, /form\?\.addEventListener\(["']keydown["'],\s*\(event\)\s*=>/i);
  assert.match(script, /event\.key !== ["']Enter["'] \|\| event\.target !== form\.elements\.day/i);
  assert.match(script, /event\.preventDefault\(\);\s*form\.requestSubmit\(nextButton\);/i);
  assert.doesNotMatch(script, /(?:^|\n)\s*nextButton\.addEventListener\(["']click["']/i);
});

test("free quiz focuses the unresolved control after validation failure", () => {
  const script = read("script.js");

  assert.match(script, /function focusInvalidControl\(step, form\)/);
  assert.match(script, /step\?\.querySelector\(["']\.date-grid["']\)/);
  assert.match(script, /monthField\?\.value\s*\?\s*dayField\s*:\s*monthField/);
  assert.match(script, /step\?\.querySelector\(["']input\[type=[\\"']radio[\\"']\], input, select["']\)/);
  assert.match(script, /control\?\.focus\(\{ preventScroll: true \}\)/);
  assert.equal((script.match(/focusInvalidControl\(step, form\);/g) || []).length, 2);
});

test("free quiz exposes and clears control-level validation semantics", () => {
  const script = read("script.js");

  assert.match(script, /function setControlValidation\(step, target, invalidControls\)/);
  assert.match(script, /control\.setAttribute\(["']aria-invalid["'], ["']true["']\)/);
  assert.match(script, /descriptionIds\.add\(target\.id\)/);
  assert.match(script, /control\.setAttribute\(["']aria-describedby["'], \[\.\.\.descriptionIds\]\.join\(["'] ["']\)\)/);
  assert.match(script, /control\.removeAttribute\(["']aria-invalid["']\)/);
  assert.match(script, /descriptionIds\.delete\(target\.id\)/);
  assert.match(script, /if \(invalidControls\.length\) \{\s*setControlValidation\(step, target, invalidControls\);\s*\}/);
  assert.match(script, /function validateStep\(step, target, form, exposeControlValidation = false\)/);
  assert.match(script, /const invalidControl = form\?\.elements\?\.month\?\.value \? form\?\.elements\?\.day : form\?\.elements\?\.month/);
  assert.match(script, /exposeControlValidation \? \[invalidControl\] : \[\]/);
  assert.match(script, /exposeControlValidation \? \[\.\.\.step\.querySelectorAll\(["']input\[type=[\\"']radio[\\"']\]["']\)\] : \[\]/);
  assert.equal((script.match(/validateStep\([^\n]+quizValidation[^\n]+true\)/g) || []).length, 2);
  assert.doesNotMatch(script, /validateStep\([^\n]+paidValidation[^\n]+true\)/);
});

test("free quiz returns keyboard focus to the selected previous answer", () => {
  const script = read("script.js");

  assert.match(script, /function focusStepAnswer\(step\)/);
  assert.match(script, /step\?\.querySelector\(["']input:checked["']\)/);
  assert.match(script, /step\?\.querySelector\(["']input, select["']\)/);
  assert.match(script, /control\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    script,
    /backButton\.addEventListener\(["']click["'],\s*\(\)\s*=>\s*\{[\s\S]*?currentStep -= 1;\s*updateStep\(\);\s*focusStepAnswer\(steps\[currentStep\]\);/i,
  );
});

test("auto-advancing quiz keeps keyboard focus in the active question", () => {
  const script = read("script.js");

  assert.match(
    script,
    /currentStep \+= 1;\s*updateStep\(\);\s*focusStepAnswer\(steps\[currentStep\]\);\s*return;/i,
  );
});

test("manual forward quiz navigation shares the active-question focus path", () => {
  const script = read("script.js");

  assert.doesNotMatch(script, /if \(trigger === ["']answer_tap["']\)/i);
  assert.equal((script.match(/focusStepAnswer\(steps\[currentStep\]\);/g) || []).length, 2);
});

test("revealed preview receives a programmatic heading focus target", () => {
  const html = read("index.html");
  const script = read("script.js");

  assert.match(html, /<h2[^>]+id=["']previewTitle["'][^>]+tabindex=["']-1["'][^>]*>/i);
  assert.match(
    script,
    /document\.querySelector\(["']#preview["']\)\.scrollIntoView\([^;]+;\s*window\.requestAnimationFrame\(\(\)\s*=>\s*\{\s*previewTitle\?\.focus\(\{\s*preventScroll:\s*true\s*\}\);\s*\}\);/i,
  );
});

test("shared styles honor the operating-system reduced-motion preference", () => {
  const styles = read("styles.css");
  const rule = firstMatch(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/i,
    "reduced-motion media rule",
  );

  assert.match(rule, /html\s*\{[\s\S]*?scroll-behavior:\s*auto;/i);
  assert.match(rule, /\*::before[\s\S]*?\*::after[\s\S]*?animation-duration:\s*0\.01ms\s*!important;/i);
  assert.match(rule, /animation-iteration-count:\s*1\s*!important;/i);
  assert.match(rule, /transition-delay:\s*0ms\s*!important;/i);
  assert.match(rule, /transition-duration:\s*0\.01ms\s*!important;/i);
});

test("free-quiz radio focus is visible across the full option card", () => {
  const styles = read("styles.css");

  assert.match(
    styles,
    /\.quiz-step\s+label:has\(input:focus-visible\)\s*\{[\s\S]*?outline:\s*3px\s+solid\s+rgba\(198,\s*155,\s*71,\s*0\.72\);[\s\S]*?outline-offset:\s*3px;[\s\S]*?box-shadow:\s*0\s+0\s+0\s+3px\s+rgba\(255,\s*250,\s*242,\s*0\.9\),\s*0\s+10px\s+24px\s+rgba\(34,\s*27,\s*24,\s*0\.08\);[\s\S]*?\}/i,
  );
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

test("share actions announce asynchronous feedback", () => {
  const html = read("index.html");

  assert.match(
    html,
    /<p[^>]+class=["']share-status["'][^>]+id=["']shareStatus["'][^>]+role=["']status["'][^>]+aria-live=["']polite["'][^>]+aria-atomic=["']true["'][^>]+hidden[^>]*><\/p>/i,
  );
  assert.equal((html.match(/\bid=["']shareStatus["']/gi) || []).length, 1, "Share feedback must expose one status region");
});

test("homepage serves an optimized, layout-stable hero image", () => {
  const html = read("index.html");
  const sitemap = read("sitemap.xml");
  const optimizedAsset = resolve(root, "assets/hero-soulmate-report.webp");
  const structuredData = JSON.stringify(jsonLdBlocks(html));
  const heroPreloads = html.match(/<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']assets\/hero-soulmate-report\.webp["'][^>]+type=["']image\/webp["'][^>]+fetchpriority=["']high["'][^>]*>/gi) ?? [];

  assert.ok(statSync(optimizedAsset).size < 200_000, "Optimized hero image must stay below 200 KB");
  assert.equal(heroPreloads.length, 1, "Homepage must preload the hero WebP exactly once");
  assert.match(html, /<img[^>]+class=["']hero-image["'][^>]+src=["']assets\/hero-soulmate-report\.webp["'][^>]+width=["']1672["'][^>]+height=["']941["'][^>]+fetchpriority=["']high["'][^>]+decoding=["']async["']/i);
  assert.match(html, /<img[^>]+src=["']assets\/hero-soulmate-report\.webp["'][^>]+width=["']1672["'][^>]+height=["']941["'][^>]+loading=["']lazy["'][^>]+decoding=["']async["'][^>]+alt=["']A sample future partner portrait["']/i);
  assert.doesNotMatch(html, /src=["']assets\/hero-soulmate-report\.png["']/i);
  assert.match(structuredData, /https:\/\/yourloveelement\.com\/assets\/hero-soulmate-report\.webp/);
  assert.doesNotMatch(structuredData, /hero-soulmate-report\.png/);
  assert.match(sitemap, /xmlns:image=["']http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1["']/i);
  assert.match(sitemap, /<image:loc>https:\/\/yourloveelement\.com\/assets\/hero-soulmate-report\.webp<\/image:loc>/i);
});

test("below-fold report artwork is lazy and layout-stable", () => {
  const html = read("index.html");

  assert.match(html, /<img[^>]+src=["']assets\/elements\/earth-banner\.jpg["'][^>]+width=["']1440["'][^>]+height=["']810["'][^>]+loading=["']lazy["'][^>]+decoding=["']async["'][^>]+alt=["']Earth element relationship report banner sample["']/i);
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
