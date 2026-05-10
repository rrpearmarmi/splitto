# Splitto — TP Tests

Bienvenue dans le TP **Tests à tous les niveaux**. Vous allez tester
une application de partage de dépenses entre amis.

## 📋 Avant de commencer

**Lisez le sujet complet** : [SUJET.md](./SUJET.md)

## 🚀 Installation

### Pré-requis

- Node.js 20+
- Docker (pour Postgres et Testcontainers)
- Git

### Setup

```bash
# 1. Installer les dépendances
npm install
npx playwright install chromium

# 2. Démarrer Postgres pour le dev local
docker-compose up -d

# 3. Lancer l'app pour vérifier que ça marche
npm run dev

# Ouvre http://localhost:3000 dans le navigateur
```

Si tout fonctionne, vous voyez la page Splitto avec un bouton "Nouveau groupe".

## Structure du projet

```
splitto-tp/
├── SUJET.md                  ← énoncé complet du TP
├── src/
│   ├── domain/               ← logique métier
│   │   ├── types.ts
│   │   ├── balances.ts       ← À COMPLÉTER (exo 1)
│   │   ├── simplify.ts       ← À COMPLÉTER (exo 2)
│   │   └── expense.service.ts
│   ├── ports/                ← interfaces
│   ├── infrastructure/
│   │   └── pg-expense.repository.ts  ← À COMPLÉTER (exo 4)
│   ├── server.ts             ← Express
│   └── main.ts               ← entrée
├── tests/
│   ├── unit/                 ← VOS TESTS UNITAIRES (exos 1, 2, 3)
│   ├── integration/          ← VOS TESTS D'INTÉGRATION (exo 4)
│   ├── contract/             ← VOS CONTRACT TESTS (exo 5)
│   └── e2e/                  ← VOS TESTS E2E (exo 6)
├── frontend/                 ← UI (HTML+JS) — déjà fait
├── migrations/               ← schéma Postgres
└── pacts/                    ← contrats générés (exo 5)
```

## Commandes utiles

```bash
npm run dev                        # démarre l'app en dev
npm run test:unit                  # tests unitaires
npm run test:integration           # tests d'intégration (Docker requis)
npm run test:e2e                   # tests E2E
npm run test:contract:consumer     # contract test côté consumer
npm run test:contract:provider     # contract test côté provider
npm run test:coverage              # coverage des tests unitaires
npm run test:mutation              # mutation testing avec Stryker
```

## Rendu

À la fin du TP :

1. Pousser votre code sur un **repo Git public** sur GitHub
2. Envoyer le lien du repo : ehouri@formateur.ief2i.fr
3. Rendu Dimanche 10 juin 2026 à 20h


Bon courage !
