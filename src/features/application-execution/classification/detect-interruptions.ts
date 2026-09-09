import type { InterruptionDetection } from "../types";

export function detectInterruptionsFromDom(input: {
  url: string;
  title: string;
  markers: string[];
  hasPasswordField: boolean;
  hasOtpField: boolean;
  hasCaptcha: boolean;
  hasAssessment: boolean;
  hasChallengeFrame: boolean;
}): InterruptionDetection {
  const blob = `${input.url} ${input.title} ${input.markers.join(" ")}`.toLowerCase();
  if (input.hasChallengeFrame || blob.includes("challenge-frame")) {
    return { kind: "CAPTCHA", message: "Complete the verification in the browser, then Resume." };
  }
  if (input.hasCaptcha || /captcha|hcaptcha|recaptcha|cf-turnstile/.test(blob)) {
    return { kind: "CAPTCHA", message: "Complete the verification in the browser, then Resume." };
  }
  if (input.hasAssessment || /assessment|coding challenge|timed exam|personality test/.test(blob)) {
    return {
      kind: "ASSESSMENT",
      message: "This application includes an assessment that CareerOS will not complete automatically.",
    };
  }
  if (input.hasOtpField || /\bmfa\b|\botp\b|authenticator|two.factor/.test(blob)) {
    return { kind: "MFA", message: "Complete multi-factor verification in the application browser, then Resume." };
  }
  if (input.hasPasswordField || /sign in|log in|login required/.test(blob)) {
    return { kind: "LOGIN", message: "Login required in the application browser. Complete login manually, then Resume." };
  }
  return { kind: null, message: null };
}
