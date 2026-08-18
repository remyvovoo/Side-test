@AGENTS.md

# Cardshot — guide pour agents IA

Ce fichier est lu automatiquement par Claude Code (et tout agent compatible) à chaque session sur ce dépôt. Il remplace le besoin de tout réexpliquer : lis-le en entier avant de coder.

## Le produit, en une phrase

Cardshot transforme 2 photos d'une carte à collectionner (recto/verso) en une annonce de vente complète et prête à publier en moins d'une minute : visuels studio, photos de détail réelles, description automatique, export ZIP. **Les images sont un moyen, pas la finalité — le produit livré est l'annonce.**

## Qui est le porteur du projet, et comment travailler avec lui

Remy (dossantos.remy@vovoo.fr) est le fondateur, **non-développeur**. Il agit comme product owner ; toi (l'agent) tu es son Lead Developer / CTO. Règles de collaboration qu'il a explicitement demandées :

- Explique toujours **quoi** et **pourquoi**, en langage simple, étape par étape.
- Quand plusieurs solutions existent, **recommande celle que tu juges la meilleure** avec ta raison — ne renvoie pas un menu de choix techniques qu'il n'a pas les moyens d'arbitrer.
- Propose des améliorations sans attendre qu'on te les demande. Signale quand une idée compliquerait inutilement le produit.
- Demande confirmation avant les changements de grande ampleur (nouvelle dépendance lourde, changement d'architecture, push Git, suppression de données). Les petites corrections cohérentes avec une demande déjà actée n'ont pas besoin d'une re-confirmation à chaque fois.
- Il communique en français ; les réponses et les textes visibles dans l'app sont en français (l'anglais est une option pour l'utilisateur final, pas la langue par défaut de nos échanges).

## Où pousser le code — règle absolue

**Seul `https://github.com/remyvovoo/Side-test.git` doit recevoir des commits/push.** Remy a un autre compte/organisation GitHub ("Vovoo Tech", ex. `github.com/Vovoo-Tech/vovoo`) qui héberge un projet totalement différent et sans rapport — ne jamais y écrire, ne jamais y pousser, même en cas de doute. La lecture seule (cloner pour s'inspirer, avec son accord explicite) est acceptable ; l'écriture ne l'est jamais sans qu'il le redemande explicitement pour ce dépôt précis.

## Où on en est (mettre à jour cette section à chaque étape majeure)

*Dernière mise à jour : 18 août 2026.* Le cahier des charges validé est dans `CAHIER-DES-CHARGES.md` — c'est la référence de périmètre.

**Fait :**
- Socle Next.js 16 + TypeScript + Tailwind v4 (remplace un ancien prototype HTML statique conservé dans `legacy-prototype/` pour référence).
- Parcours complet en 8 écrans (`src/components/wizard/`) : accueil → import → score qualité réel → recadrage → verso → studio (présentoir/thème/logo/infos) → export.
- Moteur de rendu Canvas découplé de l'UI (`src/lib/render-engine/`), derrière une interface `RenderEngine` — c'est la couture prévue pour brancher Blender plus tard sans toucher aux écrans.
- Score qualité réel (netteté, résolution, cadrage) — `src/lib/quality/`. Le score est **mis en cache par empreinte SHA-256 de la photo** (`quality-cache.ts`) : deux imports de la même photo donnent forcément le même pourcentage.
- Photos de détail réelles (coins + surface, non stylisées) — `src/lib/detail-shots/`.
- Export ZIP unique (visuels + détails + description + miniature) — `src/lib/wizard/export-zip.ts`.
- **Authentification complète** : inscription, connexion, mot de passe oublié par e-mail (Mailjet en appel REST direct, sans dépendance npm — `src/lib/email/`). En l'absence de clés Mailjet, les e-mails partent dans la console (mode dev). La réponse « mot de passe oublié » est volontairement **neutre**, qu'un compte existe ou non (décision de Remy après discussion : ne pas révéler qu'une adresse est inscrite).
- **Onboarding 3 étapes** façon CarBox (`OnboardingFlow.tsx`) : Inscription → Univers → Volume → « Compte prêt ».
- **Espace connecté SaaS** (`src/components/dashboard/`) : sidebar sur ordinateur, menu hamburger sur mobile. Vue d'ensemble · Mes cartes · Mon studio · Mon profil vendeur, + bouton primaire séparé « Nouvelle carte ».
- **Cartes persistées en base** (modèle `Card`) : la carte est enregistrée dès l'arrivée sur l'écran d'export, pas au téléchargement. Grille cliquable, page de détail éditable, corbeille au survol, sélection multiple.
- **Annonce générée par modèles** (`generate-description.ts`) : l'utilisateur définit ses gabarits de titre et de description avec des variables (`{nom}`, `{série}`, `{état}`, `{numéro}`…). Les lignes dont toutes les variables sont vides disparaissent automatiquement.
- **Réglages studio par défaut** (`/dashboard/studio`) : le wizard démarre pré-configuré, « Ajuster » reste optionnel. L'UI est **scindée en deux** — ce qui concerne l'annonce d'un côté, le visuel/studio de l'autre (demande explicite de Remy).
- **Détourage maison** (`src/lib/wizard/local-cutout.ts`) : seuillage d'Otsu sur une distance colorimétrique insensible aux ombres, plus grande composante connexe, rebouchage des trous, contrôle de plausibilité (portrait, ratio ~1,4, rectangle plein). Gratuit, instantané, zéro dépendance. **remove.bg n'est plus qu'une roue de secours.**

**Décisions produit actées (ne pas les rouvrir sans que Remy le demande) :**
- **Pas de boîtier acrylique factice** dans le rendu : cela laisserait croire à l'acheteur que la carte est protégée et masquerait ses défauts.
- **Le prix ne doit jamais apparaître sur les photos.**
- **Un seul fond à la fois** — on travaille un univers jusqu'au bout avant d'en ajouter un autre.
- Le rendu studio est un chantier **itératif** : Remy juge sur pièce à chaque passe.

**Pas fait / en attente — ne pas supposer que c'est fait :**
- **Identification des informations de la carte par IA** (numéro, nom, série) pour pré-remplir l'annonce : **prochain chantier**, autorisé par Remy. Nécessite `ANTHROPIC_API_KEY` dans `.env.local` + Vercel. Charger le skill `claude-api` avant d'écrire la moindre ligne. Prévoir un plafond d'essai (~30 analyses).
- Le parcours principal (les 8 écrans du wizard) est **encore 100 % en français codé en dur**, pas branché sur `src/lib/i18n/`.
- Correction de perspective (redressement d'une photo prise de travers) — le recadrage ne fait qu'un rectangle englobant, pas une déformation en quadrilatère. Explicitement mis de côté par choix (complexité/risque), pas oublié.
- Univers « Bureau » (décor sobre, choix de couleur de fond) et « Atelier bois » : validés, pas commencés.
- Visite guidée du produit : validée, mais **à faire tout à la fin**, quand tout le reste est stabilisé.
- Traitement par lot (plusieurs annonces d'un coup) : à faire **après** l'identification IA.
- Stockage des images sur Vercel Blob + re-téléchargement depuis « Mes cartes ».
- Export marketplace (eBay, Vinted, Cardmarket…), statistiques, système d'Assets en base (studios/présentoirs actuellement des tableaux JS codés en dur).
- Paiement / abonnement / crédits : **explicitement refusé par Remy pour l'instant**. Ne pas construire sans qu'il le redemande.
- Aucun test automatisé (unitaire ou e2e) n'existe encore.

**Rituels de vérification (gagnent du temps, appliqués systématiquement) :**
- Après `npx prisma migrate dev`, **redémarrer le serveur de dev** — sinon erreurs `PrismaClientValidationError` sur les nouveaux champs.
- Si le serveur sert des fichiers périmés : `preview_stop` → `rm -rf .next` → `preview_start`. (Cause probable : horloge du Mac décalée par rapport aux dates du cache.)
- **Avant de supprimer un compte de test, déconnecter la session du navigateur** — sinon Remy garde une session pointant vers un compte inexistant, et ses cartes semblent disparaître.
- React monte les effets deux fois en dev : tout traitement coûteux (détourage, appel API payant) doit être **dédupliqué par promesse partagée**, jamais par un simple garde booléen — un garde fait sortir le montage survivant sans jamais appeler `onComplete` (interblocage déjà rencontré).

## Sécurité — point de vigilance actif

L'ancien prototype (`legacy-prototype/api/remove-bg.js`) contenait une vraie clé remove.bg codée en dur, committée sur ce dépôt **public**. Remy a choisi de reporter la rotation de cette clé ("on verra plus tard") — le risque est donc toujours réel si quelqu'un consulte l'historique Git. Ne pas relancer ce sujet de façon insistante, mais le remonter naturellement si la conversation touche aux clés API ou à la sécurité. Le code actuel (`src/app/api/remove-bg/route.ts`) ne lit la clé que depuis `REMOVE_BG_KEY` en variable d'environnement, sans valeur de repli.

## Pièges techniques déjà rencontrés (pour ne pas les reproduire)

- **Prisma : rester en version 6.x, ne pas passer en 7.** Prisma 7 impose un `prisma.config.ts` et des adapters de connexion obligatoires — beaucoup plus lourd et très récent. `prisma@^6` avec le schéma classique (`datasource { url = env(...) }`) suffit largement ici.
- **Ne jamais définir de chemin de sortie personnalisé pour le client Prisma** (`generator client { output = ... }`). Ça casse silencieusement la résolution de modules sous Turbopack en dev (erreurs "Module not found" en boucle). Laisser le client se générer dans `node_modules/@prisma/client` (défaut) et importer depuis `@prisma/client`.
- **Vérifier qu'un nom de classe CSS personnalisé n'entre pas en collision avec une classe utilitaire Tailwind** avant de l'utiliser (ex. `.collapse` correspond à `visibility: collapse` en Tailwind v4 et rendait des sections invisibles). Préférer un préfixe (`.cs-xxx`) pour toute nouvelle classe custom si le nom est générique.
- Le CLI Prisma (`npx prisma migrate dev`, etc.) lit `.env` à la racine, **pas** `.env.local` — Next.js lit les deux au runtime, mais Prisma CLI seulement `.env`. Garder les deux fichiers à jour avec les mêmes valeurs `DATABASE_URL`/`DATABASE_URL_UNPOOLED` en local.

## Organisation des dossiers (Bureau de Remy)

```
Desktop/Cardshot/
  app/              ← ce dépôt (le seul poussé sur GitHub, remyvovoo/Side-test)
  worktrees/        ← copies isolées du dépôt pour des agents travaillant en parallèle
```

Les `worktrees/` sont des copies Git isolées (chacune sur sa propre branche) destinées à des tâches bien délimitées et mécaniques (traduction, tests, audit design) — jamais pour des décisions d'architecture ou de nouvelles fonctionnalités majeures, qui doivent rester centralisées dans une seule conversation/agent à la fois pour éviter des décisions incohérentes.

## Commandes utiles

```bash
npm run dev              # serveur de développement (localhost:3000)
npm run build             # build de production
npm run lint              # ESLint
npx tsc --noEmit          # vérification des types
npx prisma migrate dev    # nouvelle migration (nécessite .env avec DATABASE_URL)
npx prisma studio         # interface graphique pour voir/modifier les données
```

## Variables d'environnement attendues (voir `.env.example`)

`REMOVE_BG_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`. Toutes doivent aussi être configurées dans Vercel (Settings → Environment Variables) pour que la production fonctionne — le local (`.env`/`.env.local`) et Vercel sont deux configurations séparées à maintenir en parallèle.
