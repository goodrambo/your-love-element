import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const contracts = JSON.parse(readFileSync(resolve(root, "harness/contracts.json"), "utf8"));
const origin = contracts.production.site_url;
const canonicalOrigin = new URL(origin);

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function firstMatch(html, expression, label) {
  const match = html.match(expression);
  assert.ok(match, `Missing ${label}`);
  return match[1].trim();
}

function uniqueMetaContent(html, attribute, value, label) {
  const matches = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => ({
      key: decodeHtmlAttributeReferences(htmlAttributeValue(tag, attribute) || "").toLowerCase(),
      content: htmlAttributeValue(tag, "content"),
    }))
    .filter(({ key }) => key === value.toLowerCase());
  assert.equal(matches.length, 1, `${label} must appear exactly once`);
  assert.notEqual(matches[0].content, null, `${label} must declare content`);
  return decodeHtmlAttributeReferences(matches[0].content).trim();
}

function uniqueElementText(html, tag, label) {
  const matches = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([^<]+)<\\/${tag}>`, "gi"))];
  assert.equal(matches.length, 1, `${label} must appear exactly once`);
  return matches[0][1].trim();
}

function assertSearchSnippetLength(value, { minimum, maximum }, label) {
  const length = [...value].length;
  assert.ok(length >= minimum, `${label} must contain at least ${minimum} characters`);
  assert.ok(length <= maximum, `${label} must contain no more than ${maximum} characters`);
  assert.doesNotMatch(value, /[\u0000-\u001f\u007f]/, `${label} must not contain control characters`);
  return length;
}

function uniqueLinkHref(html, rel, label) {
  const matches = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => ({
      href: htmlAttributeValue(tag, "href"),
      relTokens: decodeHtmlAttributeReferences(htmlAttributeValue(tag, "rel") || "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    }))
    .filter(({ relTokens }) => relTokens.includes(rel.toLowerCase()));
  assert.equal(matches.length, 1, `${label} must appear exactly once`);
  assert.ok(matches[0].href, `${label} must declare an href`);
  return decodeHtmlAttributeReferences(matches[0].href).trim();
}

function uniqueHeadContent(html, label) {
  const matches = [...html.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head>/gi)];
  assert.equal(matches.length, 1, `${label} must expose exactly one head`);
  return matches[0][1];
}

function validIsoCalendarDay(value, label) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  assert.equal(
    new Date(timestamp).toISOString().slice(0, 10),
    value,
    `${label} must be a valid calendar date`,
  );
  return timestamp;
}

function validSitemapLastmod(value, label, today = new Date().toISOString().slice(0, 10)) {
  const timestamp = validIsoCalendarDay(value, label);
  const todayTimestamp = validIsoCalendarDay(today, "current UTC date");
  assert.ok(timestamp <= todayTimestamp, `${label} must not be future-dated`);
  return timestamp;
}

function quotedAttributeValue(markup, name) {
  const match = markup.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function assertExplicitImageAlternative(markup, label) {
  const alt = quotedAttributeValue(markup, "alt");
  assert.notEqual(alt, null, `${label} must declare an alt attribute`);
  if (alt.trim()) return;

  const role = quotedAttributeValue(markup, "role")?.trim().toLowerCase();
  const ariaHidden = quotedAttributeValue(markup, "aria-hidden")?.trim().toLowerCase();
  assert.ok(
    role === "presentation" || ariaHidden === "true",
    `${label} with empty alt must be explicitly decorative`,
  );
}

function englishDocumentLanguage(html, label) {
  const roots = [...html.matchAll(/<html\b[^>]*>/gi)];
  assert.equal(roots.length, 1, `${label} must expose exactly one html root`);

  const language = quotedAttributeValue(roots[0][0], "lang")?.trim();
  assert.ok(language, `${label} must declare a document language`);
  assert.match(language, /^en(?:-[a-z]{2})?$/i, `${label} must declare an English document language`);
  return language.toLowerCase();
}

function uniqueCharsetDeclaration(html, label) {
  const matches = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => ({
      endIndex: match.index + match[0].length,
      value: htmlAttributeValue(match[0], "charset"),
    }))
    .filter(({ value }) => value !== null);
  assert.equal(matches.length, 1, `${label} must declare exactly one charset`);

  const charset = decodeHtmlAttributeReferences(matches[0].value).trim().toLowerCase();
  assert.equal(charset, "utf-8", `${label} charset must be UTF-8`);
  return { charset, endIndex: matches[0].endIndex };
}

function uniqueUtf8Charset(html, label) {
  return uniqueCharsetDeclaration(html, label).charset;
}

function earlyUtf8CharsetEndByte(html, label) {
  const { endIndex } = uniqueCharsetDeclaration(html, label);
  const endByte = Buffer.byteLength(html.slice(0, endIndex), "utf8");
  assert.ok(endByte <= 1024, `${label} charset must end within the first 1024 bytes`);
  return endByte;
}

function responsiveViewportDirectives(html, label) {
  const matches = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => ({
      content: htmlAttributeValue(tag, "content"),
      name: decodeHtmlAttributeReferences(htmlAttributeValue(tag, "name") || "").toLowerCase(),
    }))
    .filter(({ name }) => name === "viewport");
  assert.equal(matches.length, 1, `${label} must declare exactly one viewport`);
  assert.notEqual(matches[0].content, null, `${label} viewport must declare content`);

  const directives = decodeHtmlAttributeReferences(matches[0].content)
    .toLowerCase()
    .split(",")
    .map((directive) => directive.trim())
    .filter(Boolean);
  assert.ok(directives.includes("width=device-width"), `${label} viewport must use device width`);
  assert.equal(
    directives.filter((directive) => /^initial-scale=1(?:\.0+)?$/.test(directive)).length,
    1,
    `${label} viewport must declare an initial scale of 1`,
  );
  return new Set(directives);
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)]
    .filter(([, openingTag]) => (
      decodeHtmlAttributeReferences(htmlAttributeValue(openingTag, "type") || "")
        .trim()
        .toLowerCase() === "application/ld+json"
    ))
    .map(([, , payload]) => JSON.parse(payload));
}

function visitJsonObjects(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) visitJsonObjects(item, visitor);
    return;
  }
  if (!value || typeof value !== "object") return;

  visitor(value);
  for (const item of Object.values(value)) visitJsonObjects(item, visitor);
}

function auditSiteEntityGraph(pages, label) {
  const declaredIds = new Map();
  const referencedIds = new Set();

  for (const [relativePath, payloads] of pages) {
    for (const payload of payloads) {
      visitJsonObjects(payload, (item) => {
        const id = item["@id"];
        if (typeof id !== "string") return;

        const parsed = new URL(id);
        const isSiteIdentifier =
          parsed.hostname === canonicalOrigin.hostname ||
          parsed.hostname === `www.${canonicalOrigin.hostname}`;
        if (!isSiteIdentifier) return;

        assert.equal(parsed.origin, canonicalOrigin.origin, `${relativePath} internal @id must use the canonical HTTPS origin`);
        assert.equal(parsed.search, "", `${relativePath} internal @id must not include query parameters`);
        assert.ok(parsed.hash, `${relativePath} internal @id must identify a stable entity fragment`);
        referencedIds.add(id);

        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (!types.some(Boolean)) return;

        assert.equal(
          declaredIds.has(id),
          false,
          `${label} must declare each internal @id exactly once: ${id}`,
        );
        declaredIds.set(id, relativePath);
      });
    }
  }

  for (const id of referencedIds) {
    assert.ok(declaredIds.has(id), `${label} internal @id reference must resolve to a declared entity: ${id}`);
  }

  return { declaredIds, referencedIds };
}

function auditStructuredDataSiteUrls(payloads, label) {
  const siteUrlFields = new Set(["url", "image", "logo", "item", "contentUrl"]);
  let checkedUrls = 0;

  for (const payload of payloads) {
    visitJsonObjects(payload, (item) => {
      for (const [field, value] of Object.entries(item)) {
        if (!siteUrlFields.has(field)) continue;

        const urlValues = Array.isArray(value) ? value : [value];
        for (const urlValue of urlValues) {
          if (urlValue && typeof urlValue === "object") continue;
          assert.equal(
            typeof urlValue,
            "string",
            `${label} ${field} must be a string URL or structured object`,
          );

          let parsed;
          assert.doesNotThrow(() => {
            parsed = new URL(urlValue);
          }, `${label} ${field} must be an absolute URL: ${urlValue}`);
          assert.ok(
            parsed.protocol === "http:" || parsed.protocol === "https:",
            `${label} ${field} must use HTTP or HTTPS: ${urlValue}`,
          );

          const isSiteHost = parsed.hostname === canonicalOrigin.hostname
            || parsed.hostname === `www.${canonicalOrigin.hostname}`;
          if (!isSiteHost) continue;

          checkedUrls += 1;
          assert.equal(parsed.username, "", `${label} ${field} must not embed a username: ${urlValue}`);
          assert.equal(parsed.password, "", `${label} ${field} must not embed a password: ${urlValue}`);
          assert.equal(parsed.origin, canonicalOrigin.origin, `${label} ${field} must use the canonical HTTPS origin: ${urlValue}`);
          assert.equal(parsed.search, "", `${label} ${field} must not create a query variant: ${urlValue}`);
          if (field === "image" || field === "logo" || field === "contentUrl") {
            assert.equal(parsed.hash, "", `${label} ${field} must not include a fragment: ${urlValue}`);
          }
        }
      }
    });
  }

  assert.ok(checkedUrls > 0, `${label} must cover at least one structured-data site URL`);
  return checkedUrls;
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

function semanticTerms(text) {
  return new Set(
    plainText(text)
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((term) => term.length > 2) ?? [],
  );
}

function semanticOverlap(left, right) {
  const leftTerms = semanticTerms(left);
  const rightTerms = semanticTerms(right);
  const union = new Set([...leftTerms, ...rightTerms]);
  if (union.size === 0) return 0;

  return [...leftTerms].filter((term) => rightTerms.has(term)).length / union.size;
}

function assertFaqSchemaIsVisiblyGrounded(structured, visible, relativePath) {
  assert.ok(structured.length > 0, `${relativePath} FAQ schema must expose at least one answer`);
  assert.ok(
    visible.length >= structured.length,
    `${relativePath} FAQ schema must not expose questions that are hidden from the page`,
  );

  structured.forEach((entry, index) => {
    const visibleEntry = visible[index];
    assert.ok(entry.question.trim(), `${relativePath} FAQ schema question ${index + 1} must not be empty`);
    assert.ok(entry.answer.trim(), `${relativePath} FAQ schema answer ${index + 1} must not be empty`);
    assert.ok(
      semanticOverlap(entry.answer, visibleEntry.answer) >= 0.4,
      `${relativePath} FAQ schema answer ${index + 1} must remain semantically grounded in its visible answer`,
    );
  });
}

function structuredItem(html, type, relativePath) {
  const matches = jsonLdBlocks(html)
    .flatMap((payload) => payload["@graph"] || [payload])
    .filter((item) => item["@type"] === type);

  assert.equal(matches.length, 1, `${relativePath} must include exactly one ${type} JSON-LD item`);
  return matches[0];
}

function productOfferSignals(html, label) {
  const product = structuredItem(html, "Product", label);
  const offer = product.offers;

  assert.equal(offer?.["@type"], "Offer", `${label} Product must expose one Offer`);
  assert.match(offer.price, /^\d+\.\d{2}$/, `${label} Offer price must use two decimal places`);
  assert.ok(Number(offer.price) > 0, `${label} Offer price must stay above zero`);
  assert.equal(offer.priceCurrency, "USD", `${label} Offer must use USD`);
  assert.equal(offer.availability, "https://schema.org/InStock", `${label} Offer must stay available`);
  return offer;
}

function htmlAttributeValue(element, name) {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = element.match(expression);
  return match?.slice(1).find((value) => value !== undefined) ?? null;
}

function decodeHtmlAttributeReferences(value) {
  const namedReferences = new Map([
    ["comma", ","],
    ["colon", ":"],
    ["Tab", "\t"],
    ["NewLine", "\n"],
    ["nbsp", "\u00a0"],
  ]);

  return value.replace(
    /&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));?|&(comma|colon|Tab|NewLine|nbsp);/g,
    (reference, hex, decimal, named) => {
      if (named) return namedReferences.get(named);

      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      if (
        !Number.isInteger(codePoint)
        || codePoint < 1
        || codePoint > 0x10ffff
        || (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) return reference;
      return String.fromCodePoint(codePoint);
    },
  );
}

function anchorElementsWithHref(html) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)]
    .map(([anchor]) => ({ anchor, href: htmlAttributeValue(anchor, "href") }))
    .filter((entry) => entry.href !== null);
}

function searchResultFavicon(html, documentUrl, label) {
  const icons = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([link]) => ({
      href: htmlAttributeValue(link, "href"),
      rel: htmlAttributeValue(link, "rel"),
      type: htmlAttributeValue(link, "type"),
    }))
    .filter(({ rel }) => rel?.toLowerCase().split(/\s+/).includes("icon"));

  assert.equal(icons.length, 1, `${label} must expose exactly one search-result favicon`);
  assert.equal(icons[0].type?.toLowerCase(), "image/svg+xml", `${label} favicon must declare the SVG MIME type`);
  assert.ok(icons[0].href, `${label} favicon must declare an href`);

  const favicon = new URL(icons[0].href, documentUrl);
  assert.equal(favicon.username, "", `${label} favicon must not embed a username`);
  assert.equal(favicon.password, "", `${label} favicon must not embed a password`);
  assert.equal(favicon.origin, canonicalOrigin.origin, `${label} favicon must use the canonical HTTPS origin`);
  assert.equal(favicon.pathname, "/assets/logo-mark.svg", `${label} favicon must use the stable logo-mark asset`);
  assert.equal(favicon.search, "", `${label} favicon must not create a query variant`);
  assert.equal(favicon.hash, "", `${label} favicon must not include a fragment`);
  return favicon;
}

function squareSvgViewBox(svg, label) {
  const match = svg.match(/<svg\b[^>]*\bviewBox=["']([^"']+)["'][^>]*>/i);
  assert.ok(match, `${label} must declare an SVG viewBox`);
  const values = match[1].trim().split(/\s+/).map(Number);
  assert.equal(values.length, 4, `${label} viewBox must contain four numbers`);
  assert.ok(values.every(Number.isFinite), `${label} viewBox values must be finite numbers`);
  assert.ok(values[2] >= 48, `${label} viewBox must be at least 48 units wide`);
  assert.equal(values[2], values[3], `${label} viewBox must be square`);
  return values[2];
}

function isFollowableAnchor(anchor) {
  const rel = htmlAttributeValue(anchor, "rel") || "";
  const relTokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
  const downloads = /\bdownload(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|>)/i.test(anchor);
  return !relTokens.has("nofollow") && !downloads;
}

function descriptiveAnchorText(anchor) {
  const inner = anchor.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "";
  const imageAlternatives = [...inner.matchAll(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi)]
    .map((match) => match[1]);
  return plainText(`${inner} ${imageAlternatives.join(" ")}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasDescriptiveAnchorText(anchor) {
  const text = descriptiveAnchorText(anchor);
  if (!text) return false;
  return !new Set(["click here", "continue", "details", "here", "learn more", "link", "more", "read more"])
    .has(text);
}

function assertCanonicalInternalAnchorTargets(html, sourceCanonical, canonicalPaths, label) {
  let checkedLinks = 0;

  for (const { anchor, href } of anchorElementsWithHref(html)) {
    if (!isFollowableAnchor(anchor)) continue;

    const targetUrl = new URL(href, sourceCanonical);
    const isCanonicalHostAlias = targetUrl.hostname === canonicalOrigin.hostname
      || targetUrl.hostname === `www.${canonicalOrigin.hostname}`;
    if (!isCanonicalHostAlias) continue;

    assert.ok(
      !targetUrl.username && !targetUrl.password,
      `${label} followable internal link must not embed URL credentials: ${href}`,
    );
    assert.equal(
      targetUrl.origin,
      canonicalOrigin.origin,
      `${label} followable internal link must use canonical HTTPS origin: ${href}`,
    );

    checkedLinks += 1;
    assert.ok(
      canonicalPaths.has(targetUrl.pathname),
      `${label} followable internal link must target a configured canonical route: ${href}`,
    );
    assert.equal(targetUrl.search, "", `${label} followable internal link must not create a query variant: ${href}`);
  }

  return checkedLinks;
}

function canonicalRobotsSitemapUrl(robots, label) {
  const sitemapUrls = robots
    .split(/\r?\n/)
    .map((rawLine) => rawLine.split("#", 1)[0].trim())
    .map((line) => line.match(/^sitemap\s*:\s*(\S+)\s*$/i)?.[1] ?? null)
    .filter((url) => url !== null);

  assert.equal(sitemapUrls.length, 1, `${label} must expose exactly one Sitemap directive`);
  const sitemapUrl = new URL(sitemapUrls[0]);
  assert.equal(sitemapUrl.origin, canonicalOrigin.origin, `${label} Sitemap must use the canonical HTTPS origin`);
  assert.equal(sitemapUrl.pathname, "/sitemap.xml", `${label} Sitemap must use the canonical sitemap path`);
  assert.equal(sitemapUrl.search, "", `${label} Sitemap must not create a query variant`);
  assert.equal(sitemapUrl.hash, "", `${label} Sitemap must not include a fragment`);
  return sitemapUrl.href;
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

function robotsGroups(robots) {
  const groups = [];
  let agents = [];
  let rules = [];

  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;

    const directive = line.match(/^([^:]+):\s*(.*)$/);
    if (!directive) continue;

    const name = directive[1].trim().toLowerCase();
    const value = directive[2].trim();
    if (name === "user-agent") {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
      continue;
    }
    if (!agents.length || !["allow", "disallow"].includes(name)) continue;
    rules.push({ allow: name === "allow", pattern: value });
  }
  flush();
  return groups;
}

function robotsPatternMatch(pattern, path) {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

function robotsAllowsPath(robots, crawler, path) {
  const crawlerName = crawler.toLowerCase();
  const matchingGroups = robotsGroups(robots)
    .map((group) => ({
      ...group,
      specificity: Math.max(...group.agents
        .filter((agent) => agent === "*" || crawlerName.includes(agent))
        .map((agent) => agent === "*" ? 0 : agent.length), -1),
    }))
    .filter((group) => group.specificity >= 0);
  if (!matchingGroups.length) return true;

  const bestAgentSpecificity = Math.max(...matchingGroups.map((group) => group.specificity));
  const matchingRules = matchingGroups
    .filter((group) => group.specificity === bestAgentSpecificity)
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPatternMatch(rule.pattern, path))
    .map((rule) => ({
      ...rule,
      specificity: rule.pattern.replace(/\*/g, "").replace(/\$$/, "").length,
    }));
  if (!matchingRules.length) return true;

  const bestRuleSpecificity = Math.max(...matchingRules.map((rule) => rule.specificity));
  return matchingRules
    .filter((rule) => rule.specificity === bestRuleSpecificity)
    .some((rule) => rule.allow);
}

function assertSitemapPathsAllowed(robots, sitemap, crawlers, label) {
  const entries = sitemapUrlEntries(sitemap, `${label} sitemap`);
  let checkedPaths = 0;

  for (const crawler of crawlers) {
    for (const entry of entries) {
      const path = new URL(entry.loc).pathname;
      checkedPaths += 1;
      assert.ok(
        robotsAllowsPath(robots, crawler, path),
        `${label} must allow ${crawler} to crawl sitemap path ${path}`,
      );
    }
  }
  return checkedPaths;
}

function crawlerMetaDirectives(html, crawlerName, displayName, label) {
  const matches = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => ({
      content: decodeHtmlAttributeReferences(htmlAttributeValue(tag, "content") || ""),
      name: decodeHtmlAttributeReferences(htmlAttributeValue(tag, "name") || "").toLowerCase(),
    }))
    .filter(({ name }) => name === crawlerName);

  assert.ok(matches.length <= 1, `${label} must not expose duplicate ${displayName} meta directives`);
  return new Set(
    matches[0]?.content
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean) || [],
  );
}

