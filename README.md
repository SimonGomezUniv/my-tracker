# My Tracker

**Application de tracking d'informations personnelles — disponible en ligne :**
👉 https://simongomezuniv.github.io/my-tracker/

---

## Fonctionnement

My Tracker permet de créer des **types de suivi personnalisés** (sport, alimentation, humeur, finances…) avec des champs sur-mesure (texte, nombre, durée, note, booléen), puis d'y enregistrer des entrées au fil du temps.

Toutes les données sont stockées **localement dans le navigateur** (IndexedDB) — aucun compte, aucun serveur, aucune donnée envoyée en ligne.

## Fonctionnalités principales

- **Tableau de bord** — vue d'ensemble de vos types de suivi et dernières entrées
- **Nouvelle saisie** — formulaire dynamique adapté au type choisi, avec tags et note libre
- **Historique** — liste filtrée par type, période et tags, avec édition et suppression
- **Statistiques** — graphiques, totaux, nuage de mots sur vos notes, filtres par période et tags
- **Types & Groupes** — création et organisation de vos propres types de tracking
- **Export / Import** — sauvegarde complète en JSON, restauration ou remise à zéro
- **PWA** — installable sur mobile et desktop, fonctionne hors-ligne

## Technologies

- HTML / CSS / JavaScript ES Modules (aucun framework)
- IndexedDB (stockage client)
- Service Worker (mode offline)
- Node.js + Express (serveur de développement local uniquement)
- GitHub Actions + GitHub Pages (déploiement continu)

## Lancer en local

```bash
npm install
node server.js
```

L'application est accessible sur `http://localhost:3000`.
