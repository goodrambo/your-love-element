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
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function buildPortraitText({ status, intent, quality, setting, element, block, secure, pace }) {
  const profile = qualityProfiles[quality] || qualityProfiles["Warm intelligence"];
  const elementLine = elementCopy[element] || elementCopy.Earth;

  return `Because you selected ${status.toLowerCase()}, your future partner portrait begins with someone ${profile.partner}. ${profile.pull} You are not simply looking for a spark; you are looking for a person whose rhythm helps you understand ${intent.toLowerCase()} without making love feel like a test.\n\nYour ${element} profile adds an important layer: ${elementLine} This suggests that the person who fits you best will not only match your chemistry, but also support the kind of emotional climate where ${secure.toLowerCase()} can become ordinary. The meeting signal points toward ${setting.toLowerCase()}, especially when the pace feels ${pace.toLowerCase()} rather than forced.\n\nThe pattern to watch is ${block.toLowerCase()}. If that old signal appears, pause before deciding whether it is intuition or protection. Your preview suggests your next meaningful connection should feel clear enough to soften your guard, but grounded enough that you do not have to chase certainty.`;
}

function revealPreview() {
  const quality = selectedValue("quality") || "Warm intelligence";
  const setting = selectedValue("setting") || "A friend's wider circle";
  const status = selectedValue("status") || "Open to something new";
  const element = selectedValue("element") || "Earth";
  const block = selectedValue("block") || "Mixed signals";
  const secure = selectedValue("secure") || "A quiet home base";
  const intent = selectedValue("intent") || "Who I naturally attract";
  const pace = selectedValue("pace") || "Slow and certain";

  const profile = qualityProfiles[quality] || qualityProfiles["Warm intelligence"];
  archetypeTitle.textContent = profile.title;
  archetypeText.textContent = buildPortraitText({ status, intent, quality, setting, element, block, secure, pace });
  elementName.textContent = `${element} profile`;
  elementSignal.textContent = elementCopy[element];
  recognitionText.textContent = profile.recognition;
  meetingText.textContent = `Your strongest meeting signal is ${setting.toLowerCase()}, especially when the pace feels ${pace.toLowerCase()} rather than forced.`;
  releaseText.textContent = `${block} may be the pattern to watch. Your preview suggests you should not confuse intensity with emotional alignment.`;
  adviceText.textContent = `Because you are seeking ${intent.toLowerCase()}, choose the person who makes ${secure.toLowerCase()} feel possible in ordinary life.`;

  document.querySelector("#preview").scrollIntoView({ behavior: "smooth", block: "start" });
}

function initQuiz() {
  if (!steps.length || !nextButton || !backButton) {
    return;
  }

  nextButton.addEventListener("click", () => {
    if (currentStep < steps.length - 1) {
      currentStep += 1;
      updateStep();
      return;
    }

    revealPreview();
  });

  backButton.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep -= 1;
      updateStep();
    }
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

function completePaidSignals() {
  paidSteps.forEach((step) => {
    step.classList.remove("is-active");
  });
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
    if (paidCurrentStep < paidSteps.length - 1) {
      paidCurrentStep += 1;
      updatePaidStep();
      return;
    }

    completePaidSignals();
  });

  paidBackButton.addEventListener("click", () => {
    if (paidCurrentStep > 0) {
      paidCurrentStep -= 1;
      updatePaidStep();
    }
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
