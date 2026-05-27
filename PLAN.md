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