function robotsMetaDirectives(html, label) {
  return crawlerMetaDirectives(html, "robots", "robots", label);
}

function googlebotMetaDirectives(html, label) {
  return crawlerMetaDirectives(html, "googlebot", "Googlebot", label);
}

function crawlerDirectivesInHead(html, label) {
  const head = uniqueHeadContent(html, label);
  const headRobots = robotsMetaDirectives(head, `${label} head`);
  const headGooglebot = googlebotMetaDirectives(head, `${label} head`);

  assert.deepEqual(
    [...headRobots].sort(),
    [...robotsMetaDirectives(html, label)].sort(),
    `${label} robots meta directives must stay inside head`,
  );
  assert.deepEqual(
    [...headGooglebot].sort(),
    [...googlebotMetaDirectives(html, label)].sort(),
    `${label} Googlebot meta directives must stay inside head`,
  );
  return { robots: headRobots, googlebot: headGooglebot };
}

function blocksIndexing(directives) {
  return directives.has("noindex") || directives.has("none");
}

function blocksFollowing(directives) {
  return directives.has("nofollow") || directives.has("none");
}

function blocksTextSnippets(directives) {
  return directives.has("nosnippet") || directives.has("max-snippet:0");
}

function expiresFromSearch(directives) {
  return [...directives].some((directive) => directive.startsWith("unavailable_after"));
}

