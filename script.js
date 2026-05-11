const steps = Array.from(document.querySelectorAll(".quiz-step"));
const nextButton = document.querySelector("#nextButton");
const backButton = document.querySelector("#backButton");
const stepNumber = document.querySelector("#stepNumber");
const totalSteps = document.querySelector("#totalSteps");
const progressBar = document.querySelector("#progressBar");
const quizMood = document.querySelector("#quizMood");
const archetypeTitle = document.querySelector("#archetypeTitle");
const archetypeText = document.querySelector("#archetypeText");
const elementName = document.querySelector("#elementName");
const elementSignal = document.querySelector("#elementSignal");
const recognitionText = document.querySelector("#recognitionText");
const meetingText = document.querySelector("#meetingText");
const releaseText = document.querySelector("#releaseText");
const adviceText = document.querySelector("#adviceText");
const previewEyebrow = document.querySelector("#previewEyebrow");
const previewTitle = document.querySelector("#previewTitle");
const previewIntro = document.querySelector("#previewIntro");
const portraitKicker = document.querySelector("#portraitKicker");
const quizValidation = document.querySelector("#quizValidation");
const cookieConsent = document.querySelector("#cookieConsent");
const cookieAccept = document.querySelector("#cookieAccept");
const paidSteps = Array.from(document.querySelectorAll(".paid-step"));
const paidNextButton = document.querySelector("#paidNextButton");
const paidBackButton = document.querySelector("#paidBackButton");
const paidStepNumber = document.querySelector("#paidStepNumber");
const paidTotalSteps = document.querySelector("#paidTotalSteps");
const paidProgressBar = document.querySelector("#paidProgressBar");
const paidQuizMood = document.querySelector("#paidQuizMood");
const paidComplete = document.querySelector("#paidComplete");
const paidCompleteMessage = document.querySelector("#paidCompleteMessage");
const paymentStatus = document.querySelector("#paymentStatus");
const unlockReportButton = document.querySelector("#unlockReportButton");
const checkoutEmailInput = document.querySelector("#checkoutEmail");
const readingSaveStatus = document.querySelector("#readingSaveStatus");
const paidSaveStatus = document.querySelector("#paidSaveStatus");
const paidValidation = document.querySelector("#paidValidation");
const shareCardPanel = document.querySelector("#shareCardPanel");
const shareCardPreview = document.querySelector("#shareCardPreview");
const shareImageButton = document.querySelector("#shareImageButton");
const downloadShareImageButton = document.querySelector("#downloadShareImageButton");
const shareStatus = document.querySelector("#shareStatus");

const apiBaseUrl = window.YLE_API_BASE_URL || "";
const readingStorageKey = "yle-reading-id";
const freeAnswersStorageKey = "yle-free-answers";
const cookieConsentStorageKey = "yle-cookie-consent";
const shareCardWidth = 1080;
const shareCardHeight = 1350;
const metaPixelId = String(window.YLE_META_PIXEL_ID || "").trim();
const monthDayLimits = {
  January: 31,
  February: 29,
  March: 31,
  April: 30,
  May: 31,
  June: 30,
  July: 31,
  August: 31,
  September: 30,
  October: 31,
  November: 30,
  December: 31,
};

const freeAnswerNames = ["status", "intent", "quality", "element", "setting", "block", "secure", "mirror", "pace"];
const paidAnswerNames = [
  "activation",
  "pastPattern",
  "reassurance",
  "conflict",
  "partnerEnergy",
  "boundary",
  "trustSignal",
  "guidance",
];

const moods = [
  "Your current chapter",
  "Your intention",
  "Your magnetic pull",
  "Your element profile",
  "Your meeting field",
  "Your old pattern",
  "Your secure signal",
  "Your mirror",
  "Your romantic pace",
  "Your birth signal",
];

const elementCopy = {
  Wood: "Growth-oriented love, patient timing, and a partner who helps your life expand.",
  Fire: "Magnetic chemistry, brave expression, and a relationship that asks for aliveness.",
  Earth: "Steady love, loyal timing, practical devotion, and a partner who feels emotionally solid.",
  Metal: "Clear standards, refined devotion, and a partner who respects your boundaries.",
  Water: "Intuitive depth, emotional tenderness, and a bond that begins beneath the surface.",
};

const elementShareCopy = {
  Wood: "Drawn to growth, patient timing, and becoming together.",
  Fire: "Drawn to aliveness, brave expression, and honest spark.",
  Earth: "Drawn to steady devotion, grounded care, and loyalty.",
  Metal: "Drawn to clear standards, refined devotion, and self-respect.",
  Water: "Drawn to emotional depth, quiet trust, and tenderness.",
};

