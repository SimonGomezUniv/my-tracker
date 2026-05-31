# Node Tracker — Plan d'implémentation

## Statut global

| Phase | Description | Statut |
|---|---|---|
| Phase 1 | Socle technique (serveur, router, DB, PWA, layout) | ✅ Terminé |
| Phase 2 | Gestion des types et groupes de tracking | ✅ Terminé |
| Phase 3 | Saisie et historique des entrées | ✅ Terminé |
| Phase 4 | Statistiques | ✅ Terminé |
| Phase 5 | Export / Import / Reset | ✅ Terminé |

---

## Architecture globale

```
┌──────────────────────────────────────────┐
│           Express Server (Node.js)        │
│   Sert les fichiers statiques + PWA      │
│   Variables d'env: NODE_ENV=dev|prod     │
└──────────────┬───────────────────────────┘
               │ HTML/CSS/JS (SPA)
┌──────────────▼───────────────────────────┐
│           Browser (SPA)                   │
│   Routing côté client (hash router)      │
│   State management (vanilla JS)          │
│   Storage: IndexedDB                     │
└──────────────────────────────────────────┘
```

Pas d'API REST — le serveur ne fait que **servir les fichiers**. Toute la logique et les données sont dans le navigateur (IndexedDB).

---

## Modèle de données

```
Tag
├── id: uuid
├── name: string
└── color: string

TrackingField
├── name: string
├── label: string
├── type: 'numeric' | 'string' | 'boolean' | 'rating' | 'duration'
├── required: boolean
└── options?: string[]

TrackingType  (le "formulaire" d'un tracking)
├── id: uuid
├── name: string
├── description: string
├── icon: string
├── color: string
├── fields: TrackingField[]
├── tags: uuid[]
└── createdAt: timestamp

TrackingGroup  (regroupe plusieurs TrackingTypes)
├── id: uuid
├── name: string
├── description: string
├── icon: string
├── color: string
├── trackingTypeIds: uuid[]
└── tags: uuid[]

TrackingEntry  (une saisie concrète)
├── id: uuid
├── trackingTypeId: uuid
├── timestamp: ISO string
├── data: { [fieldName]: any }
├── tags: uuid[]
└── note: string
```

---

## Structure du projet

```
node_tracker/
├── package.json
├── server.js
├── .env.dev
├── .env.prod
│
└── public/
    ├── index.html
    ├── manifest.json
    ├── sw.js                     # Service Worker PROD (cache-first)
    ├── sw-dev.js                 # Service Worker DEV (network-only)
    │
    ├── css/
    │   ├── app.css
    │   ├── components.css
    │   └── themes.css
    │
    └── js/
        ├── app.js                # Bootstrap, router init
        ├── router.js             # Hash router
        ├── store.js              # State global
        ├── db.js                 # Abstraction IndexedDB
        ├── pwa.js                # Registration service worker selon ENV
        │
        ├── models/
        │   ├── tracking-type.js
        │   ├── tracking-group.js
        │   ├── tracking-entry.js
        │   └── tag.js
        │
        ├── services/
        │   ├── stats.service.js
        │   └── export.service.js
        │
        └── views/
            ├── dashboard.js
            ├── new-entry.js
            ├── history.js
            ├── stats.js
            ├── types/
            │   ├── list.js
            │   └── editor.js
            ├── groups/
            │   ├── list.js
            │   └── editor.js
            └── settings.js
```

---

## Phase 1 — Socle technique

### Tâches

