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
      forgotLink: string;
    };
    forgot: {
      title: string;
      subtitle: string;
      emailLabel: string;
      submit: string;
      sentTitle: string;
      sentSubtitle: string;
      backToLogin: string;
      errorGeneric: string;
    };
    reset: {
      title: string;
      subtitle: string;
      passwordLabel: string;
      submit: string;
      successTitle: string;
      successSubtitle: string;
      goLogin: string;
      errorInvalidToken: string;
      errorGeneric: string;
    };
    onboarding: {
      stepAccount: string;
      stepUniverse: string;
      stepVolume: string;
      universeTitle: string;
      universeSubtitle: string;
      universeCta: string;
      volumeTitle: string;
      volumeSubtitle: string;
      volumeUnit: string;
      volumeSkip: string;
      volumeCta: string;
      preparingTitle: string;
      preparingSubtitle: string;
      preparingStatus: string;
      readyTitle: string;
      readySubtitle: string;
      readyCta: string;
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
      forgotLink: "Mot de passe oublié ?",
    },
    forgot: {
      title: "Mot de passe oublié",
      subtitle: "Indique ton e-mail : on t'envoie un lien pour en choisir un nouveau.",
      emailLabel: "E-mail",
      submit: "M'envoyer le lien",
      sentTitle: "Vérifie ta boîte mail",
      sentSubtitle:
        "Si un compte existe avec cette adresse, un e-mail avec un lien de réinitialisation (valable 24 h) vient d'être envoyé.",
      backToLogin: "Retour à la connexion",
      errorGeneric: "Une erreur est survenue, réessaie.",
    },
    reset: {
      title: "Nouveau mot de passe",
      subtitle: "Choisis ton nouveau mot de passe pour retrouver ton espace.",
      passwordLabel: "Nouveau mot de passe",
      submit: "Enregistrer mon mot de passe",
      successTitle: "Mot de passe changé ✓",
      successSubtitle: "Tu peux maintenant te connecter avec ton nouveau mot de passe.",
      goLogin: "Se connecter",
      errorInvalidToken:
        "Ce lien de réinitialisation est invalide ou a expiré. Refais une demande depuis « Mot de passe oublié ».",
      errorGeneric: "Une erreur est survenue, réessaie.",
    },
    onboarding: {
      stepAccount: "Inscription",
      stepUniverse: "Univers",
      stepVolume: "Volume",
      universeTitle: "Choisis ton univers",
      universeSubtitle:
        "C'est le décor par défaut de tes visuels — tu pourras le changer à tout moment dans le studio.",
      universeCta: "Continuer",
      volumeTitle: "Combien de cartes vends-tu par mois ?",
      volumeSubtitle: "Juste pour mieux te connaître — ça ne change rien à ton essai.",
      volumeUnit: "cartes / mois",
      volumeSkip: "Passer cette question",
      volumeCta: "Terminer",
      preparingTitle: "Ton espace se prépare",
      preparingSubtitle: "Quelques secondes et tout est prêt.",
      preparingStatus: "Application de tes réglages…",
      readyTitle: "Ton compte est prêt",
      readySubtitle: "Tout est en place. Ton espace Cardshot t'attend.",
      readyCta: "Accéder à mon espace",
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