const elementSharePalettes = {
  Wood: { accent: "#4f877b", deep: "#183f38", wash: "#9bbca4", pale: "#e4efe2", warm: "#c49a45" },
  Fire: { accent: "#b84d63", deep: "#6f263d", wash: "#d9988d", pale: "#f5ded9", warm: "#c49a45" },
  Earth: { accent: "#9b7650", deep: "#5a3d2e", wash: "#c5ad7d", pale: "#eee4ce", warm: "#c49a45" },
  Metal: { accent: "#64727a", deep: "#243640", wash: "#b8c1bf", pale: "#e7e9e5", warm: "#c49a45" },
  Water: { accent: "#0f6578", deep: "#102842", wash: "#79aebe", pale: "#e1eff0", warm: "#c49a45" },
};

const qualityProfiles = {
  "Emotional steadiness": {
    title: "The Grounded Visionary",
    partner: "calm, consistent, and quietly ambitious",
    recognition: "They listen before impressing you, remember small details, and make your nervous system feel less noisy.",
    pull: "Their presence feels steady before it feels dramatic, and that steadiness is part of the attraction.",
  },
  "Creative ambition": {
    title: "The Magnetic Builder",
    partner: "expressive, decisive, and self-directed",
    recognition: "They speak with momentum, follow through quickly, and make future plans feel energizing rather than heavy.",
    pull: "They may be building something of their own, and their focus gives the connection a sense of forward motion.",
  },
  "Warm intelligence": {
    title: "The Gentle Strategist",
    partner: "thoughtful, witty, and emotionally generous",
    recognition: "They ask unusually precise questions, notice your emotional shifts, and make honesty feel low-pressure.",
    pull: "The connection begins softly, then becomes difficult to ignore because the conversation keeps opening new doors.",
  },
  "Playful confidence": {
    title: "The Bright Companion",
    partner: "socially warm, expressive, and emotionally awake",
    recognition: "They make ordinary moments feel easier, include you naturally, and show interest without making you perform for it.",
    pull: "The bond may begin lightly, then deepen when their consistency proves their charm has real emotional weight.",
  },
};

let currentStep = 0;
let paidCurrentStep = 0;
let previewReadyForCheckout = false;
let currentReadingId = null;
let metaPixelLoaded = false;
let metaViewContentTracked = false;
let quizStartTracked = false;
let currentShareCardData = null;
let currentShareCardBlob = null;
let currentShareCardObjectUrl = null;

function getStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Browser storage is a convenience only; the backend remains authoritative.
  }
}

function getAttributionParams() {
  const params = new URLSearchParams(window.location.search);
  return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].reduce(
    (tracking, key) => {
      const value = params.get(key);
      if (value) {
        tracking[key] = value;
      }
      return tracking;
    },
    { page_path: window.location.pathname },
  );
}

function loadMetaPixel() {
  if (!metaPixelId || metaPixelLoaded) {
    return;
  }

  if (typeof window.fbq === "function") {
    metaPixelLoaded = true;
    trackHomepageViewContent();
    return;
  }

  /* Meta's standard Pixel bootstrap. */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) {
      return;
    }
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) {
      f._fbq = n;
    }
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", metaPixelId);
  window.fbq("consent", "grant");
  window.fbq("track", "PageView", getAttributionParams());
  metaPixelLoaded = true;
  trackHomepageViewContent();
}

function trackHomepageViewContent() {
  if (metaViewContentTracked || typeof window.fbq !== "function") {
    return;
  }
  if (window.location.pathname !== "/" && window.location.pathname !== "/index.html") {
    return;
  }
  window.fbq("track", "ViewContent", {
    content_name: "Free Love Element Reading",
    content_category: "Digital relationship reading",
    ...getAttributionParams(),
  });
  metaViewContentTracked = true;
}

function trackMetaEvent(name, params = {}) {
  loadMetaPixel();
  if (typeof window.fbq !== "function") {
    return;
  }
  window.fbq("track", name, {
    ...getAttributionParams(),
    ...params,
  });
}

function trackMetaCustomEvent(name, params = {}) {
  loadMetaPixel();
  if (typeof window.fbq !== "function") {
    return;
  }
  window.fbq("trackCustom", name, {
    ...getAttributionParams(),
    ...params,
  });
}

function setStatus(element, message, tone = "neutral") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = false;
}

function clearStatus(element) {
  if (!element) {
    return;
  }

  element.textContent = "";
  element.hidden = true;
  delete element.dataset.tone;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawTrackedText(ctx, text, centerX, y, tracking) {
  const letters = Array.from(text);
  const totalWidth = letters.reduce((width, letter, index) => {
    return width + ctx.measureText(letter).width + (index === letters.length - 1 ? 0 : tracking);
  }, 0);
  let x = centerX - totalWidth / 2;

  letters.forEach((letter) => {
    ctx.fillText(letter, x, y);
    x += ctx.measureText(letter).width + tracking;
  });
}

function wrapCanvasText(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !line) {
      line = testLine;
      return;
    }
    lines.push(line);
    line = word;
  });

  if (line) {
    lines.push(line);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines);
  let lastLine = visibleLines[visibleLines.length - 1] || "";
  while (ctx.measureText(`${lastLine}...`).width > maxWidth && lastLine.includes(" ")) {
    lastLine = lastLine.replace(/\s+\S+$/, "");
  }
  visibleLines[visibleLines.length - 1] = `${lastLine}...`;
  return visibleLines;
}

function drawCenteredWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapCanvasText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawPaperTexture(ctx) {
  ctx.fillStyle = "#fbf6ed";
  ctx.fillRect(0, 0, shareCardWidth, shareCardHeight);

  const warmWash = ctx.createLinearGradient(0, 0, shareCardWidth, shareCardHeight);
  warmWash.addColorStop(0, "rgba(255, 252, 245, 0.92)");
  warmWash.addColorStop(0.48, "rgba(250, 241, 226, 0.72)");
  warmWash.addColorStop(1, "rgba(255, 247, 235, 0.9)");
  ctx.fillStyle = warmWash;
  ctx.fillRect(0, 0, shareCardWidth, shareCardHeight);

  for (let i = 0; i < 720; i += 1) {
    const x = (i * 97) % shareCardWidth;
    const y = (i * 193) % shareCardHeight;
    const alpha = 0.018 + ((i % 7) * 0.004);
    ctx.fillStyle = `rgba(65, 50, 36, ${alpha})`;
    ctx.fillRect(x, y, 1 + (i % 3), 1);
  }
}

function drawOrnateBorder(ctx) {
  ctx.save();
  ctx.strokeStyle = "rgba(94, 75, 49, 0.18)";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 58, 56, 964, 1238, 36);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 72, 70, 936, 1210, 28);
  ctx.stroke();

  ctx.strokeStyle = "rgba(94, 75, 49, 0.14)";
  ctx.lineWidth = 2;
  [
    [58, 136, 140, 56],
    [940, 56, 1022, 136],
    [58, 1214, 140, 1294],
    [940, 1294, 1022, 1214],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2, x2, y2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawHeartLogo(ctx, palette, x, y) {
  ctx.save();
  ctx.strokeStyle = palette.warm;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 24);
  ctx.bezierCurveTo(x - 48, y - 4, x - 22, y - 34, x, y - 12);
  ctx.bezierCurveTo(x + 22, y - 34, x + 48, y - 4, x, y + 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 28, y + 18);
  ctx.lineTo(x - 42, y + 34);
  ctx.moveTo(x + 28, y + 18);
  ctx.lineTo(x + 42, y + 34);
  ctx.stroke();
  ctx.restore();
}