function blocksImageIndexing(directives) {
  return directives.has("noimageindex");
}

function hasMetaRefreshRedirect(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) => (
    decodeHtmlAttributeReferences(htmlAttributeValue(tag, "http-equiv") || "")
      .trim()
      .toLowerCase() === "refresh"
  ));
}

function assertNoBaseElement(html, label) {
  const matches = [...html.matchAll(/<base\b[^>]*>/gi)];
  assert.equal(matches.length, 0, `${label} must not redefine or globally retarget document links`);
}

function assertHtml5Doctype(html, label) {
  const matches = [...html.matchAll(/<!doctype\b[^>]*>/gi)];
  assert.equal(matches.length, 1, `${label} must declare exactly one doctype`);
  assert.match(matches[0][0], /^<!doctype\s+html\s*>$/i, `${label} must use the HTML5 doctype`);

  const rootIndex = html.search(/<html\b/i);
  assert.ok(rootIndex >= 0, `${label} must expose an html root`);
  assert.ok(matches[0].index < rootIndex, `${label} doctype must precede the html root`);
}

function assertDocumentShell(html, label) {
  const htmlOpen = [...html.matchAll(/<html\b[^>]*>/gi)];
  const htmlClose = [...html.matchAll(/<\/html\s*>/gi)];
  const headOpen = [...html.matchAll(/<head\b[^>]*>/gi)];
  const headClose = [...html.matchAll(/<\/head\s*>/gi)];
  const bodyOpen = [...html.matchAll(/<body\b[^>]*>/gi)];
  const bodyClose = [...html.matchAll(/<\/body\s*>/gi)];

  for (const [name, matches] of Object.entries({
    "html opening tag": htmlOpen,
    "html closing tag": htmlClose,
    "head opening tag": headOpen,
    "head closing tag": headClose,
    "body opening tag": bodyOpen,
    "body closing tag": bodyClose,
  })) {
    assert.equal(matches.length, 1, `${label} must expose exactly one ${name}`);
  }

  assert.ok(htmlOpen[0].index < headOpen[0].index, `${label} head must be inside the html root`);
  assert.ok(headOpen[0].index < headClose[0].index, `${label} head must close after it opens`);
  assert.ok(headClose[0].index < bodyOpen[0].index, `${label} head must precede body`);
  assert.ok(bodyOpen[0].index < bodyClose[0].index, `${label} body must close after it opens`);
  assert.ok(bodyClose[0].index < htmlClose[0].index, `${label} body must be inside the html root`);
}

function expectedCanonicalPath(relativePath) {
  if (relativePath === "index.html") return "/";
  assert.ok(relativePath.endsWith("/index.html"), `${relativePath} must use an index.html route`);
  return `/${relativePath.slice(0, -"/index.html".length)}/`;
}

function sitemapUrlEntries(xml, label) {
  const roots = [...xml.matchAll(/<urlset\b([^>]*)>([\s\S]*?)<\/urlset>/gi)];
  assert.equal(roots.length, 1, `${label} must expose exactly one urlset`);
  assert.match(
    roots[0][1],
    /\bxmlns\s*=\s*["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i,
    `${label} must use the standard sitemap namespace`,
  );

  const entries = [...roots[0][2].matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)];
  assert.ok(entries.length > 0, `${label} must expose at least one url entry`);

  return entries.map((match, index) => {
    const entryLabel = `${label} url entry ${index + 1}`;
    const locations = [...match[1].matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)];
    const modified = [...match[1].matchAll(/<lastmod\b[^>]*>([^<]+)<\/lastmod>/gi)];

    assert.equal(locations.length, 1, `${entryLabel} must expose exactly one crawl target`);
    assert.ok(modified.length <= 1, `${entryLabel} must expose at most one lastmod`);
    if (modified.length) {
      assert.match(modified[0][1], /^\d{4}-\d{2}-\d{2}$/, `${entryLabel} lastmod must use YYYY-MM-DD`);
    }

    return {
      loc: locations[0][1],
      lastmod: modified[0]?.[1] ?? null,
    };
  });
}

function assertCompressedHtmlBudget(html, label, maximumBytes) {
  const compressedBytes = gzipSync(Buffer.from(html, "utf8"), { level: 9 }).byteLength;
  assert.ok(
    compressedBytes <= maximumBytes,
    `${label} must stay at or below ${maximumBytes} gzip bytes; received ${compressedBytes}`,
  );
  return compressedBytes;
}

function firstPartyCssAndScriptPaths(html, documentUrl, label) {
  const references = [
    ...[...html.matchAll(/<script\b(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*>/gi)].map((match) => match[1]),
    ...[...html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi)]
      .map((match) => match[1]),
  ];
  const paths = new Set();

  for (const reference of references) {
    const url = new URL(reference, documentUrl);
    if (url.origin !== origin) continue;
    const relativePath = url.pathname.replace(/^\/+/, "");
    assert.ok(relativePath, `${label} must not reference the site root as CSS or JavaScript`);
    paths.add(relativePath);
  }

  assert.ok(paths.size > 0, `${label} must load at least one first-party CSS or JavaScript resource`);
  return [...paths];
}

test("indexable pages have unique search metadata and sitemap entries", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const indexableCanonicals = new Set();
  const titles = new Set();
  const descriptions = new Set();

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const title = uniqueElementText(html, "title", `${relativePath} title`);
    const description = uniqueMetaContent(html, "name", "description", `${relativePath} description`);
    const canonical = uniqueLinkHref(html, "canonical", `${relativePath} canonical`);
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const noindex = blocksIndexing(robotsMetaDirectives(html, relativePath));

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

test("indexable search snippets keep useful bounded title and description lengths", () => {
  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    const title = uniqueElementText(html, "title", `${relativePath} title`);
    const description = uniqueMetaContent(html, "name", "description", `${relativePath} description`);
    assertSearchSnippetLength(title, { minimum: 20, maximum: 75 }, `${relativePath} title`);
    assertSearchSnippetLength(description, { minimum: 70, maximum: 170 }, `${relativePath} description`);
  }

  assert.throws(
    () => assertSearchSnippetLength("Too short", { minimum: 20, maximum: 75 }, "fixture title"),
    /at least 20 characters/,
  );
  assert.throws(
    () => assertSearchSnippetLength("x".repeat(171), { minimum: 70, maximum: 170 }, "fixture description"),
    /no more than 170 characters/,
  );
  assert.throws(
    () => assertSearchSnippetLength(`A useful title with a\nline break`, { minimum: 20, maximum: 75 }, "fixture title"),
    /must not contain control characters/,
  );
});

test("sitemap documents stay within the compressed HTML crawl budget", () => {
  const maximumBytes = 10 * 1024;
  const entries = sitemapUrlEntries(read("sitemap.xml"), "production sitemap");
  const documentPaths = entries.map(({ loc }) => {
    const url = new URL(loc);
    assert.equal(url.origin, origin, `${loc} must use the production origin`);
    const relativePath = url.pathname === "/" ? "index.html" : `${url.pathname.slice(1)}index.html`;
    assert.ok(contracts.html_files.includes(relativePath), `${loc} must resolve to a configured HTML document`);
    return relativePath;
  });

  assert.equal(documentPaths.length, 8, "Every submitted search document must have a transfer budget");
  for (const relativePath of documentPaths) {
    assertCompressedHtmlBudget(read(relativePath), relativePath, maximumBytes);
  }

  assert.throws(
    () => assertCompressedHtmlBudget("<!doctype html>" + "0123456789abcdef".repeat(32), "oversized fixture", 32),
    /oversized fixture must stay at or below 32 gzip bytes/,
  );
});

test("sitemap documents keep first-party CSS and JavaScript within a transfer budget", () => {
  const maximumBytes = 32 * 1024;
  const entries = sitemapUrlEntries(read("sitemap.xml"), "production sitemap");

  assert.equal(entries.length, 8, "Every submitted search document must have a resource budget");
  for (const { loc } of entries) {
    const documentUrl = new URL(loc);
    assert.equal(documentUrl.origin, origin, `${loc} must use the production origin`);
    const relativePath = documentUrl.pathname === "/" ? "index.html" : `${documentUrl.pathname.slice(1)}index.html`;
    const resourcePaths = firstPartyCssAndScriptPaths(read(relativePath), documentUrl, relativePath);
    const compressedBytes = resourcePaths.reduce((total, resourcePath) => {
      const payload = readFileSync(resolve(root, resourcePath));
      return total + gzipSync(payload, { level: 9 }).byteLength;
    }, 0);

    assert.ok(
      compressedBytes <= maximumBytes,
      `${relativePath} first-party CSS and JavaScript must stay at or below ${maximumBytes} gzip bytes; received ${compressedBytes}`,
    );
  }
});

test("search metadata rejects duplicate title and description directives", () => {
  assert.throws(
    () => uniqueElementText("<title>Primary</title><title>Conflicting</title>", "title", "fixture title"),
    /fixture title must appear exactly once/,
  );
  assert.throws(
    () => uniqueMetaContent(
      '<meta name="description" content="Primary"><meta name="description" content="Conflicting">',
      "name",
      "description",
      "fixture description",
    ),
    /fixture description must appear exactly once/,
  );
  assert.throws(
    () => uniqueMetaContent(
      '<meta name="description" content="Primary"><meta name=description content=Conflicting>',
      "name",
      "description",
      "unquoted fixture description",
    ),
    /unquoted fixture description must appear exactly once/,
  );
  assert.throws(
    () => uniqueMetaContent(
      '<meta name="description" content="Primary"><meta name=descr&#105;ption content=Conflicting>',
      "name",
      "description",
      "encoded fixture description",
    ),
    /encoded fixture description must appear exactly once/,
  );
  assert.equal(
    uniqueMetaContent('<meta content=Primary name=description>', "name", "description", "valid unquoted description"),
    "Primary",
  );
});

