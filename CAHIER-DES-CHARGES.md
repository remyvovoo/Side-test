# Cardshot — Cahier des charges
**Version 1 — à ajuster par Remy avant tout développement**
*Rédigé par ton Lead Dev IA. Tout ce document est modifiable : raye, annote, corrige.*

---

## 1. Vision du produit

Cardshot transforme 2 photos d'une carte à collectionner (recto/verso) en une **annonce de vente complète et prête à publier en moins d'une minute** : visuels studio professionnels, photos de détail réelles, description auto-générée, export ZIP.

> Les images sont un moyen, pas la finalité. **Le produit livré, c'est l'annonce.**

**Modèle d'accès** : essai gratuit de 30 jours, sans carte bancaire. Le parcours de création est réservé aux comptes créés. (Le paiement/abonnement viendra plus tard, hors périmètre pour l'instant.)

---

## 2. À qui s'adresse le produit

| Profil | Besoin | Conséquence pour nous |
|---|---|---|
| **Vendeur occasionnel** (vide sa collection) | Simplicité absolue, zéro jargon | Parcours guidé, réglages par défaut excellents |
| **Vendeur régulier** (Vinted, eBay, Cardmarket) | Rapidité, régularité visuelle, son branding | Logo perso, profil vendeur, « Mes cartes » |
| **Professionnel / boutique** (cible à terme) | Volume, fiabilité, qualité irréprochable | Détection IA, rendu pro — c'est la direction, pas encore le niveau actuel |

---

## 3. Le parcours utilisateur complet (cible)

### 3.1 — Visiteur (non connecté)
1. **Accueil** : titre bénéfice (« Une photo. Six visuels studio prêts à publier. »), aperçu 3D de la carte, bouton principal « Créer mes photos ».
2. En haut à droite : **un seul bouton** → « Essai gratuit 30 jours » (et lien « Se connecter » pour ceux qui ont déjà un compte). *Le double bouton actuel disparaît ; la fenêtre « profil vendeur » quitte l'accueil.*
3. La mention « Gratuit · Sans inscription » devient « **Essai gratuit 30 jours · Sans carte bancaire** ».
4. Tout clic vers le parcours de création redirige vers inscription/connexion.

### 3.2 — Inscription : onboarding en 3 étapes (style CarBox)
Barre de progression en haut : **① Inscription — ② Univers — ③ Volume**.

1. **Étape 1 — Créez votre compte** : e-mail + mot de passe (pas de champ téléphone). Badge « Essai gratuit — 30 jours ».
2. **Étape 2 — Choisissez votre univers** : grande grille visuelle de nos thèmes/présentoirs (aperçus générés par notre moteur de rendu, une carte dans chaque univers). Le choix devient le réglage par défaut du studio — modifiable à tout moment ensuite.
3. **Étape 3 — Votre volume** : « Combien de cartes vends-tu par mois ? » (moins de 10 / 10 – 100 / 100 – 500 / 500 – 1 000 / plus de 1 000). Sert uniquement à te connaître pour les futures offres ; passable en un clic.
4. **Écran « Ton compte est en préparation »** (quelques secondes, compteur animé) puis **« Ton compte est prêt ✓ »** → bouton « Accéder à mon espace ».
5. **E-mail de bienvenue/confirmation** envoyé automatiquement (via Mailjet, voir §5).

