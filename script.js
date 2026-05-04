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

const moods = [
  "Your current chapter",
  "Your magnetic pull",
  "Your element profile",
  "Your meeting field",
  "Your old pattern",
  "Your secure signal",
  "Your mirror",
  "Your romantic pace",
  "Your intention",
  "Your birth signal",
];

const elementCopy = {
  Wood: "Growth-oriented love, patient timing, and a partner who helps your life expand.",
  Fire: "Magnetic chemistry, brave expression, and a relationship that asks for aliveness.",
  Earth: "Steady love, loyal timing, practical devotion, and a partner who feels emotionally solid.",
  Metal: "Clear standards, refined devotion, and a partner who respects your boundaries.",
  Water: "Intuitive depth, emotional tenderness, and a bond that begins beneath the surface.",
};

let currentStep = 0;

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

function revealPreview() {
  const quality = selectedValue("quality") || "Warm intelligence";
  const setting = selectedValue("setting") || "A friend's wider circle";
  const status = selectedValue("status") || "Open to something new";
  const element = selectedValue("element") || "Earth";
  const block = selectedValue("block") || "Mixed signals";
  const secure = selectedValue("secure") || "A quiet home base";
  const intent = selectedValue("intent") || "Who I naturally attract";
  const pace = selectedValue("pace") || "Slow and certain";

  const archetypes = {
    "Emotional steadiness": [
      "The Grounded Visionary",
      `Because you selected ${status.toLowerCase()}, your strongest romantic pull is toward someone calm, consistent, and quietly ambitious. This person may not feel loud at first; they feel trustworthy before they feel thrilling.`,
      "They listen before impressing you, remember small details, and make your nervous system feel less noisy.",
    ],
    "Creative ambition": [
      "The Magnetic Builder",
      `Your reading points toward someone expressive, decisive, and self-directed. They are likely to be building something of their own, and their focus will feel immediately different from surface-level charm.`,
      "They speak with momentum, follow through quickly, and make future plans feel energizing rather than heavy.",
    ],
    "Warm intelligence": [
      "The Gentle Strategist",
      `You are most likely to recognize someone thoughtful, witty, and emotionally generous. The connection begins softly, then becomes difficult to ignore because the conversation keeps opening new doors.`,
      "They ask unusually precise questions, notice your emotional shifts, and make honesty feel low-pressure.",
    ],
  };

  const [title, text, recognition] = archetypes[quality];
  archetypeTitle.textContent = title;
  archetypeText.textContent = text;
  elementName.textContent = `${element} profile`;
  elementSignal.textContent = elementCopy[element];
  recognitionText.textContent = recognition;
  meetingText.textContent = `Your strongest meeting signal is ${setting.toLowerCase()}, especially when the atmosphere feels ${pace.toLowerCase()} rather than performative.`;
  releaseText.textContent = `${block} may be the pattern to watch. Your preview suggests you should not confuse activation with alignment.`;
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
initCookieConsent();
