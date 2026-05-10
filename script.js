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
const cookieReject = document.querySelector("#cookieReject");
const paidSteps = Array.from(document.querySelectorAll(".paid-step"));
const paidNextButton = document.querySelector("#paidNextButton");
const paidBackButton = document.querySelector("#paidBackButton");
const paidStepNumber = document.querySelector("#paidStepNumber");
const paidTotalSteps = document.querySelector("#paidTotalSteps");
const paidProgressBar = document.querySelector("#paidProgressBar");
const paidQuizMood = document.querySelector("#paidQuizMood");
const paidComplete = document.querySelector("#paidComplete");
const unlockReportButton = document.querySelector("#unlockReportButton");
const readingSaveStatus = document.querySelector("#readingSaveStatus");
const paidSaveStatus = document.querySelector("#paidSaveStatus");
const paidValidation = document.querySelector("#paidValidation");

const apiBaseUrl = window.YLE_API_BASE_URL || "";
const readingStorageKey = "yle-reading-id";
const freeAnswersStorageKey = "yle-free-answers";

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
  return Boolean(month && Number.isInteger(day) && day >= 1 && day <= 31);
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
      showValidation(target, step, "Choose your birth month and enter a day between 1 and 31.");
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
  const existingReadingId = getStorageItem(readingStorageKey);
  const readingId = existingReadingId || (await saveFreeAnswers());
  if (!readingId) {
    setStatus(readingSaveStatus, "Please reveal your preview before checkout.", "error");
    return;
  }

  setStatus(readingSaveStatus, "Creating secure checkout...", "neutral");
  try {
    const result = await apiPost("/api/create-checkout", { reading_id: readingId });
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

  document.querySelector("#preview").scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    await saveFreeAnswers();
  } catch {
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

  document.querySelector("#reading")?.addEventListener("change", () => {
    validateStep(steps[currentStep], quizValidation, document.querySelector("#reading"));
  });

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
      await apiPost(`/api/readings/${readingId}/paid-signals`, { paid_answers: paidAnswers });
      setStatus(paidSaveStatus, "Your deeper signals were saved.", "success");
    } catch {
      setStatus(paidSaveStatus, "Your answers are saved in this browser, but online delivery needs support.", "error");
    }
  } else {
    setStorageItem("yle-paid-answers", JSON.stringify(paidAnswers));
    setStatus(paidSaveStatus, "Your answers are saved in this browser. Contact support if you already purchased.", "neutral");
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

function initCookieConsent() {
  if (!cookieConsent || !cookieAccept || !cookieReject) {
    return;
  }

  const storageKey = "yle-cookie-consent";
  const canStoreChoice = (() => {
    try {
      localStorage.setItem(`${storageKey}-test`, "1");
      localStorage.removeItem(`${storageKey}-test`);
      return true;
    } catch {
      return false;
    }
  })();

  const storedChoice = canStoreChoice ? localStorage.getItem(storageKey) : null;
  if (!storedChoice) {
    cookieConsent.hidden = false;
  }

  function saveChoice(choice) {
    if (canStoreChoice) {
      localStorage.setItem(storageKey, choice);
    }
    cookieConsent.hidden = true;
  }

  cookieAccept.addEventListener("click", () => saveChoice("all"));
  cookieReject.addEventListener("click", () => saveChoice("essential"));
}

initQuiz();
initPaidQuiz();
initCookieConsent();

if (unlockReportButton) {
  unlockReportButton.addEventListener("click", startCheckout);
}