function drawLeafSprig(ctx, palette) {
  ctx.save();
  ctx.translate(888, 42);
  ctx.rotate(-0.28);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.44;
  ctx.beginPath();
  ctx.moveTo(86, -26);
  ctx.bezierCurveTo(40, 90, 92, 210, -6, 338);
  ctx.stroke();

  for (let i = 0; i < 6; i += 1) {
    const y = 30 + i * 52;
    const side = i % 2 === 0 ? -1 : 1;
    ctx.save();
    ctx.translate(side * 24, y);
    ctx.rotate(side * -0.72);
    ctx.fillStyle = palette.wash;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28 + i * 2, 74 - i * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.deep;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(0, -54);
    ctx.lineTo(0, 54);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawWatercolorMarks(ctx, palette) {
  ctx.save();
  ctx.globalAlpha = 0.46;
  const waveGradient = ctx.createLinearGradient(0, 1040, 760, 1330);
  waveGradient.addColorStop(0, palette.accent);
  waveGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = waveGradient;
  ctx.beginPath();
  ctx.moveTo(-40, 1168);
  ctx.bezierCurveTo(96, 1078, 184, 1124, 292, 1064);
  ctx.bezierCurveTo(398, 1006, 468, 1076, 584, 1038);
  ctx.bezierCurveTo(428, 1196, 232, 1308, -42, 1332);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 6;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(32 + i * 18, 1124 + i * 22);
    ctx.bezierCurveTo(168, 1056 + i * 10, 260, 1164 + i * 4, 394, 1096 + i * 18);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 47) % 350;
    const y = 882 + ((i * 71) % 260);
    ctx.fillStyle = i % 4 === 0 ? palette.warm : palette.accent;
    ctx.beginPath();
    ctx.arc(x, y, 3 + (i % 6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTinyDivider(ctx, palette, y, icon = "heart") {
  ctx.save();
  ctx.strokeStyle = palette.warm;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(398, y);
  ctx.lineTo(494, y);
  ctx.moveTo(586, y);
  ctx.lineTo(682, y);
  ctx.stroke();

  ctx.fillStyle = palette.warm;
  ctx.font = '700 26px Inter, system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon === "drop" ? "◇" : "♥", 540, y + 1);
  ctx.restore();
}

function drawElementLines(ctx, palette) {
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 3; i += 1) {
    const y = 680 + i * 18;
    ctx.beginPath();
    ctx.moveTo(450, y);
    ctx.bezierCurveTo(495, y - 24, 530, y + 22, 574, y);
    ctx.bezierCurveTo(608, y - 16, 648, y + 10, 680, y - 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFiveElementSeal(ctx, palette, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(196, 154, 69, 0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 76, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 55, 0, Math.PI * 2);
  ctx.stroke();

  const points = [
    [0, -42, "#d8a74f", "◎"],
    [42, -4, "#0f6578", "≈"],
    [25, 42, "#64727a", "△"],
    [-25, 42, "#b84d63", "♢"],
    [-42, -4, "#4f877b", "◌"],
  ];

  ctx.font = '700 30px Inter, system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  points.forEach(([px, py, color, mark]) => {
    ctx.fillStyle = "#fbf6ed";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(mark, px, py + 1);
  });

  ctx.strokeStyle = "rgba(196, 154, 69, 0.56)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = palette.warm;
  ctx.font = '800 30px Inter, system-ui, sans-serif';
  ctx.fillText("♥", 0, 8);
  ctx.restore();
}

function drawBrushUrl(ctx, palette) {
  ctx.save();
  ctx.fillStyle = palette.deep;
  ctx.beginPath();
  ctx.moveTo(238, 1206);
  ctx.bezierCurveTo(388, 1180, 618, 1184, 846, 1198);
  ctx.bezierCurveTo(826, 1240, 446, 1244, 242, 1238);
  ctx.bezierCurveTo(220, 1228, 214, 1214, 238, 1206);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fffaf5";
  ctx.font = '700 38px Inter, system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("yourloveelement.com", 540, 1219);
  ctx.restore();
}

function shareCardFileName() {
  const element = String(currentShareCardData?.element || "love-element").toLowerCase();
  return `your-love-element-${element}.png`;
}

function setShareButtonsLoading(isLoading) {
  if (shareImageButton) {
    shareImageButton.disabled = isLoading;
  }
  if (downloadShareImageButton) {
    downloadShareImageButton.disabled = isLoading;
  }
}

async function createShareCardBlob(data) {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  const canvas = document.createElement("canvas");
  canvas.width = shareCardWidth;
  canvas.height = shareCardHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available");
  }

  const palette = elementSharePalettes[data.element] || elementSharePalettes.Water;
  const title = data.title || "Your Love Element";
  const description = data.description || elementCopy[data.element] || "A private love signal from Your Love Element.";

  drawPaperTexture(ctx);
  drawOrnateBorder(ctx);
  drawLeafSprig(ctx, palette);
  drawWatercolorMarks(ctx, palette);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  drawHeartLogo(ctx, palette, 540, 114);

  ctx.font = '800 32px Inter, system-ui, sans-serif';
  ctx.fillStyle = palette.deep;
  drawTrackedText(ctx, "YOUR LOVE ELEMENT", 540, 198, 6);
  drawTinyDivider(ctx, palette, 236, "heart");

  ctx.font = '700 76px "Playfair Display", Georgia, serif';
  ctx.fillStyle = palette.deep;
  ctx.fillText("My Love Element is", 540, 356);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = palette.accent;
  ctx.font = '700 190px "Playfair Display", Georgia, serif';
  ctx.fillText(data.element, 540, 592);
  ctx.restore();

  ctx.font = '700 212px "Playfair Display", Georgia, serif';
  ctx.fillStyle = palette.accent;
  ctx.fillText(data.element, 540, 588);
  drawTinyDivider(ctx, palette, 642, "drop");
  drawElementLines(ctx, palette);

  ctx.font = '700 64px "Playfair Display", Georgia, serif';
  ctx.fillStyle = palette.deep;
  drawCenteredWrappedText(ctx, title, 540, 804, 850, 74, 2);
  drawTinyDivider(ctx, palette, 856, "heart");

  ctx.font = '500 42px Inter, system-ui, sans-serif';
  ctx.fillStyle = palette.deep;
  drawCenteredWrappedText(ctx, description, 540, 916, 680, 56, 3);

  drawFiveElementSeal(ctx, palette, 540, 1076);
  drawBrushUrl(ctx, palette);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Share image could not be created"));
    }, "image/png", 0.96);
  });
}

async function prepareShareCard(data) {
  if (!shareCardPanel || !shareCardPreview) {
    return;
  }

  currentShareCardData = data;
  currentShareCardBlob = null;
  shareCardPanel.hidden = false;
  setShareButtonsLoading(true);
  setStatus(shareStatus, "Creating your share image...", "neutral");

  try {
    const blob = await createShareCardBlob(data);
    currentShareCardBlob = blob;
    if (currentShareCardObjectUrl) {
      URL.revokeObjectURL(currentShareCardObjectUrl);
    }
    currentShareCardObjectUrl = URL.createObjectURL(blob);
    shareCardPreview.src = currentShareCardObjectUrl;
    clearStatus(shareStatus);
    setShareButtonsLoading(false);
    trackMetaCustomEvent("share_card_generated", {
      element: data.element,
      archetype: data.title,
    });
  } catch {
    setShareButtonsLoading(false);
    setStatus(shareStatus, "The share image could not be created in this browser.", "error");
  }
}