test("configured pages reject duplicate canonical directives", () => {
  assert.throws(
    () => uniqueLinkHref(
      '<link rel="canonical" href="https://yourloveelement.com/"><link href="https://yourloveelement.com/other/" rel="canonical">',
      "canonical",
      "fixture canonical",
    ),
    /fixture canonical must appear exactly once/,
  );
  assert.throws(
    () => uniqueLinkHref(
      '<link rel="canonical" href="https://yourloveelement.com/"><link href=https://yourloveelement.com/other/ rel=canonical>',
      "canonical",
      "unquoted fixture canonical",
    ),
    /unquoted fixture canonical must appear exactly once/,
  );
  assert.throws(
    () => uniqueLinkHref(
      '<link rel="canonical" href="https://yourloveelement.com/"><link rel=can&#111;nical href=https://yourloveelement.com/other/>',
      "canonical",
      "encoded fixture canonical",
    ),
    /encoded fixture canonical must appear exactly once/,
  );
  assert.equal(
    uniqueLinkHref('<link href=https://yourloveelement.com/ rel=canonical>', "canonical", "valid fixture canonical"),
    "https://yourloveelement.com/",
  );
});

test("indexable search directives stay inside one document head", () => {
  let checkedPages = 0;

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    checkedPages += 1;
    const head = uniqueHeadContent(html, relativePath);
    assert.ok(uniqueElementText(head, "title", `${relativePath} head title`));
    assert.ok(uniqueMetaContent(head, "name", "description", `${relativePath} head description`));
    assert.ok(uniqueLinkHref(head, "canonical", `${relativePath} head canonical`));
  }

  assert.ok(checkedPages > 0, "At least one indexable page must be checked");
  assert.throws(
    () => uniqueHeadContent("<head></head><head></head>", "duplicate-head fixture"),
    /must expose exactly one head/,
  );
  assert.throws(
    () => uniqueElementText(
      uniqueHeadContent(
        '<html><head><meta name="description" content="Primary"><link rel="canonical" href="https://yourloveelement.com/"></head><body><title>Late</title></body></html>',
        "body-title fixture",
      ),
      "title",
      "body-title fixture head title",
    ),
    /must appear exactly once/,
  );
  assert.throws(
    () => uniqueMetaContent(
      uniqueHeadContent(
        '<html><head><title>Primary</title><link rel="canonical" href="https://yourloveelement.com/"></head><body><meta name="description" content="Late"></body></html>',
        "body-description fixture",
      ),
      "name",
      "description",
      "body-description fixture head description",
    ),
    /must appear exactly once/,
  );
  assert.throws(
    () => uniqueLinkHref(
      uniqueHeadContent(
        '<html><head><title>Primary</title><meta name="description" content="Primary"></head><body><link rel="canonical" href="https://yourloveelement.com/"></body></html>',
        "body-canonical fixture",
      ),
      "canonical",
      "body-canonical fixture head canonical",
    ),
    /must appear exactly once/,
  );
});

test("crawler meta directives stay inside the document head", () => {
  let checkedPages = 0;

  for (const relativePath of contracts.html_files) {
    const directives = crawlerDirectivesInHead(read(relativePath), relativePath);
    checkedPages += 1;
    if (relativePath === "full-report/index.html") {
      assert.ok(blocksIndexing(directives.robots), `${relativePath} must keep noindex inside head`);
    }
  }

  assert.equal(checkedPages, contracts.html_files.length, "Every configured HTML page must be checked");
  assert.throws(
    () => crawlerDirectivesInHead(
      '<html><head></head><body><meta name="robots" content="noindex,follow"></body></html>',
      "body-robots fixture",
    ),
    /robots meta directives must stay inside head/,
  );
  assert.throws(
    () => crawlerDirectivesInHead(
      '<html><head></head><body><meta name="googlebot" content="nosnippet"></body></html>',
      "body-googlebot fixture",
    ),
    /Googlebot meta directives must stay inside head/,
  );
  assert.doesNotThrow(() => crawlerDirectivesInHead(
    '<html><head><meta content="index,follow" name="robots"><meta name="googlebot" content="index,follow"></head><body></body></html>',
    "head-directives fixture",
  ));
});

test("crawler meta audits parse unquoted attributes", () => {
  const general = robotsMetaDirectives(
    "<meta content=noindex,nofollow name=robots>",
    "unquoted robots fixture",
  );
  const googlebot = googlebotMetaDirectives(
    "<META NAME = GoogleBot CONTENT = noimageindex>",
    "unquoted Googlebot fixture",
  );
  const expiry = robotsMetaDirectives(
    "<meta name=robots content=unavailable_after:>",
    "unquoted expiry fixture",
  );

  assert.equal(blocksIndexing(general), true);
  assert.equal(blocksFollowing(general), true);
  assert.equal(blocksImageIndexing(googlebot), true);
  assert.equal(expiresFromSearch(expiry), true);
  assert.throws(
    () => robotsMetaDirectives(
      "<meta name=robots content=index><meta content=noindex name=robots>",
      "unquoted duplicate fixture",
    ),
    /duplicate robots meta directives/,
  );
});

test("crawler meta audits decode HTML character references", () => {
  const decimal = robotsMetaDirectives(
    "<meta name=rob&#111;ts content=noindex&#44;nofollow>",
    "decimal reference fixture",
  );
  const hexadecimal = googlebotMetaDirectives(
    "<meta name=googlebot content=index&#x2c;noimageindex>",
    "hexadecimal reference fixture",
  );
  const namedWhitespace = robotsMetaDirectives(
    "<meta name=robots content=index&NewLine;noindex>",
    "named whitespace fixture",
  );
  const namedColon = robotsMetaDirectives(
    "<meta name=robots content=max-snippet&colon;0>",
    "named colon fixture",
  );

  assert.equal(blocksIndexing(decimal), true);
  assert.equal(blocksFollowing(decimal), true);
  assert.equal(blocksImageIndexing(hexadecimal), true);
  assert.equal(blocksIndexing(namedWhitespace), true);
  assert.equal(blocksTextSnippets(namedColon), true);
});

test("indexable-page images expose explicit alternative semantics", () => {
  let checkedImages = 0;

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    for (const [index, match] of [...html.matchAll(/<img\b[^>]*>/gi)].entries()) {
      checkedImages += 1;
      assertExplicitImageAlternative(match[0], `${relativePath} image ${index + 1}`);
    }
  }

  assert.ok(checkedImages > 0, "At least one indexable-page image must be checked");
  assert.throws(
    () => assertExplicitImageAlternative('<img src="missing-alt.webp">', "missing-alt fixture"),
    /must declare an alt attribute/,
  );
  assert.throws(
    () => assertExplicitImageAlternative('<img src="ambiguous.webp" alt="">', "ambiguous fixture"),
    /must be explicitly decorative/,
  );
  assert.doesNotThrow(() => assertExplicitImageAlternative('<img alt="Meaningful context">', "content fixture"));
  assert.doesNotThrow(
    () => assertExplicitImageAlternative('<img aria-hidden="true" alt="">', "decorative fixture"),
  );
});

test("indexable pages declare one English document language", () => {
  let checkedPages = 0;

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    checkedPages += 1;
    assert.ok(englishDocumentLanguage(html, relativePath).startsWith("en"));
  }

  assert.ok(checkedPages > 0, "At least one indexable page must be checked");
  assert.throws(
    () => englishDocumentLanguage("<html><head></head></html>", "missing-language fixture"),
    /must declare a document language/,
  );
  assert.throws(
    () => englishDocumentLanguage('<html lang="fr"><head></head></html>', "wrong-language fixture"),
    /must declare an English document language/,
  );
  assert.throws(
    () => englishDocumentLanguage('<html lang="en"></html><html lang="en"></html>', "duplicate-root fixture"),
    /must expose exactly one html root/,
  );
  assert.equal(englishDocumentLanguage('<HTML LANG="en-US"><head></head></HTML>', "regional fixture"), "en-us");
});

test("indexable pages declare UTF-8 and a responsive viewport", () => {
  let checkedPages = 0;

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    checkedPages += 1;
    assert.equal(uniqueUtf8Charset(html, relativePath), "utf-8");
    assert.ok(responsiveViewportDirectives(html, relativePath).has("width=device-width"));
  }

  assert.ok(checkedPages > 0, "At least one indexable page must be checked");
  assert.throws(
    () => uniqueUtf8Charset('<meta charset="UTF-8"><meta charset="UTF-8">', "duplicate-charset fixture"),
    /must declare exactly one charset/,
  );
  assert.throws(
    () => uniqueUtf8Charset('<meta charset="UTF-8"><meta charset=UTF-8>', "unquoted duplicate-charset fixture"),
    /must declare exactly one charset/,
  );
  assert.equal(uniqueUtf8Charset('<meta charset=UTF-8>', "unquoted charset fixture"), "utf-8");
  assert.throws(
    () => uniqueUtf8Charset('<meta charset="ISO-8859-1">', "wrong-charset fixture"),
    /charset must be UTF-8/,
  );
  assert.throws(
    () => responsiveViewportDirectives('<meta name="viewport" content="width=1024">', "fixed-width fixture"),
    /viewport must use device width/,
  );
  assert.throws(
    () => responsiveViewportDirectives('<meta name="viewport" content="width=device-width">', "no-scale fixture"),
    /viewport must declare an initial scale of 1/,
  );
  assert.deepEqual(
    responsiveViewportDirectives(
      '<meta content="initial-scale=1.0, width=device-width" name="viewport">',
      "attribute-order fixture",
    ),
    new Set(["initial-scale=1.0", "width=device-width"]),
  );
  assert.throws(
    () => responsiveViewportDirectives(
      '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name=viewp&#111;rt content=width=device-width,initial-scale=1>',
      "encoded duplicate-viewport fixture",
    ),
    /must declare exactly one viewport/,
  );
  assert.deepEqual(
    responsiveViewportDirectives(
      '<meta content=initial-scale=1&#44;width=device-width name=viewport>',
      "unquoted viewport fixture",
    ),
    new Set(["initial-scale=1", "width=device-width"]),
  );
});