- [x] `PLAN.md` — Ce fichier de suivi
- [x] `package.json` — Dépendances Express + scripts npm
- [x] `server.js` — Express, sert /public, injecte NODE_ENV
- [x] `.env.dev` / `.env.prod`
- [x] `public/index.html` — Squelette SPA, injection ENV
- [x] `public/js/router.js` — Hash router (navigate, register routes)
- [x] `public/js/db.js` — Abstraction IndexedDB (CRUD générique)
- [x] `public/manifest.json` — PWA manifest
- [x] `public/sw.js` — Service Worker PROD
- [x] `public/sw-dev.js` — Service Worker DEV (network-only)
- [x] `public/js/pwa.js` — Enregistrement SW selon ENV
- [x] `public/js/store.js` — State global réactif
- [x] `public/js/app.js` — Bootstrap de l'application
- [x] `public/css/app.css` — Layout principal + variables CSS
- [x] `public/css/components.css` — Composants réutilisables
- [x] Vue **Dashboard** (squelette)
- [x] Vue **Settings** (squelette)

---

## Phase 2 — Gestion des types et groupes

### Tâches

- [ ] `public/js/models/tag.js` — Modèle Tag (CRUD)
- [ ] `public/js/models/tracking-type.js` — Modèle TrackingType
- [ ] `public/js/models/tracking-group.js` — Modèle TrackingGroup
- [ ] Vue **Tags** — liste et gestion des tags
- [ ] Vue **Types > Liste** — liste des TrackingTypes
- [ ] Vue **Types > Éditeur** — formulaire dynamique de définition des champs
- [ ] Vue **Groupes > Liste**
- [ ] Vue **Groupes > Éditeur**

---

## Phase 3 — Saisie et historique

### Tâches

- [ ] `public/js/models/tracking-entry.js` — Modèle TrackingEntry
- [ ] Vue **Nouvelle saisie** — sélection type → formulaire dynamique
- [ ] Vue **Historique** — liste paginée, filtres (type, groupe, tag, période)
- [ ] Vue **Édition d'une entrée** — modifier / supprimer

---

## Phase 4 — Statistiques

### Tâches

- [ ] `public/js/services/stats.service.js` — Calculs (total, évolution, liste)
- [ ] Vue **Stats** — total sur période
- [ ] Vue **Stats** — évolution par sous-période (graphique canvas)
- [ ] Vue **Stats** — liste sur période

---

## Phase 5 — Export / Import / Reset

### Tâches

- [ ] `public/js/services/export.service.js` — Sérialisation/désérialisation JSON
- [ ] Vue **Settings** — bouton Export → téléchargement JSON
- [ ] Vue **Settings** — bouton Import → chargement fichier JSON
- [ ] Vue **Settings** — bouton Reset avec confirmation

---

## PWA : stratégie cache

| Mode | Service Worker | Stratégie |
|---|---|---|
| `NODE_ENV=dev` | `sw-dev.js` | Network-only, pas de cache |
| `NODE_ENV=prod` | `sw.js` | Cache-first sur assets |

---

## Commandes

```bash
# Développement
npm run dev

# Production
npm run prod
```

---

## Story UI — Menu Sticky Haut

### Objectif

Remplacer la navigation latérale par un menu sticky en haut avec 4 icônes:

- [x] Home
- [x] Historique
- [x] Statistique
- [x] Paramètre

### Détails d'implémentation

- [x] L'icône de la page courante est mise en avant
- [x] Les pages Types / Groupes / Tags sont rattachées au pôle Paramètre
- [x] Suppression de l'entrée de navigation dédiée à "Nouvelle saisie"
- [x] La création d'une nouvelle saisie reste accessible depuis la Home (saisie rapide)

---

## EPIC — Customisation de la page d'accueil

### Objectifs

- [x] Activer/désactiver les compteurs Home (saisies, trackings, groupes)
- [x] Ajouter une section optionnelle "Stats personnalisées" sous la saisie rapide
- [x] Permettre l'ajout de widgets stats configurables (type, période relative, tags)
- [x] Ajouter un nouveau mode de restitution stats en calendrier (icônes + valeurs par jour)

### Plan de livraison

- [x] Créer un service de persistance des préférences Home (`localStorage`)
- [x] Étendre la page Paramètres avec UI de configuration Home
- [x] Étendre la Home pour lire la config et rendre les widgets choisis
- [x] Étendre la page Stats avec un rendu calendrier du type filtré
- [x] Ajouter les styles UI (widgets Home, config, calendrier)

