import type fr from "./fr";

const en: typeof fr = {
  common: {
    cardshot: "Cardshot",
    loading: "Loading…",
    back: "Back",
    logout: "Sign out",
  },
  auth: {
    trialBadge: "Free during launch",
    register: {
      title: "Create your account",
      subtitle: "Prepare your listings in under a minute, starting today.",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Choose a password",
      passwordHint: "At least 8 characters, with an uppercase letter and a number.",
      ruleLength: "At least 8 characters",
      ruleUppercase: "One uppercase letter",
      ruleLowercase: "One lowercase letter",
      ruleNumber: "One number",
      ruleSpecial: "One special character (optional)",
      submit: "Create my account",
      hasAccount: "Already have an account?",
      loginLink: "Sign in",
      errorEmailTaken: "This email is already in use.",
      errorWeakPassword: "The password doesn't meet the criteria above.",
      errorGeneric: "Something went wrong, please try again.",
      successTitle: "Your account is ready",
      successSubtitle: "You'll be redirected to Cardshot in a moment.",
      successCta: "Go to Cardshot",
    },
    login: {
      title: "Welcome back",
      subtitle: "Sign in to get back to your Cardshot workspace.",
      emailLabel: "Email",
      passwordLabel: "Password",
      submit: "Sign in",
      noAccount: "Don't have an account yet?",
      registerLink: "Create an account",
      errorInvalid: "Incorrect email or password.",
    },
  },
  admin: {
    title: "Registered accounts",
    subtitle: "List of sellers registered on Cardshot.",
    email: "Email",
    role: "Role",
    createdAt: "Joined on",
    empty: "No accounts yet.",
  },
};

export default en;