async function ensureShareCardBlob() {
  if (currentShareCardBlob) {
    return currentShareCardBlob;
  }
  if (!currentShareCardData) {
    throw new Error("Reveal your preview before creating a share card.");
  }
  currentShareCardBlob = await createShareCardBlob(currentShareCardData);
  return currentShareCardBlob;
}

async function downloadShareCard() {
  try {
    setShareButtonsLoading(true);
    const blob = await ensureShareCardBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = shareCardFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setShareButtonsLoading(false);
    setStatus(shareStatus, "Share image downloaded.", "success");
    trackMetaCustomEvent("share_card_downloaded", {
      element: currentShareCardData?.element,
    });
  } catch {
    setShareButtonsLoading(false);
    setStatus(shareStatus, "The share image could not be downloaded in this browser.", "error");
  }
}

async function shareCardImage() {
  try {
    setShareButtonsLoading(true);
    const blob = await ensureShareCardBlob();
    const file = new File([blob], shareCardFileName(), { type: "image/png" });
    const sharePayload = {
      title: `My Love Element is ${currentShareCardData?.element || "ready"}`,
      text: `My Love Element is ${currentShareCardData?.element || "ready"}. Take the free reading and discover yours:`,
      url: "https://yourloveelement.com/",
      files: [file],
    };

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share(sharePayload);
      setShareButtonsLoading(false);
      setStatus(shareStatus, "Share image sent.", "success");
      trackMetaCustomEvent("share_card_shared", {
        element: currentShareCardData?.element,
      });
      return;
    }

    setShareButtonsLoading(false);
    setStatus(shareStatus, "Sharing is not available here, so the image was downloaded instead.", "neutral");
    await downloadShareCard();
  } catch (error) {
    setShareButtonsLoading(false);
    if (error?.name === "AbortError") {
      clearStatus(shareStatus);
      return;
    }
    setStatus(shareStatus, "The share sheet could not be opened in this browser.", "error");
  }
}

function collectAnswers(form, names) {
  return names.reduce((answers, name) => {
    const field = form?.elements?.[name];

    if (!field) {
      return answers;
    }

    if (field instanceof RadioNodeList) {
      answers[name] = field.value.trim();
      return answers;
    }

    answers[name] = String(field.value || "").trim();
    return answers;
  }, {});
}

function activeRadioValue(step) {
  return step?.querySelector('input[type="radio"]:checked')?.value || "";
}