test("configured pages declare UTF-8 within the parser's first 1024 bytes", () => {
  for (const relativePath of contracts.html_files) {
    assert.ok(earlyUtf8CharsetEndByte(read(relativePath), relativePath) <= 1024);
  }

  const charsetMarkup = '<meta charset="UTF-8">';
  const boundaryPrefix = " ".repeat(1024 - Buffer.byteLength(charsetMarkup, "utf8"));
  assert.equal(earlyUtf8CharsetEndByte(`${boundaryPrefix}${charsetMarkup}`, "boundary fixture"), 1024);
  assert.throws(
    () => earlyUtf8CharsetEndByte(`${boundaryPrefix} ${charsetMarkup}`, "late fixture"),
    /charset must end within the first 1024 bytes/,
  );
  assert.throws(
    () => earlyUtf8CharsetEndByte(`${"é".repeat(512)}${charsetMarkup}`, "multibyte-late fixture"),
    /charset must end within the first 1024 bytes/,
  );
});

test("configured pages do not redefine the document base URL", () => {
  for (const relativePath of contracts.html_files) {
    assertNoBaseElement(read(relativePath), relativePath);
  }

  assert.throws(
    () => assertNoBaseElement(
      '<html><head><base href="https://example.invalid/"></head><body></body></html>',
      "base-href fixture",
    ),
    /must not redefine or globally retarget document links/,
  );
  assert.throws(
    () => assertNoBaseElement(
      '<html><head><BASE TARGET="_blank"></head><body></body></html>',
      "base-target fixture",
    ),
    /must not redefine or globally retarget document links/,
  );
  assert.doesNotThrow(() => assertNoBaseElement(
    '<html><head><title>Base compatibility guide</title></head><body></body></html>',
    "base-text fixture",
  ));
});

test("configured pages enter standards mode with one leading HTML5 doctype", () => {
  for (const relativePath of contracts.html_files) {
    assertHtml5Doctype(read(relativePath), relativePath);
  }

  assert.throws(
    () => assertHtml5Doctype("<html><head></head><body></body></html>", "missing-doctype fixture"),
    /must declare exactly one doctype/,
  );
  assert.throws(
    () => assertHtml5Doctype(
      '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"><html><head></head><body></body></html>',
      "legacy-doctype fixture",
    ),
    /must use the HTML5 doctype/,
  );
  assert.throws(
    () => assertHtml5Doctype(
      "<!doctype html><!doctype html><html><head></head><body></body></html>",
      "duplicate-doctype fixture",
    ),
    /must declare exactly one doctype/,
  );
  assert.throws(
    () => assertHtml5Doctype(
      "<html><head></head><body></body></html><!doctype html>",
      "late-doctype fixture",
    ),
    /doctype must precede the html root/,
  );
  assert.doesNotThrow(() => assertHtml5Doctype(
    "  \n<!DOCTYPE html>\n<HTML><HEAD></HEAD><BODY></BODY></HTML>",
    "case-and-whitespace fixture",
  ));
});

test("configured pages expose one ordered HTML document shell", () => {
  for (const relativePath of contracts.html_files) {
    assertDocumentShell(read(relativePath), relativePath);
  }

  assert.throws(
    () => assertDocumentShell("<html><head></head></html>", "missing-body fixture"),
    /must expose exactly one body opening tag/,
  );
  assert.throws(
    () => assertDocumentShell(
      "<html><head></head><body></body><body></body></html>",
      "duplicate-body fixture",
    ),
    /must expose exactly one body opening tag/,
  );
  assert.throws(
    () => assertDocumentShell(
      "<html><body></body><head></head></html>",
      "body-before-head fixture",
    ),
    /head must precede body/,
  );
  assert.throws(
    () => assertDocumentShell(
      "<html><head></head></html><body></body>",
      "body-outside-root fixture",
    ),
    /body must be inside the html root/,
  );
  assert.doesNotThrow(() => assertDocumentShell(
    "<HTML lang=\"en\"><HEAD></HEAD><BODY></BODY></HTML>",
    "uppercase-shell fixture",
  ));
});

test("indexable pages keep one coherent main heading outline", () => {
  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    const mainMatches = [...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)];
    assert.equal(mainMatches.length, 1, `${relativePath} must expose exactly one main landmark`);

    const headings = [...mainMatches[0][1].matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
      level: Number(match[1]),
      text: plainText(match[2]),
    }));

    assert.ok(headings.length > 0, `${relativePath} main landmark must contain headings`);
    assert.equal(headings[0].level, 1, `${relativePath} main heading outline must start with h1`);
    assert.equal(
      headings.filter((heading) => heading.level === 1).length,
      1,
      `${relativePath} main landmark must contain exactly one h1`,
    );

    for (const [index, heading] of headings.entries()) {
      assert.ok(heading.text, `${relativePath} heading ${index + 1} must have visible text`);
      if (index === 0) continue;
      assert.ok(
        heading.level <= headings[index - 1].level + 1,
        `${relativePath} heading ${index + 1} must not skip a level`,
      );
    }
  }
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
    assert.ok(!blocksIndexing(directives), `${relativePath} is in the sitemap and must not block indexing`);
    assert.ok(!blocksFollowing(directives), `${relativePath} is in the sitemap and must not block link following`);
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must have an indexable local page contract");
});

test("sitemap pages never use Googlebot-specific blocking directives", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  let checkedPages = 0;

  assert.equal(googlebotMetaDirectives('<meta name="googlebot" content="index, follow">', "fixture").size, 2);
  assert.equal(googlebotMetaDirectives('<meta name="googlebot" content="noindex">', "fixture").has("noindex"), true);
  assert.equal(
    googlebotMetaDirectives('<META CONTENT="index, NOFOLLOW" NAME="GoogleBot">', "fixture").has("nofollow"),
    true,
  );
  assert.equal(googlebotMetaDirectives('<meta name="googlebot-news" content="noindex">', "fixture").size, 0);

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    if (!sitemapUrls.has(canonical)) continue;

    checkedPages += 1;
    const directives = googlebotMetaDirectives(html, relativePath);
    assert.ok(!blocksIndexing(directives), `${relativePath} is in the sitemap and must not block Googlebot indexing`);
    assert.ok(!blocksFollowing(directives), `${relativePath} is in the sitemap and must not block Googlebot link following`);
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must be checked for Googlebot directives");
});

test("robots none shorthand is treated as noindex and nofollow", () => {
  const generalDirectives = robotsMetaDirectives('<meta name="robots" content="none">', "fixture");
  const googlebotDirectives = googlebotMetaDirectives('<meta name="googlebot" content="none">', "fixture");

  assert.equal(blocksIndexing(generalDirectives), true);
  assert.equal(blocksFollowing(generalDirectives), true);
  assert.equal(blocksIndexing(googlebotDirectives), true);
  assert.equal(blocksFollowing(googlebotDirectives), true);
  assert.equal(blocksIndexing(new Set(["index", "follow"])), false);
  assert.equal(blocksFollowing(new Set(["index", "follow"])), false);
});

test("sitemap pages remain eligible for search text snippets", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  let checkedPages = 0;

  assert.equal(blocksTextSnippets(robotsMetaDirectives('<meta name="robots" content="nosnippet">', "fixture")), true);
  assert.equal(
    blocksTextSnippets(robotsMetaDirectives('<meta content="index, max-snippet:0" name="robots">', "fixture")),
    true,
  );
  assert.equal(
    blocksTextSnippets(googlebotMetaDirectives('<meta name="googlebot" content="max-snippet:0">', "fixture")),
    true,
  );
  assert.equal(blocksTextSnippets(new Set(["index", "follow", "max-snippet:-1"])), false);

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    if (!sitemapUrls.has(canonical)) continue;

    checkedPages += 1;
    assert.ok(
      !blocksTextSnippets(robotsMetaDirectives(html, relativePath)),
      `${relativePath} is in the sitemap and must not block search text snippets`,
    );
    assert.ok(
      !blocksTextSnippets(googlebotMetaDirectives(html, relativePath)),
      `${relativePath} is in the sitemap and must not block Googlebot text snippets`,
    );
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must be checked for text snippet eligibility");
});

test("sitemap pages never expire from search results", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  let checkedPages = 0;

  assert.equal(
    expiresFromSearch(robotsMetaDirectives(
      '<meta name="robots" content="index, unavailable_after: 25 Jun 2026 15:00:00 PST">',
      "robots expiry fixture",
    )),
    true,
  );
  assert.equal(
    expiresFromSearch(googlebotMetaDirectives(
      '<meta name="googlebot" content="unavailable_after: 25 Jun 2026 15:00:00 PST">',
      "Googlebot expiry fixture",
    )),
    true,
  );
  assert.equal(expiresFromSearch(new Set(["index", "follow", "max-snippet:-1"])), false);

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    if (!sitemapUrls.has(canonical)) continue;

    checkedPages += 1;
    assert.ok(
      !expiresFromSearch(robotsMetaDirectives(html, relativePath)),
      `${relativePath} is in the sitemap and must not expire from search results`,
    );
    assert.ok(
      !expiresFromSearch(googlebotMetaDirectives(html, relativePath)),
      `${relativePath} is in the sitemap and must not expire for Googlebot`,
    );
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must be checked for search expiry directives");
});

test("sitemap pages remain eligible for image indexing", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  let checkedPages = 0;

  assert.equal(
    blocksImageIndexing(robotsMetaDirectives(
      '<meta name="robots" content="index, follow, noimageindex">',
      "robots image fixture",
    )),
    true,
  );
  assert.equal(
    blocksImageIndexing(googlebotMetaDirectives(
      '<meta name="googlebot" content="noimageindex">',
      "Googlebot image fixture",
    )),
    true,
  );
  assert.equal(blocksImageIndexing(new Set(["index", "follow", "max-image-preview:large"])), false);

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    if (!sitemapUrls.has(canonical)) continue;

    checkedPages += 1;
    assert.ok(
      !blocksImageIndexing(robotsMetaDirectives(html, relativePath)),
      `${relativePath} is in the sitemap and must not block image indexing`,
    );
    assert.ok(
      !blocksImageIndexing(googlebotMetaDirectives(html, relativePath)),
      `${relativePath} is in the sitemap and must not block Googlebot image indexing`,
    );
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must be checked for image-indexing eligibility");
});