---

## EPIC — Personnalisation avancée Home & UX mobile

### Fonctionnalités demandées

- [x] Mettre les stats personnalisées avant l'historique sur la Home
- [x] Permettre de choisir l'ordre des blocs Home
- [x] Autoriser plusieurs types de tracking dans le widget calendrier
- [x] Simplifier l'UI Home en retirant les textes explicatifs
- [x] Condenser l'affichage sur mobile (densité + nav compacte)
- [x] Gérer un thème clair/sombre selon le thème système du téléphone
- [x] Boutons Paramètres compacts mobile (icône + tooltip)
- [x] Limiter les widgets Home à 3 sur mobile avec action Voir plus / Voir moins

### Plan d'implémentation

- [x] Étendre le modèle de config Home (ordre de sections + widget multi-types)
- [x] Ajouter les contrôles d'ordre dans Paramètres (haut/bas)
- [x] Adapter le rendu Home pour respecter l'ordre configuré
- [x] Adapter le widget calendrier pour afficher des entrées multi-types
- [x] Ajuster les styles mobile pour limiter la hauteur consommée
- [x] Ajouter les variables light mode via `prefers-color-scheme`

---

## BACKLOG — EPIC Challenges, Habitudes et Objectifs

### Vision

Permettre la creation de challenges personnalises (jour, semaine, mois, trimestre, annee ou duree libre), le suivi de progression, les streaks, les recompenses et les rappels, tout en restant:

- local-first
- sans serveur
- configurable
- reutilisable sur tout domaine

### Statut

- [x] EPIC demarree (Phase 6.1 en cours)
- [x] Cadrage technique valide
- [ ] Decoupage implementation valide

### Modele de donnees cible (V3)

```
Challenge
├── id: uuid
├── name: string
├── description: string
├── category: string
├── icon: string
├── color: string
├── periodMode: 'fixed' | 'preset'
├── startDate: ISO date
├── endDate: ISO date
├── preset?: '1w' | '1m' | '1q' | '1y'
├── items: ChallengeItem[]
└── createdAt: timestamp

ChallengeItem
├── id: string
├── name: string
├── description?: string
├── trackingTypeId: uuid
├── fieldName?: string
├── metric: 'count' | 'sum'
├── challengeType: 'boolean' | 'cumulative' | 'daily' | 'duration'
├── targetValue: number
├── unit?: string
├── rewardsEnabled: boolean
└── remindersEnabled: boolean

ChallengeStats (derive)
├── progress: number
├── itemCount: number
├── completedItems: number
├── itemStats: ChallengeItemStats[]
└── status: 'active' | 'completed' | 'failed' | 'archived'
```

Principe cle V3:

- un challenge ne cree pas de seconde donnee de suivi
- un challenge est un conteneur de periode
- chaque item du challenge est calcule depuis `trackingEntries`
- chaque item garde son propre streak, sa propre progression, ses propres rewards et reminders

Exemple cible:

- challenge `Juin`
- item `Pompes`: plusieurs saisies par jour, somme des repetitions, succes si total jour >= 100
- item `Handstand`: succes si total jour >= 5 min
- item `Closed kitchen`: rappel actif, saisie booleenne quotidienne, succes si vrai
- aucune saisie supplementaire n'est creee au niveau du challenge

### User stories mappees en backlog

#### US1 — Creer un challenge

- [x] Ajouter le store IndexedDB `challenges`
- [x] Creer le modele `public/js/models/challenge.js`
- [x] Ajouter la vue `public/js/views/challenges/list.js`
- [x] Ajouter la vue `public/js/views/challenges/editor.js`
- [x] Ajouter les routes `#/challenges`, `#/challenges/new`, `#/challenges/edit/:id`
- [x] Ajouter validation metier (dates + items + objectifs par item)

Critere d'acceptation:

- [x] Creation challenge avec periode libre et presets
- [x] Support des 4 types par item (boolean, cumulatif, quotidien, temps)
- [x] Un challenge peut contenir plusieurs items suivis independamment

#### US2 — Progression derivee depuis les suivis existants

- [x] Etendre le modele `public/js/models/challenge.js` avec `items[]`
- [x] Supprimer le store IndexedDB `challengeEntries`
- [x] Transformer `public/js/views/challenges/entry.js` en vue de progression detaillee
- [x] Support multi-items dans une meme periode
- [x] Agregation journaliere automatique depuis `trackingEntries`

Critere d'acceptation:

- [x] Plusieurs entrees trackers meme jour -> total calcule correctement
- [x] Un challenge peut combiner plusieurs mesures / activites sans fusionner leurs streaks
- [x] Aucun formulaire de saisie specifique au challenge n'est necessaire

#### US3 — Calcul automatique des streaks

- [x] Creer `public/js/services/challenge-stats.service.js`
- [x] Implementer `currentStreak`, `bestStreak`, `successRate` par item
- [x] Normaliser la logique de reussite selon le type d'item

Critere d'acceptation:

- [x] Affichage du streak actuel, record et taux de reussite pour chaque item

#### US4 — Dashboard challenges

- [x] Ajouter un widget "Challenges" dans Home
- [x] Ajouter la progression par challenge (barre + ratio)
- [x] Ajouter KPI globaux (actifs, streak global, completes)

Critere d'acceptation:

- [x] Vue synthetique lisible des challenges en cours

#### US5 — Dashboard personnalisable

- [x] Etendre `home-customization.service.js` pour widgets challenges
- [x] Ajouter controle affichage/masquage/reordonnancement
- [x] Prevoir support resize widget (si systeme de taille existe)

Critere d'acceptation:

- [x] Widgets challenges configurables depuis Parametres

#### US6 — Historique de progression

- [x] Ajouter vue progression challenge (calendrier type heatmap)
- [x] Ajouter resume mensuel (jours validés / taux)

Critere d'acceptation:

- [x] Historique visuel quotidien exploitable

#### US7 — Recompenses

- [x] Creer service `public/js/services/challenge-rewards.service.js`
- [x] Ajouter catalogue badges par seuils (streak et volume) par item
- [x] Ajouter option on/off recompenses par item

Critere d'acceptation:

- [x] Badges debloques automatiquement si actifs sur l'item

#### US8 — Notifications

- [x] Ajouter preference "rappel" globale + par item
- [x] Ajouter rappel "a l'ouverture" (pas de saisie aujourd'hui + heure seuil)
- [x] Afficher notification locale si permission accordee

Limite connue V1:

- [ ] Pas de notification planifiee application fermee (sans backend push)

### Plan de livraison propose (implementation)

#### Phase 6.1 — Core challenges (MVP)

- [x] US1 creation challenge
- [x] US2 progression derivee
- [x] US3 stats/streaks

#### Phase 6.2 — UX et dashboard

- [x] US4 dashboard challenge
- [x] US5 personnalisation widgets
- [x] US6 historique heatmap

#### Phase 6.3 — Engagement

- [x] US7 recompenses (optionnel activable)
- [x] US8 rappels a l'ouverture

### Impacts techniques transverses

- [x] Router: nouvelles routes challenges
- [x] DB: migration schema IndexedDB (version + store `challenges` uniquement)
- [x] Export/import: inclure `challenges` + prefs reminders/rewards
- [x] Stats: harmoniser service existant avec `challenge-stats.service.js`
- [x] UI: ajouter section challenges dans navigation/parametres

### Open points avant implementation

- [ ] Definition exacte du calcul "streak global" d'un challenge multi-items
- [ ] Strategie de suppression challenge (hard delete vs archive)
- [ ] Regles de validation pour objectifs de type temps (format/precision)
- [ ] Decide si on expose "habitudes" comme alias UI de "challenge quotidien"