### 3.3 — Connexion & mot de passe oublié (copié du fonctionnement Vovoo)
1. **Connexion** : e-mail + mot de passe. *(Bug du champ mot de passe invisible : déjà corrigé.)*
2. Lien « **Mot de passe oublié ?** » sous le formulaire →
3. Page « Réinitialiser mon mot de passe » : on saisit son e-mail → message neutre « Si un compte existe avec cette adresse, un e-mail a été envoyé » (on ne révèle jamais si l'e-mail est connu — sécurité).
4. E-mail avec **lien à usage unique, valable 24 h** → page de nouveau mot de passe → confirmation → connexion.

### 3.4 — Espace connecté (le « SaaS »)
Navigation : **menu latéral fixe sur ordinateur, menu hamburger sur mobile.**

| Entrée du menu | Contenu |
|---|---|
| **Mes cartes** | Galerie des annonces déjà créées : miniature, nom, date. Actions : retélécharger le ZIP, dupliquer les réglages, supprimer. État vide accueillant pour les nouveaux (« Crée ta première carte → »). |
| **Nouvelle carte** | Lance le parcours de création (§3.5). |
| **Mon profil vendeur** | Le texte type repris dans chaque annonce (conditions d'envoi, etc.) — c'est ici que vit l'ancienne fenêtre de l'accueil. |
| **Réglages** | Univers par défaut (choisi à l'onboarding), langue FR/EN, e-mail / mot de passe. |
| **Déconnexion** | — |

### 3.5 — Création d'une carte (parcours existant, corrigé)
1. **Source** : prendre une photo (recommandé) ou importer depuis la galerie.
2. **Conseils photo** (modale, désactivable) → sélection du fichier.
3. **Traitement** : détourage automatique — avec de vrais états d'attente lisibles (« Détourage… », « Analyse qualité… »).
4. **Détection IA des infos** *(nouveau — chantier C)* : lecture automatique du numéro de la carte (en bas de la carte), déduction de la série et des infos de base → l'annonce se préremplit toute seule. L'utilisateur vérifie/corrige au lieu de tout taper.
5. **Score qualité** : anneau de score (chiffre lisible — corrigé) + conseils d'amélioration concrets. Si la photo est mauvaise, « Reprendre la photo » devient l'action mise en avant.
6. **Recadrage** : auto ou manuel (poignées agrandies sur mobile).
7. **Verso ?** : écran de persuasion actuel (conservé tel quel, il est bon).
8. **Studio** : aperçu en direct, présentoir, univers (pré-sélectionné = celui de l'onboarding), infos carte (préremplies par l'IA), logo, réglages avancés.
9. **Export** : sélection des visuels + photos de détail, description auto-générée (profil vendeur + infos carte), format JPG/PNG, **bouton Télécharger toujours visible en bas d'écran**, récap du contenu du ZIP.
10. **Fin** : écran de confirmation/célébration → la carte est **automatiquement enregistrée dans « Mes cartes »** → propositions : « Nouvelle carte » ou « Voir mes cartes ».

---

## 4. Ce qu'on développe — les chantiers

### Chantier A — Socle SaaS
| Réf | Fonctionnalité | Détail |
|---|---|---|
| A1 | Authentification complète | Inscription, connexion, déconnexion, **mot de passe oublié avec e-mail** (fonctionnement copié de Vovoo, adapté à l'architecture Cardshot) |
| A2 | E-mails transactionnels | Via **Mailjet** (même service que Vovoo) : e-mail de bienvenue, réinitialisation de mot de passe. Modèles aux couleurs Cardshot |
| A3 | Onboarding 3 étapes | Inscription → Univers → Volume → « Compte prêt » (§3.2) |
| A4 | Espace connecté responsive | Sidebar desktop / hamburger mobile, 5 entrées (§3.4) |
| A5 | Sauvegarde des cartes | Images stockées sur **Vercel Blob** (recommandation), infos en base Postgres. Alimente « Mes cartes » |
| A6 | Protection du parcours | Création accessible uniquement connecté ; header public à bouton unique ; messages d'accueil mis à jour |

### Chantier B — Corrections du parcours de création
| Réf | Correction |
|---|---|
| B1 | Score qualité : chiffre blanc lisible, anneau modernisé |
| B2 | Erreur de détourage : message humain, « Réessayer » en action principale, plus de « contacte le support » sans lien |
| B3 | Score rouge → « Reprendre la photo » mis en avant |
| B4 | Écrans équilibrés verticalement (fin des grands vides) |
| B5 | Export : bouton ancré en bas + récap ZIP + écran de fin |
| B6 | Recadrage : poignées agrandies (mobile) |
| B7 | Accessibilité : navigation clavier sur toutes les vignettes cliquables |

### Chantier C — Intelligence artificielle
| Réf | Fonctionnalité | Détail |
|---|---|---|
| C1 | Détection des infos de la carte | Une IA de vision lit la photo : numéro (ex. 228/197), nom, série, langue. Préremplit studio + annonce. Correction manuelle toujours possible |
| C2 | Coût & limites | Chaque analyse coûte quelques centimes (API payante). Prévoir un plafond pendant l'essai gratuit (ex. 30 analyses) — à arbitrer |

---

## 5. Choix techniques (validés ou recommandés)

| Sujet | Choix | Statut |
|---|---|---|
| Base | Next.js 16 + TypeScript + Tailwind v4, Postgres (Neon) + Prisma 6, Auth.js | ✅ En place |
| E-mails | **Mailjet** (comme Vovoo) — nécessite une clé API et une **adresse d'expéditeur Cardshot** (voir questions §7) | 🟡 Recommandé |
| Stockage images | **Vercel Blob** (intégré à l'hébergement actuel, gratuit au début) | 🟡 Recommandé |
| Détourage | remove.bg (existant) — reste un point de fragilité payant, à surveiller | ✅ En place |
| IA de vision | API Claude (vision) pour la lecture des cartes | 🟡 Recommandé |
| Hébergement | Vercel, déploiement automatique à chaque push GitHub (`remyvovoo/Side-test` uniquement) | ✅ En place |

**Sécurité — rappels actifs** : l'ancienne clé remove.bg est toujours exposée dans l'historique Git public (rotation reportée par toi — à faire avant toute mise en avant du produit). Les mots de passe sont chiffrés (jamais en clair). Le lien de réinitialisation ne révèle jamais si un e-mail existe.

---

## 6. Hors périmètre (volontairement, pour l'instant)

- Paiement, abonnement, crédits (fin d'essai = à définir plus tard, voir questions).
- Export direct vers les marketplaces (eBay, Cardmarket, Vinted…).
- Traitement par lot (plusieurs cartes d'un coup).
- Correction de perspective photo (choix assumé).
- Statistiques / dashboard analytique.
- Traduction EN du parcours de création (l'infrastructure existe, l'application viendra après le socle).

---

## 7. Questions ouvertes — à trancher par Remy

1. **Adresse e-mail d'expéditeur** : les e-mails Cardshot partiront de quelle adresse ? (ex. `noreply@cardshot.fr` — il faut posséder le domaine ; sinon on démarre avec une adresse existante). Réutilise-t-on le compte Mailjet de Vovoo ou en crée-t-on un dédié Cardshot ?
2. **Vérification d'e-mail à l'inscription** : Vovoo demande de cliquer un lien de confirmation avant d'utiliser le compte. On fait pareil (plus propre, mais une friction de plus) ou on laisse entrer directement et on vérifie plus tard ? *Ma recommandation : entrer directement, vérifier plus tard.*
3. **Fin des 30 jours d'essai** : que se passe-t-il ? (blocage doux avec message « offre bientôt disponible », simple compteur sans blocage… ) *Ma recommandation : compteur visible + blocage doux, aucun paiement à construire.*
4. **Plafond d'analyses IA** pendant l'essai (C2) : combien ? *Ma recommandation : 30.*
5. **Stockage Vercel Blob** : OK pour l'activer sur ton compte Vercel ? (je te guiderai, c'est un bouton dans ton tableau de bord.)
6. **Étape Volume** de l'onboarding : confirmes-tu qu'on la garde (simple info, passable en un clic) ?
7. **Badge « Pokémon »** sur l'accueil : on le garde, on le précise (« Spécial cartes Pokémon ») ou on le retire ?

---

## 8. Ordre de réalisation proposé

| Phase | Contenu | Fini quand… |
|---|---|---|
| **1. Socle compte** | A1 + A2 + A3 + A6 | On peut s'inscrire en 3 étapes, se connecter, récupérer son mot de passe par e-mail, et le parcours est protégé |
| **2. Espace connecté** | A4 + A5 | On retrouve ses cartes sauvegardées dans un espace avec menu, sur mobile comme sur ordi |
| **3. Parcours soigné** | B1 → B7 | Le parcours de création est propre, rassurant et sans cul-de-sac |
| **4. Intelligence** | C1 + C2 | On photographie une carte → l'annonce se préremplit toute seule |

Chaque phase se termine par : démonstration dans le navigateur, tes retours, ajustements, **puis** déploiement (avec ton accord explicite avant chaque push).

---

*Fin du document. Annote directement ce fichier ou dis-moi tes ajustements en discussion — je mettrai le cahier des charges à jour avant de commencer la phase 1.*
