const fr: {
  common: { cardshot: string; loading: string; back: string; logout: string };
  auth: {
    trialBadge: string;
    register: {
      title: string;
      subtitle: string;
      emailLabel: string;
      emailPlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      passwordHint: string;
      ruleLength: string;
      ruleUppercase: string;
      ruleLowercase: string;
      ruleNumber: string;
      ruleSpecial: string;
      submit: string;
      hasAccount: string;
      loginLink: string;
      errorEmailTaken: string;
      errorWeakPassword: string;
      errorGeneric: string;
      successTitle: string;
      successSubtitle: string;
      successCta: string;
    };
    login: {
      title: string;
      subtitle: string;
      emailLabel: string;
      passwordLabel: string;
      submit: string;
      noAccount: string;
      registerLink: string;
      errorInvalid: string;
    };
  };
  admin: {
    title: string;
    subtitle: string;
    email: string;
    role: string;
    createdAt: string;
    empty: string;
  };
} = {
  common: {
    cardshot: "Cardshot",
    loading: "Chargement…",
    back: "Retour",
    logout: "Se déconnecter",
  },
  auth: {
    trialBadge: "Gratuit pendant le lancement",
    register: {
      title: "Créez votre compte",
      subtitle: "Prépare tes annonces en moins d'une minute, dès aujourd'hui.",
      emailLabel: "E-mail",
      emailPlaceholder: "vous@exemple.com",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "Choisis un mot de passe",
      passwordHint: "8 caractères minimum, avec majuscule et chiffre.",
      ruleLength: "8 caractères minimum",
      ruleUppercase: "Une majuscule",
      ruleLowercase: "Une minuscule",
      ruleNumber: "Un chiffre",
      ruleSpecial: "Un caractère spécial (facultatif)",
      submit: "Créer mon compte",
      hasAccount: "Déjà un compte ?",
      loginLink: "Se connecter",
      errorEmailTaken: "Cet e-mail est déjà utilisé.",
      errorWeakPassword: "Le mot de passe ne respecte pas les critères ci-dessus.",
      errorGeneric: "Une erreur est survenue, réessaie.",
      successTitle: "Ton compte est prêt",
      successSubtitle: "Tu vas être redirigé vers Cardshot dans un instant.",
      successCta: "Accéder à Cardshot",
    },
    login: {
      title: "Content de te revoir",
      subtitle: "Connecte-toi pour retrouver ton espace Cardshot.",
      emailLabel: "E-mail",
      passwordLabel: "Mot de passe",
      submit: "Se connecter",
      noAccount: "Pas encore de compte ?",
      registerLink: "Créer un compte",
      errorInvalid: "E-mail ou mot de passe incorrect.",
    },
  },
  admin: {
    title: "Comptes créés",
    subtitle: "Liste des vendeurs inscrits sur Cardshot.",
    email: "E-mail",
    role: "Rôle",
    createdAt: "Inscrit le",
    empty: "Aucun compte pour l'instant.",
  },
};

export default fr;