test("sitemap pages never use meta refresh redirects", () => {
  const sitemap = read("sitemap.xml");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  let checkedPages = 0;

  assert.equal(hasMetaRefreshRedirect('<meta http-equiv="refresh" content="0; url=/other/">'), true);
  assert.equal(hasMetaRefreshRedirect('<meta content="5; url=/other/" HTTP-EQUIV="REFRESH">'), true);
  assert.equal(hasMetaRefreshRedirect('<meta http-equiv=refresh content="0; url=/other/">'), true);
  assert.equal(hasMetaRefreshRedirect('<meta http-equiv=ref&#114;esh content="0; url=/other/">'), true);
  assert.equal(hasMetaRefreshRedirect('<meta http-equiv="content-security-policy" content="default-src self">'), false);

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    if (!sitemapUrls.has(canonical)) continue;

    checkedPages += 1;
    assert.equal(
      hasMetaRefreshRedirect(html),
      false,
      `${relativePath} is in the sitemap and must not emit a meta refresh redirect`,
    );
  }

  assert.equal(checkedPages, sitemapUrls.size, "Every sitemap URL must be checked for meta refresh redirects");
});

test("canonicals stay normalized to their configured page routes", () => {
  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    const canonicalValue = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    const canonical = new URL(canonicalValue);
    const expectedPath = expectedCanonicalPath(relativePath);

    assert.equal(canonical.origin, origin, `${relativePath} canonical must use the production origin`);
    assert.equal(canonical.username, "", `${relativePath} canonical must not include a username`);
    assert.equal(canonical.password, "", `${relativePath} canonical must not include a password`);
    assert.equal(canonical.port, "", `${relativePath} canonical must not include a port`);
    assert.equal(canonical.search, "", `${relativePath} canonical must not include a query`);
    assert.equal(canonical.hash, "", `${relativePath} canonical must not include a fragment`);
    assert.equal(canonical.pathname, expectedPath, `${relativePath} canonical must match its configured route`);
    assert.equal(canonical.href, `${origin}${expectedPath}`, `${relativePath} canonical must be fully normalized`);
  }
});