function lowerInitial(value) {
  if (!value) {
    return "";
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function validateBirthdate(form) {
  const month = form?.elements?.month?.value || "";
  const day = Number(form?.elements?.day?.value);
  const maxDay = monthDayLimits[month] || 31;
  return Boolean(month && Number.isInteger(day) && day >= 1 && day <= maxDay);
}

function syncBirthDayLimit(form) {
  const month = form?.elements?.month?.value || "";
  const dayField = form?.elements?.day;
  if (!dayField) {
    return;
  }

  const maxDay = monthDayLimits[month] || 31;
  dayField.max = String(maxDay);
  dayField.setAttribute("aria-label", month ? `Birth day, 1 to ${maxDay}` : "Birth day");

  if (Number(dayField.value) > maxDay) {
    dayField.value = "";
  }
}

function showValidation(target, step, message) {
  setStatus(target, message, "error");
  step?.setAttribute("data-invalid", "true");
}

function clearStepValidation(target, step) {
  clearStatus(target);
  step?.removeAttribute("data-invalid");
}

function validateStep(step, target, form) {
  if (!step) {
    return true;
  }

  if (step.querySelector(".date-grid")) {
    const isValid = validateBirthdate(form);
    if (!isValid) {
      showValidation(target, step, "Choose a valid day for the selected birth month.");
      return false;
    }
    clearStepValidation(target, step);
    return true;
  }

  if (!activeRadioValue(step)) {
    showValidation(target, step, "Choose one answer to continue.");
    return false;
  }

  clearStepValidation(target, step);
  return true;
}

function hasAllAnswers(answers, names) {
  return names.every((name) => Boolean(answers[name]));
}

function getFreeAnswers() {
  const form = document.querySelector("#reading");
  const answers = collectAnswers(form, freeAnswerNames);
  const birthdate = {
    month: String(form?.elements?.month?.value || "").trim(),
    day: String(form?.elements?.day?.value || "").trim(),
  };

  if (!hasAllAnswers(answers, freeAnswerNames) || !validateBirthdate(form)) {
    throw new Error("Free reading is incomplete");
  }

  return {
    ...answers,
    birthdate,
  };
}

function getPaidAnswers() {
  const answers = collectAnswers(document.querySelector("#paidSignals"), paidAnswerNames);
  if (!hasAllAnswers(answers, paidAnswerNames)) {
    throw new Error("Paid signals are incomplete");
  }
  return answers;
}

function getReadingIdFromUrl() {
  return new URLSearchParams(window.location.search).get("reading_id");
}

async function apiPost(path, payload) {
  if (!apiBaseUrl) {
    throw new Error("API is not configured yet");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function apiGet(path) {
  if (!apiBaseUrl) {
    throw new Error("API is not configured yet");
  }

  const response = await fetch(`${apiBaseUrl}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function saveFreeAnswers() {
  let answers;
  try {
    answers = getFreeAnswers();
  } catch {
    setStatus(readingSaveStatus, "Complete the 10-question free reading before checkout.", "error");
    return null;
  }

  setStorageItem(freeAnswersStorageKey, JSON.stringify(answers));

  if (!apiBaseUrl) {
    setStatus(readingSaveStatus, "Preview saved in this browser. Checkout automation will activate after payment setup.", "neutral");
    return null;
  }

  setStatus(readingSaveStatus, "Saving your preview...", "neutral");
  const result = await apiPost("/api/readings", { free_answers: answers });
  setStorageItem(readingStorageKey, result.reading_id);
  setStatus(readingSaveStatus, "Preview saved. Your full report can now connect to this reading.", "success");
  return result.reading_id;
}

async function startCheckout(event) {
  if (!apiBaseUrl) {
    return;
  }

  event.preventDefault();
  if (!previewReadyForCheckout) {
    setStatus(readingSaveStatus, "Complete the 10-question free reading and reveal your preview before checkout.", "error");
    document.querySelector("#reading")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const checkoutEmail = String(checkoutEmailInput?.value || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutEmail)) {
    setStatus(readingSaveStatus, "Enter the email address where your full report should be delivered.", "error");
    checkoutEmailInput?.focus();
    return;
  }

  const readingId = currentReadingId || (await saveFreeAnswers());
  if (!readingId) {
    setStatus(readingSaveStatus, "Please reveal your preview before checkout.", "error");
    return;
  }

  setStatus(readingSaveStatus, "Creating secure checkout...", "neutral");
  try {
    const result = await apiPost("/api/create-checkout", {
      reading_id: readingId,
      email: checkoutEmail,
    });
    trackMetaEvent("InitiateCheckout", {
      content_name: "Full Relationship Report",
      content_category: "Digital relationship reading",
      value: 9.99,
      currency: "USD",
    });
    trackMetaCustomEvent("checkout_created", {
      reading_id: readingId,
      value: 9.99,
      currency: "USD",
    });
    window.location.href = result.checkout_url;
  } catch (error) {
    setStatus(readingSaveStatus, "Checkout is not available yet. Please contact support.", "error");
  }
}

function updateStep() {
  steps.forEach((step, index) => {
    step.classList.toggle("is-active", index === currentStep);
  });

  stepNumber.textContent = String(currentStep + 1);
  totalSteps.textContent = String(steps.length);
  progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  quizMood.textContent = moods[currentStep];
  backButton.disabled = currentStep === 0;
  nextButton.textContent = currentStep === steps.length - 1 ? "Reveal preview" : "Continue";
}

function selectedValue(name) {
  return document.querySelector(`#reading input[name="${name}"]:checked`)?.value || "";
}

function buildPortraitText({ status, intent, quality, setting, element, block, secure, pace }) {
  const profile = qualityProfiles[quality];
  const elementLine = elementCopy[element];

  return `Because you selected "${status}", your future partner portrait begins with someone ${profile.partner}. ${profile.pull} You are not simply looking for a spark; you are looking for a person whose rhythm helps you explore "${intent}" without making love feel like a test.\n\nYour ${element} profile adds an important layer: ${elementLine} This suggests that the person who fits you best will not only match your chemistry, but also support the kind of emotional climate where ${lowerInitial(secure)} can become ordinary. The meeting signal points toward ${lowerInitial(setting)}, especially when the pace feels ${lowerInitial(pace)} rather than forced.\n\nThe pattern to watch is ${lowerInitial(block)}. If that old signal appears, pause before deciding whether it is intuition or protection. Your preview suggests your next meaningful connection should feel clear enough to soften your guard, but grounded enough that you do not have to chase certainty.`;
}

async function revealPreview() {
  let answers;
  try {
    answers = getFreeAnswers();
  } catch {
    setStatus(quizValidation, "Complete every question before revealing your preview.", "error");
    return;
  }

  const { quality, setting, status, element, block, secure, intent, pace } = answers;
  const profile = qualityProfiles[quality];

  if (previewEyebrow) {
    previewEyebrow.textContent = "Your free preview report";
  }
  if (previewTitle) {
    previewTitle.textContent = "Your first love signal, before the full map.";
  }
  if (previewIntro) {
    previewIntro.textContent = "Your preview is based on the 10 answers you just gave. The full report adds eight deeper signals when you are ready for more precision.";
  }
  if (portraitKicker) {
    portraitKicker.textContent = "Future partner portrait";
  }
  archetypeTitle.textContent = profile.title;
  archetypeText.textContent = buildPortraitText({ status, intent, quality, setting, element, block, secure, pace });
  elementName.textContent = `${element} profile`;
  elementSignal.textContent = elementCopy[element];
  recognitionText.textContent = profile.recognition;
  meetingText.textContent = `Your strongest meeting signal is ${lowerInitial(setting)}, especially when the pace feels ${lowerInitial(pace)} rather than forced.`;
  releaseText.textContent = `${block} may be the pattern to watch. Your preview suggests you should not confuse intensity with emotional alignment.`;
  adviceText.textContent = `Because you are seeking "${intent}", choose the person who makes ${lowerInitial(secure)} feel possible in ordinary life.`;
  prepareShareCard({
    element,
    title: profile.title,
    description: elementShareCopy[element] || elementCopy[element],
  });

  document.querySelector("#preview").scrollIntoView({ behavior: "smooth", block: "start" });
  trackMetaCustomEvent("preview_revealed", {
    element,
    relationship_status: status,
    intent,
  });

  try {
    currentReadingId = await saveFreeAnswers();
    previewReadyForCheckout = Boolean(currentReadingId);
    if (unlockReportButton) {
      unlockReportButton.removeAttribute("aria-disabled");
      unlockReportButton.textContent = "Unlock full report - $9.99";
    }
  } catch {
    previewReadyForCheckout = false;
    setStatus(readingSaveStatus, "Your preview is visible, but online saving is temporarily unavailable.", "error");
  }
}

function initQuiz() {
  if (!steps.length || !nextButton || !backButton) {
    return;
  }

  nextButton.addEventListener("click", () => {
    const current = steps[currentStep];
    if (!validateStep(current, quizValidation, document.querySelector("#reading"))) {
      return;
    }

    if (!quizStartTracked) {
      trackMetaCustomEvent("quiz_start");
      quizStartTracked = true;
    }

    if (currentStep < steps.length - 1) {
      currentStep += 1;
      updateStep();
      return;
    }

    revealPreview();
  });

  backButton.addEventListener("click", () => {
    if (currentStep > 0) {
      clearStepValidation(quizValidation, steps[currentStep]);
      currentStep -= 1;
      updateStep();
    }
  });

  const form = document.querySelector("#reading");
  form?.addEventListener("change", () => {
    syncBirthDayLimit(form);
    previewReadyForCheckout = false;
    currentReadingId = null;
    if (unlockReportButton) {
      unlockReportButton.setAttribute("aria-disabled", "true");
      unlockReportButton.textContent = "Reveal free preview first";
    }
    validateStep(steps[currentStep], quizValidation, form);
  });

  syncBirthDayLimit(form);
  updateStep();
}

const paidMoods = [
  "Attachment pattern",
  "Past pattern",
  "Reassurance need",
  "Conflict style",
  "Partner energy",
  "Boundaries",
  "Trust signal",
  "30-day guidance",
];

function updatePaidStep() {
  paidSteps.forEach((step, index) => {
    step.classList.toggle("is-active", index === paidCurrentStep);
  });

  paidStepNumber.textContent = String(paidCurrentStep + 1);
  paidTotalSteps.textContent = String(paidSteps.length);
  paidProgressBar.style.width = `${((paidCurrentStep + 1) / paidSteps.length) * 100}%`;
  paidQuizMood.textContent = paidMoods[paidCurrentStep];
  paidBackButton.disabled = paidCurrentStep === 0;
  paidNextButton.textContent = paidCurrentStep === paidSteps.length - 1 ? "Finish signals" : "Continue";
}

async function completePaidSignals() {
  let paidAnswers;
  try {
    paidAnswers = getPaidAnswers();
  } catch {
    setStatus(paidValidation, "Complete every deeper signal before finishing.", "error");
    return;
  }

  paidSteps.forEach((step) => {
    step.classList.remove("is-active");
  });
  paidNextButton.disabled = true;
  setStatus(paidSaveStatus, "Saving your deeper signals...", "neutral");

  const readingId = getReadingIdFromUrl() || getStorageItem(readingStorageKey);
  if (apiBaseUrl && readingId) {
    try {
      const result = await apiPost(`/api/readings/${readingId}/paid-signals`, { paid_answers: paidAnswers });
      const verified = Boolean(result.payment_verified || result.queued);
      setStatus(
        paidSaveStatus,
        verified
          ? "Your deeper signals were saved. Report generation will start shortly."
          : "Your deeper signals were saved, but payment has not been verified for this reading yet.",
        verified ? "success" : "error",
      );
      if (paidCompleteMessage) {
        paidCompleteMessage.textContent = verified
          ? "Your answers were received. Your full report will be generated and delivered to your email shortly."
          : "Your answers were received, but this reading is not connected to a verified payment yet. If you already purchased, open the full-report link from your Lemon Squeezy receipt or contact support with your order email.";
      }
      trackMetaCustomEvent("paid_signals_submitted", {
        reading_id: readingId,
      });
    } catch {
      setStorageItem("yle-paid-answers", JSON.stringify(paidAnswers));
      setStatus(paidSaveStatus, "Your answers are saved in this browser, but online delivery needs support.", "error");
      if (paidCompleteMessage) {
        paidCompleteMessage.textContent = "Your answers are saved in this browser, but this reading could not be verified online. If you already purchased, contact support with your order email.";
      }
    }
  } else {
    setStorageItem("yle-paid-answers", JSON.stringify(paidAnswers));
    setStatus(paidSaveStatus, "Your answers are saved in this browser. Contact support if you already purchased.", "neutral");
    if (paidCompleteMessage) {
      paidCompleteMessage.textContent = "Your answers are saved in this browser, but no paid checkout link was found. If you already purchased, open the full-report link from your Lemon Squeezy receipt or contact support with your order email.";
    }
  }

  paidNextButton.hidden = true;
  paidBackButton.hidden = true;
  paidComplete.hidden = false;
  paidProgressBar.style.width = "100%";
  paidQuizMood.textContent = "Ready for report";
}

function initPaidQuiz() {
  if (!paidSteps.length || !paidNextButton || !paidBackButton) {
    return;
  }

  initPaymentStatus();

  paidNextButton.addEventListener("click", () => {
    const current = paidSteps[paidCurrentStep];
    if (!validateStep(current, paidValidation, document.querySelector("#paidSignals"))) {
      return;
    }

    if (paidCurrentStep < paidSteps.length - 1) {
      paidCurrentStep += 1;
      updatePaidStep();
      return;
    }

    completePaidSignals();
  });

  paidBackButton.addEventListener("click", () => {
    if (paidCurrentStep > 0) {
      clearStepValidation(paidValidation, paidSteps[paidCurrentStep]);
      paidCurrentStep -= 1;
      updatePaidStep();
    }
  });

  document.querySelector("#paidSignals")?.addEventListener("change", () => {
    validateStep(paidSteps[paidCurrentStep], paidValidation, document.querySelector("#paidSignals"));
  });

  updatePaidStep();
}

async function initPaymentStatus() {
  if (!paymentStatus || !paidSteps.length) {
    return;
  }

  const readingId = getReadingIdFromUrl() || getStorageItem(readingStorageKey);
  if (!readingId) {
    setStatus(
      paymentStatus,
      "No paid checkout is linked to this page yet. Start from the free preview, unlock the full report, then return here from the Lemon Squeezy receipt link.",
      "warning",
    );
    return;
  }

  if (!apiBaseUrl) {
    setStatus(paymentStatus, "Payment verification is not available in this browser session. Your answers can still be saved locally.", "warning");
    return;
  }

  try {
    const status = await apiGet(`/api/readings/${readingId}/status`);
    if (status.payment_verified) {
      setStatus(paymentStatus, "Payment verified. Complete these 8 signals to generate your full report.", "success");
      return;
    }

    setStatus(
      paymentStatus,
      "This reading is not connected to a verified payment yet. If you already purchased, use the full-report link from your Lemon Squeezy receipt; otherwise, return to the free preview and unlock the full report first.",
      "warning",
    );
  } catch {
    setStatus(paymentStatus, "We could not verify this reading link. If you already purchased, contact support with your order email.", "error");
  }
}

function initCookieConsent() {
  loadMetaPixel();

  if (!cookieConsent || !cookieAccept) {
    return;
  }

  const canStoreChoice = (() => {
    try {
      localStorage.setItem(`${cookieConsentStorageKey}-test`, "1");
      localStorage.removeItem(`${cookieConsentStorageKey}-test`);
      return true;
    } catch {
      return false;
    }
  })();

  const storedChoice = canStoreChoice ? localStorage.getItem(cookieConsentStorageKey) : null;
  if (!storedChoice) {
    cookieConsent.hidden = false;
  }

  function saveChoice() {
    if (canStoreChoice) {
      localStorage.setItem(cookieConsentStorageKey, "acknowledged");
    }
    cookieConsent.hidden = true;
  }

  cookieAccept.addEventListener("click", saveChoice);
}

initQuiz();
initPaidQuiz();
initCookieConsent();

if (unlockReportButton) {
  unlockReportButton.addEventListener("click", startCheckout);
}

if (shareImageButton) {
  shareImageButton.addEventListener("click", shareCardImage);
}

if (downloadShareImageButton) {
  downloadShareImageButton.addEventListener("click", downloadShareCard);
}