test("every indexable page receives crawlable internal links from at least two pages", () => {
  const indexablePages = new Map();

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

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
    for (const { anchor, href } of anchorElementsWithHref(sourcePage.html)) {
      if (!isFollowableAnchor(anchor)) continue;

      const targetUrl = new URL(href, sourcePage.canonical);
      if (targetUrl.origin !== origin || targetUrl.pathname === sourcePath) continue;

      indexablePages.get(targetUrl.pathname)?.inboundSources.add(sourcePath);
    }
  }

  for (const page of indexablePages.values()) {
    assert.ok(
      page.inboundSources.size >= 2,
      `${page.relativePath} must receive crawlable internal links from at least two indexable pages`,
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

test("crawlable internal-link coverage parses unquoted rel values", () => {
  assert.equal(isFollowableAnchor('<a href="/guide/" rel=nofollow>Guide</a>'), false);
  assert.equal(isFollowableAnchor('<a href="/guide/" REL=NOFOLLOW>Guide</a>'), false);
  assert.equal(isFollowableAnchor('<a href="/guide/" rel=ugc>Guide</a>'), true);
});

test("crawl audits parse unquoted href values", () => {
  const canonicalPaths = new Set(contracts.html_files.map((relativePath) => {
    const html = read(relativePath);
    return new URL(uniqueLinkHref(html, "canonical", `${relativePath} canonical`)).pathname;
  }));

  assert.throws(
    () => assertCanonicalInternalAnchorTargets(
      '<a href=/missing/>Missing page</a>',
      `${origin}/`,
      canonicalPaths,
      "unquoted-href fixture",
    ),
    /must target a configured canonical route/,
  );
  assert.doesNotThrow(() => assertCanonicalInternalAnchorTargets(
    '<a href=/how-it-works/>How it works</a>',
    `${origin}/`,
    canonicalPaths,
    "valid-unquoted-href fixture",
  ));
  assert.equal(
    assertCanonicalInternalAnchorTargets(
      '<a href=/missing/ rel=nofollow>Excluded</a>',
      `${origin}/`,
      canonicalPaths,
      "unquoted-nofollow-href fixture",
    ),
    0,
  );
});

test("followable same-origin links stay on configured canonical routes", () => {
  const pages = contracts.html_files.map((relativePath) => {
    const html = read(relativePath);
    const canonical = firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      `${relativePath} canonical`,
    );
    return { canonical, html, relativePath };
  });
  const canonicalPaths = new Set(pages.map((page) => new URL(page.canonical).pathname));
  let checkedLinks = 0;

  for (const page of pages) {
    checkedLinks += assertCanonicalInternalAnchorTargets(
      page.html,
      page.canonical,
      canonicalPaths,
      page.relativePath,
    );
  }

  assert.ok(checkedLinks > 0, "At least one followable same-origin link must be covered");
  assert.throws(
    () => assertCanonicalInternalAnchorTargets(
      '<a href="/missing/">Missing page</a>',
      `${origin}/`,
      canonicalPaths,
      "missing-route fixture",
    ),
    /must target a configured canonical route/,
  );
  assert.throws(
    () => assertCanonicalInternalAnchorTargets(
      '<a href="/five-elements-love-compatibility/index.html">Guide alias</a>',
      `${origin}/`,
      canonicalPaths,
      "html-alias fixture",
    ),
    /must target a configured canonical route/,
  );
  assert.throws(
    () => assertCanonicalInternalAnchorTargets(
      '<a href="/how-it-works/?source=internal">Method query variant</a>',
      `${origin}/`,
      canonicalPaths,
      "query-variant fixture",
    ),
    /must not create a query variant/,
  );
  assert.doesNotThrow(() => assertCanonicalInternalAnchorTargets(
    '<a href="/five-elements-love-compatibility/#repair">Repair prompts</a>',
    `${origin}/`,
    canonicalPaths,
    "canonical-fragment fixture",
  ));
  assert.equal(
    assertCanonicalInternalAnchorTargets(
      '<a href="/missing/" rel="nofollow">Excluded</a>',
      `${origin}/`,
      canonicalPaths,
      "nofollow fixture",
    ),
    0,
  );
});

test("followable canonical-host links avoid redirect aliases", () => {
  const canonicalPaths = new Set(contracts.html_files.map((relativePath) => {
    const canonical = uniqueLinkHref(read(relativePath), "canonical", `${relativePath} canonical`);
    return new URL(canonical).pathname;
  }));

  for (const [href, label] of [
    ["http://yourloveelement.com/how-it-works/", "HTTP alias fixture"],
    ["https://www.yourloveelement.com/how-it-works/", "www alias fixture"],
  ]) {
    assert.throws(
      () => assertCanonicalInternalAnchorTargets(
        `<a href="${href}">How it works</a>`,
        `${origin}/`,
        canonicalPaths,
        label,
      ),
      /must use canonical HTTPS origin/,
    );
  }

  assert.equal(
    assertCanonicalInternalAnchorTargets(
      '<a href="https://example.com/how-it-works/">External reference</a>',
      `${origin}/`,
      canonicalPaths,
      "external-origin fixture",
    ),
    0,
  );
});

test("followable canonical-host links reject embedded credentials", () => {
  const canonicalPaths = new Set(contracts.html_files.map((relativePath) => {
    const canonical = uniqueLinkHref(read(relativePath), "canonical", `${relativePath} canonical`);
    return new URL(canonical).pathname;
  }));

  for (const [href, label] of [
    ["https://reader@yourloveelement.com/how-it-works/", "username fixture"],
    ["https://reader:secret@yourloveelement.com/how-it-works/", "username-password fixture"],
  ]) {
    assert.throws(
      () => assertCanonicalInternalAnchorTargets(
        `<a href="${href}">How it works</a>`,
        `${origin}/`,
        canonicalPaths,
        label,
      ),
      /must not embed URL credentials/,
    );
  }

  assert.equal(
    assertCanonicalInternalAnchorTargets(
      '<a href="https://reader:secret@example.com/how-it-works/">External reference</a>',
      `${origin}/`,
      canonicalPaths,
      "external-credentials fixture",
    ),
    0,
  );
});

test("followable cross-document links use descriptive anchor text", () => {
  const pages = contracts.html_files.map((relativePath) => {
    const html = read(relativePath);
    const canonical = uniqueLinkHref(html, "canonical", `${relativePath} canonical`);
    return { canonical, html, relativePath };
  });
  const canonicalPaths = new Set(pages.map((page) => new URL(page.canonical).pathname));
  let checkedLinks = 0;

  for (const page of pages) {
    const sourcePath = new URL(page.canonical).pathname;
    for (const { anchor, href } of anchorElementsWithHref(page.html)) {
      if (!isFollowableAnchor(anchor)) continue;

      const targetUrl = new URL(href, page.canonical);
      if (targetUrl.origin !== origin || !canonicalPaths.has(targetUrl.pathname) || targetUrl.pathname === sourcePath) continue;

      checkedLinks += 1;
      assert.ok(
        hasDescriptiveAnchorText(anchor),
        `${page.relativePath} cross-document link must use descriptive anchor text: ${href}`,
      );
    }
  }

  assert.ok(checkedLinks > 0, "Configured pages must expose followable cross-document links");
  assert.equal(hasDescriptiveAnchorText('<a href="/how-it-works/">Learn more</a>'), false);
  assert.equal(hasDescriptiveAnchorText('<a href="/how-it-works/"><img alt="Five Elements reading methodology"></a>'), true);
  assert.equal(hasDescriptiveAnchorText('<a href="/five-elements-love-compatibility/">Five Elements compatibility guide</a>'), true);
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

    for (const { href } of anchorElementsWithHref(html)) {
      const targetUrl = new URL(href, canonical);
      if (targetUrl.origin !== origin || !targetUrl.hash) continue;

      checkedLinks += 1;
      const targetPage = pagesByPath.get(targetUrl.pathname);
      assert.ok(targetPage, `${relativePath} fragment link must target a configured local page: ${href}`);

      const targetId = decodeURIComponent(targetUrl.hash.slice(1));
      const idMatches = [...targetPage.html.matchAll(/\bid=["']([^"']+)["']/gi)]
        .filter((idMatch) => idMatch[1] === targetId);
      assert.equal(
        idMatches.length,
        1,
        `${relativePath} fragment link must resolve to one target in ${targetPage.relativePath}: ${href}`,
      );
    }
  }

  assert.ok(checkedLinks > 0, "At least one same-origin fragment link must be covered");
});

test("every indexable page exposes one valid keyboard skip target", () => {
  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

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
    ["five-elements-relationship-questions/index.html", "/five-elements-relationship-questions/"],
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

test("indexable pages keep one stable square search-result favicon", () => {
  const faviconUrls = new Set();

  for (const relativePath of contracts.html_files) {
    const html = read(relativePath);
    if (blocksIndexing(robotsMetaDirectives(html, relativePath))) continue;

    const canonical = uniqueLinkHref(html, "canonical", `${relativePath} canonical`);
    faviconUrls.add(searchResultFavicon(html, canonical, relativePath).href);
  }

  assert.deepEqual([...faviconUrls], [`${origin}/assets/logo-mark.svg`]);
  assert.equal(squareSvgViewBox(read("assets/logo-mark.svg"), "logo-mark favicon"), 128);

  for (const [html, expected] of [
    [
      '<link rel="icon" href="/assets/logo-mark.svg" type="image/svg+xml"><link rel="shortcut icon" href="/assets/logo-mark.svg" type="image/svg+xml">',
      /exactly one search-result favicon/,
    ],
    ['<link rel="icon" href="https://www.yourloveelement.com/assets/logo-mark.svg" type="image/svg+xml">', /canonical HTTPS origin/],
    ['<link rel="icon" href="/assets/logo-mark.svg?revision=2" type="image/svg+xml">', /query variant/],
    ['<link rel="icon" href="/assets/logo-mark.svg" type="image/png">', /SVG MIME type/],
  ]) {
    assert.throws(() => searchResultFavicon(html, `${origin}/`, "favicon fixture"), expected);
  }

  assert.throws(
    () => squareSvgViewBox('<svg viewBox="0 0 128 64"></svg>', "non-square fixture"),
    /viewBox must be square/,
  );
});

test("core acquisition pages keep complete social preview metadata", () => {
  const corePages = [
    ["index.html", "website"],
    ["five-elements-love-compatibility/index.html", "article"],
    ["five-elements-relationship-questions/index.html", "article"],
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
  lastModified.forEach((date, index) => validSitemapLastmod(date, `Sitemap lastmod ${index + 1}`));
  assert.throws(
    () => validSitemapLastmod("2026-02-30", "invalid sitemap date fixture", "2026-08-16"),
    /must be a valid calendar date/,
  );
  assert.throws(
    () => validSitemapLastmod("2026-08-17", "future sitemap date fixture", "2026-08-16"),
    /must not be future-dated/,
  );
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.equal(canonicalRobotsSitemapUrl(robots, "production robots.txt"), `${origin}/sitemap.xml`);
});

test("robots exposes one canonical sitemap discovery URL", () => {
  const canonicalDirective = `Sitemap: ${origin}/sitemap.xml`;

  assert.equal(canonicalRobotsSitemapUrl(canonicalDirective, "canonical fixture"), `${origin}/sitemap.xml`);
  assert.throws(
    () => canonicalRobotsSitemapUrl(`${canonicalDirective}\n${canonicalDirective}`, "duplicate fixture"),
    /exactly one Sitemap directive/,
  );
  assert.throws(
    () => canonicalRobotsSitemapUrl("Sitemap: http://yourloveelement.com/sitemap.xml", "http fixture"),
    /canonical HTTPS origin/,
  );
  assert.throws(
    () => canonicalRobotsSitemapUrl("Sitemap: https://www.yourloveelement.com/sitemap.xml", "www fixture"),
    /canonical HTTPS origin/,
  );
  assert.throws(
    () => canonicalRobotsSitemapUrl(`${canonicalDirective}?source=robots`, "query fixture"),
    /query variant/,
  );
  assert.throws(
    () => canonicalRobotsSitemapUrl(`Sitemap: ${origin}/sitemap-index.xml`, "path fixture"),
    /canonical sitemap path/,
  );
});

test("sitemap entries preserve one crawl target and bounded freshness metadata", () => {
  const entries = sitemapUrlEntries(read("sitemap.xml"), "production sitemap");

  assert.equal(entries.length, 8, "production sitemap must expose all eight indexable pages");
  assert.ok(entries.every((entry) => entry.loc.startsWith(`${origin}/`)));
  assert.throws(
    () => sitemapUrlEntries(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url></url></urlset>',
      "missing-location fixture",
    ),
    /must expose exactly one crawl target/,
  );
  assert.throws(
    () => sitemapUrlEntries(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://yourloveelement.com/</loc><loc>https://yourloveelement.com/other/</loc></url></urlset>',
      "duplicate-location fixture",
    ),
    /must expose exactly one crawl target/,
  );
  assert.throws(
    () => sitemapUrlEntries(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://yourloveelement.com/</loc><lastmod>2026-08-09</lastmod><lastmod>2026-08-10</lastmod></url></urlset>',
      "duplicate-lastmod fixture",
    ),
    /must expose at most one lastmod/,
  );
  assert.throws(
    () => sitemapUrlEntries(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://yourloveelement.com/</loc><lastmod>August 9, 2026</lastmod></url></urlset>',
      "invalid-lastmod fixture",
    ),
    /lastmod must use YYYY-MM-DD/,
  );
  assert.throws(
    () => sitemapUrlEntries(
      '<urlset><url><loc>https://yourloveelement.com/</loc></url></urlset>',
      "missing-namespace fixture",
    ),
    /must use the standard sitemap namespace/,
  );
});

test("wildcard robots rules never block the whole site", () => {
  assert.equal(wildcardRobotsDisallowsRoot(read("robots.txt")), false);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: *\nDisallow: /"), true);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: Googlebot\nDisallow: /"), false);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: *\nDisallow: /private/"), false);
  assert.equal(wildcardRobotsDisallowsRoot("User-agent: *\nDisallow: / # block all"), true);
});

test("robots permits search and answer-engine crawlers to reach every sitemap path", () => {
  const sitemap = read("sitemap.xml");
  const discoveryCrawlers = ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"];

  assert.equal(
    assertSitemapPathsAllowed(read("robots.txt"), sitemap, discoveryCrawlers, "production robots.txt"),
    32,
  );
  assert.throws(
    () => assertSitemapPathsAllowed(
      "User-agent: *\nAllow: /\nDisallow: /privacy/",
      sitemap,
      ["Googlebot", "Bingbot"],
      "path-block fixture",
    ),
    /must allow Googlebot to crawl sitemap path \/privacy\//,
  );
  assert.throws(
    () => assertSitemapPathsAllowed(
      "User-agent: *\nAllow: /\nUser-agent: Googlebot\nDisallow: /how-it-works/",
      sitemap,
      discoveryCrawlers,
      "named-agent fixture",
    ),
    /must allow Googlebot to crawl sitemap path \/how-it-works\//,
  );
  for (const answerCrawler of ["OAI-SearchBot", "PerplexityBot"]) {
    assert.throws(
      () => assertSitemapPathsAllowed(
        `User-agent: *\nAllow: /\nUser-agent: ${answerCrawler}\nDisallow: /five-elements-love-compatibility/`,
        sitemap,
        discoveryCrawlers,
        `${answerCrawler} fixture`,
      ),
      new RegExp(`must allow ${answerCrawler} to crawl sitemap path /five-elements-love-compatibility/`),
    );
  }
  assert.equal(
    robotsAllowsPath("User-agent: *\nDisallow: /\nAllow: /how-it-works/", "Bingbot", "/how-it-works/"),
    true,
  );
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
    ["five-elements-relationship-questions/index.html", ["WebPage", "Article"]],
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

  for (const type of ["Organization", "Brand", "WebSite", "WebPage", "Product", "FAQPage"]) {
    assert.ok(types.has(type), `Homepage JSON-LD must include ${type}`);
  }
  assert.match(html, /<h2[^>]*>What are the five love elements\?<\/h2>/i);
  assert.match(html, /href=["']\/five-elements-love-compatibility\/["']/i);
  assert.match(html, /href=["']\/how-it-works\/["']/i);
  assert.match(html, /\$9\.99/);
});

test("homepage Product offer stays truthful and merchant-eligible", () => {
  const html = read("index.html");
  const offer = productOfferSignals(html, "index.html");
  const visiblePrice = offer.price.replace(".", "\\.");

  assert.match(
    html,
    new RegExp(`One-time \\$${visiblePrice} ${offer.priceCurrency} purchase`, "i"),
    "The structured Product price and currency must match the visible one-time offer",
  );
  assert.throws(
    () => productOfferSignals(html.replace('"priceCurrency": "USD"', '"priceCurrency": "EUR"'), "currency fixture"),
    /must use USD/,
  );
  assert.throws(
    () => productOfferSignals(html.replace('"price": "9.99"', '"price": "0.00"'), "zero-price fixture"),
    /must stay above zero/,
  );
  assert.throws(
    () => productOfferSignals(html.replace("https://schema.org/InStock", "https://schema.org/OutOfStock"), "availability fixture"),
    /must stay available/,
  );
});

test("core schema graphs keep canonical entity references connected", () => {
  const homepage = read("index.html");
  const homepageCanonical = firstMatch(
    homepage,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    "homepage canonical",
  );
  const organization = structuredItem(homepage, "Organization", "index.html");
  const brand = structuredItem(homepage, "Brand", "index.html");
  const website = structuredItem(homepage, "WebSite", "index.html");
  const webpage = structuredItem(homepage, "WebPage", "index.html");
  const product = structuredItem(homepage, "Product", "index.html");
  const faq = structuredItem(homepage, "FAQPage", "index.html");

  assert.equal(organization["@id"], `${homepageCanonical}#organization`);
  assert.equal(organization.url, homepageCanonical);
  assert.equal(brand["@id"], `${homepageCanonical}#brand`);
  assert.equal(brand.name, organization.name);
  assert.equal(brand.url, homepageCanonical);
  assert.equal(brand.logo, organization.logo);
  assert.equal(website["@id"], `${homepageCanonical}#website`);
  assert.equal(website.url, homepageCanonical);
  assert.equal(website.publisher?.["@id"], organization["@id"]);
  assert.equal(webpage["@id"], `${homepageCanonical}#webpage`);
  assert.equal(webpage.url, homepageCanonical);
  assert.equal(webpage.isPartOf?.["@id"], website["@id"]);
  assert.equal(product["@id"], `${homepageCanonical}#full-report`);
  assert.equal(product.brand?.["@id"], brand["@id"]);
  assert.equal(product.offers?.url, `${homepageCanonical}#preview`);
  assert.equal(faq["@id"], `${homepageCanonical}#faq`);

  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
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

test("sitewide schema graph keeps unique canonical ids with no dangling internal references", () => {
  const pages = [
    "index.html",
    "five-elements-love-compatibility/index.html",
    "five-elements-relationship-questions/index.html",
    "how-it-works/index.html",
  ].map((relativePath) => [relativePath, jsonLdBlocks(read(relativePath))]);
  const result = auditSiteEntityGraph(pages, "Core acquisition schema graph");

  assert.ok(result.declaredIds.size >= 14, "Core acquisition schema graph must expose the expected entity depth");
  assert.equal(result.referencedIds.size, result.declaredIds.size);

  assert.throws(
    () => auditSiteEntityGraph([
      ["duplicate-fixture.html", [{ "@graph": [
        { "@id": `${origin}/#duplicate`, "@type": "Thing" },
        { "@id": `${origin}/#duplicate`, "@type": "Thing" },
      ] }]],
    ], "Duplicate fixture"),
    /declare each internal @id exactly once/,
  );
  assert.throws(
    () => auditSiteEntityGraph([
      ["dangling-fixture.html", [{ "@graph": [
        {
          "@id": `${origin}/#declared`,
          "@type": "Thing",
          "isPartOf": { "@id": `${origin}/#missing` },
        },
      ] }]],
    ], "Dangling fixture"),
    /internal @id reference must resolve to a declared entity/,
  );
});

test("JSON-LD discovery fails closed on unquoted and encoded MIME types", () => {
  const payload = JSON.stringify({
    "@context": "https://schema.org",
    "@id": `${origin}/#mime-fixture`,
    "@type": "Thing",
  });
  const quoted = `<script type="application/ld+json">${payload}</script>`;

  for (const type of ["application/ld+json", "application&#x2F;ld+json"]) {
    const fixture = `${quoted}<script type=${type}>${payload}</script>`;
    const blocks = jsonLdBlocks(fixture);

    assert.equal(blocks.length, 2, `JSON-LD discovery must include ${type}`);
    assert.throws(
      () => auditSiteEntityGraph([["mime-fixture.html", blocks]], "MIME fixture"),
      /declare each internal @id exactly once/,
    );
  }
});

test("structured-data site URLs stay on the canonical origin without crawl variants", () => {
  const payloads = [
    "index.html",
    "five-elements-love-compatibility/index.html",
    "five-elements-relationship-questions/index.html",
    "how-it-works/index.html",
  ].flatMap((relativePath) => jsonLdBlocks(read(relativePath)));

  assert.ok(auditStructuredDataSiteUrls(payloads, "Core acquisition schema") >= 10);

  for (const [field, value, expected] of [
    ["url", "http://yourloveelement.com/", /canonical HTTPS origin/],
    ["logo", "https://www.yourloveelement.com/assets/logo.png", /canonical HTTPS origin/],
    ["image", "https://yourloveelement.com/assets/preview.png?size=large", /must not create a query variant/],
    ["item", "https://reader:secret@yourloveelement.com/", /must not embed a username/],
    ["image", "https://yourloveelement.com/assets/preview.png#fragment", /must not include a fragment/],
    ["contentUrl", "https://yourloveelement.com/assets/preview.webp#fragment", /must not include a fragment/],
  ]) {
    assert.throws(
      () => auditStructuredDataSiteUrls([{ "@type": "Thing", [field]: value }], `${field} fixture`),
      expected,
    );
  }

  assert.doesNotThrow(() => auditStructuredDataSiteUrls([
    { "@type": "Thing", url: `${origin}/#preview`, sameAs: "https://example.com/profile" },
  ], "valid fixture"));
  assert.throws(
    () => auditStructuredDataSiteUrls([
      {
        "@type": "Thing",
        url: origin,
        image: "data:image/png;base64,AA==",
      },
    ], "non-web image fixture"),
    /must use HTTP or HTTPS/,
  );
  assert.throws(
    () => auditStructuredDataSiteUrls([
      {
        "@type": "Thing",
        url: origin,
        image: 42,
      },
    ], "invalid URL value fixture"),
    /must be a string URL or structured object/,
  );
  assert.throws(
    () => auditStructuredDataSiteUrls([
      {
        "@type": "Thing",
        url: origin,
        image: [
          `${origin}/assets/preview.webp`,
          `${origin}/assets/preview.webp?size=large`,
        ],
      },
    ], "image array fixture"),
    /must not create a query variant/,
  );
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
  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
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

test("editorial Article discovery signals agree with visible pages", () => {
  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const page = structuredItem(html, "WebPage", relativePath);
    const article = structuredItem(html, "Article", relativePath);
    const documentLanguage = englishDocumentLanguage(html, relativePath);
    const visibleHeading = plainText(firstMatch(
      html,
      /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
      `${relativePath} visible heading`,
    ));
    const socialImage = uniqueMetaContent(html, "property", "og:image", `${relativePath} og:image`);

    assert.equal(article.headline, visibleHeading, `${relativePath} Article headline must match its visible heading`);
    assert.equal(article.image, socialImage, `${relativePath} Article image must match its social preview image`);
    assert.equal(page.inLanguage, documentLanguage, `${relativePath} WebPage language must match the document`);
    assert.equal(article.inLanguage, documentLanguage, `${relativePath} Article language must match the document`);
    assert.equal(article.isAccessibleForFree, true, `${relativePath} Article must accurately remain marked as free to read`);
  }
});

test("editorial freshness dates form valid non-regressing timelines", () => {
  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
    const article = structuredItem(read(relativePath), "Article", relativePath);
    const published = validIsoCalendarDay(article.datePublished, `${relativePath} Article datePublished`);
    const modified = validIsoCalendarDay(article.dateModified, `${relativePath} Article dateModified`);

    assert.ok(modified >= published, `${relativePath} Article dateModified must not precede datePublished`);
  }

  assert.throws(
    () => validIsoCalendarDay("2026-02-30", "invalid chronology fixture"),
    /must be a valid calendar date/,
  );
});

test("editorial review ownership and dates agree with Article schema", () => {
  const expectedOrganizationId = `${origin}/#organization`;

  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const page = structuredItem(html, "WebPage", relativePath);
    const article = structuredItem(html, "Article", relativePath);
    const visibleReviewLine = plainText(firstMatch(
      html,
      /<p\b[^>]*class=["'][^"']*\blegal-updated\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
      `${relativePath} visible review line`,
    ));

    assert.equal(article.author?.["@id"], expectedOrganizationId, `${relativePath} Article author must use the brand organization`);
    assert.equal(article.publisher?.["@id"], expectedOrganizationId, `${relativePath} Article publisher must use the brand organization`);
    assert.equal(article.datePublished, page.datePublished, `${relativePath} published dates must agree`);
    assert.equal(article.dateModified, page.dateModified, `${relativePath} modified dates must agree`);

    const visibleDate = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(new Date(`${article.dateModified}T00:00:00Z`));
    assert.equal(
      visibleReviewLine,
      `Published and reviewed by Your Love Element · ${visibleDate}`,
      `${relativePath} visible review ownership and date must match Article schema`,
    );
  }
});

test("editorial breadcrumbs form one canonical two-level hierarchy", () => {
  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
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
  for (const relativePath of ["five-elements-love-compatibility/index.html", "five-elements-relationship-questions/index.html", "how-it-works/index.html"]) {
    const html = read(relativePath);
    const visible = visibleFaqEntries(html, relativePath);
    const structured = structuredFaqEntries(html, relativePath);

    assert.ok(visible.length >= 3, `${relativePath} must expose a useful visible FAQ`);
    assert.deepEqual(structured, visible, `${relativePath} FAQ schema must not drift from visible content`);
  }
});

test("homepage FAQ schema exposes no hidden answers and stays visibly grounded", () => {
  const relativePath = "index.html";
  const html = read(relativePath);
  const visible = visibleFaqEntries(html, relativePath);
  const structured = structuredFaqEntries(html, relativePath);

  assertFaqSchemaIsVisiblyGrounded(structured, visible, relativePath);
  assert.throws(
    () => assertFaqSchemaIsVisiblyGrounded(
      [...structured, { question: "What is hidden?", answer: "This answer exists only in structured data." }],
      visible.slice(0, structured.length),
      "hidden-entry fixture",
    ),
    /must not expose questions that are hidden from the page/,
  );
  assert.throws(
    () => assertFaqSchemaIsVisiblyGrounded(
      structured.map((entry, index) => index === 0
        ? { ...entry, answer: "Bananas orbit silently beyond the lighthouse." }
        : entry),
      visible,
      "answer-drift fixture",
    ),
    /must remain semantically grounded in its visible answer/,
  );
});

test("compatibility guide covers every regulating pair with one repair prompt", () => {
  const html = read("five-elements-love-compatibility/index.html");
  const section = firstMatch(
    html,
    /<section[^>]+aria-labelledby=["']compatibility-title["'][^>]*>([\s\S]*?)<\/section>/i,
    "compatibility section",
  );
  const text = plainText(section);
  const generatingPairs = ["Water + Wood", "Wood + Fire", "Fire + Earth", "Earth + Metal", "Metal + Water"];
  const regulatingPairs = ["Wood + Earth", "Wood + Metal", "Fire + Metal", "Fire + Water", "Earth + Water"];

  for (const pair of [...generatingPairs, ...regulatingPairs]) {
    assert.equal(text.split(`${pair}:`).length - 1, 1, `${pair} must appear exactly once in the compatibility section`);
  }
  assert.equal((text.match(/Repair prompt:/g) || []).length, 5, "each regulating pair must include one repair prompt");
});

test("relationship question guide keeps five complete five-question sets", () => {
  const html = read("five-elements-relationship-questions/index.html");
  const questionLists = [...html.matchAll(/<ol>([\s\S]*?)<\/ol>/gi)];
  const questionCounts = questionLists.map(([, list]) => (list.match(/<li>/gi) || []).length);

  assert.equal(questionLists.length, 5, "relationship question guide must keep one ordered list per element");
  assert.deepEqual(questionCounts, [5, 5, 5, 5, 5], "each element must keep five usable relationship questions");
});

test("methodology states the AI and traditional-chart boundaries", () => {
  const html = read("how-it-works/index.html");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  assert.match(text, /The free preview does not use generative AI/i);
  assert.match(text, /The paid full report does use AI after payment is verified/i);
  assert.match(text, /does not collect birth year, birth time, birthplace/i);
  assert.match(text, /cannot verify a soulmate/i);
});
