# TP — Splitto : Tests à tous les niveaux

---

## Contexte métier

Vous allez construire et tester **Splitto**, une application de partage de
dépenses entre amis (équivalent simplifié de Tricount ou Splitwise).

L'app permet de :
- Créer des **groupes** avec plusieurs **membres**
- Ajouter des **dépenses** (qui a payé, pour qui, combien)
- Calculer automatiquement les **soldes** de chaque membre
- Simplifier les **dettes** en règlements minimaux

L'objectif n'est pas de construire l'app de A à Z — la majorité du code et
le frontend sont déjà fournis. **Votre travail consiste à TESTER** ce code
à tous les niveaux.

---

## Ce qui vous est fourni

Un zip de démarrage avec :

- ✅ Tous les types TypeScript de domaine
- ✅ Le frontend React minimal fonctionnel
- ✅ Le serveur Express avec les routes principales
- ✅ La configuration Vitest, Playwright, Pact, Stryker
- ✅ Les migrations SQL Postgres
- ⚠️ Quelques fonctions et classes **à compléter** (signature donnée, corps `throw new Error('Not implemented')`)
- ⚠️ Aucun test (vous les écrivez tous)

---

## Stack technique imposée

- **Node.js 20+** + **TypeScript strict**
- **Vitest** pour les tests unitaires et d'intégration
- **Testcontainers** + **Postgres 16-alpine** pour les tests d'intégration
- **Playwright** pour les tests E2E
- **@pact-foundation/pact** pour les contract tests
- **Stryker** pour les tests de mutation

---

## Démarrage rapide

```bash
# Recuperer le zip et créer un repo git public
cd splitto-tp

# Installer
npm install
npx playwright install chromium

# Vérifier que tout marche
npm run dev          # frontend + backend démarrent sur :3000
npm test             # vous n'avez pas encore de tests, c'est normal
```

---

## Exercice 1 — Tests unitaires

### Objectif

Implémenter et tester la fonction pure `computeBalances(group, expenses)`
qui calcule combien chaque membre est créditeur ou débiteur.

### Spécification

**Entrée :**
- `group` : un objet `{ id, name, currency, members: Member[] }`
- `expenses` : une liste de `Expense[]`

**Sortie :**
- Un objet `{ [memberId]: balance }` où :
  - `balance > 0` : le membre est créditeur (on lui doit de l'argent)
  - `balance < 0` : le membre est débiteur (il doit de l'argent)
  - La somme de tous les balances doit être ≈ 0 (au centime près)

**Logique métier :**
Pour chaque dépense :
1. Le **payeur** voit son solde augmenter du montant total
2. Chaque **bénéficiaire** voit son solde diminuer de sa quote-part
3. La quote-part dépend du `splitMode` :
   - `'equal'` : montant ÷ nombre de bénéficiaires
   - `'weighted'` : selon les `weights` fournis (somme des poids = total)
   - `'percentage'` : selon les `percentages` fournis (somme = 100)

### Cas obligatoires à tester (au minimum)

1. Groupe vide → tous les soldes sont 0
2. Une dépense `equal` entre 3 personnes (le payeur inclus comme bénéficiaire)
3. Une dépense `equal` entre 3 personnes (le payeur PAS bénéficiaire)
4. Plusieurs dépenses qui se compensent partiellement
5. Une dépense `weighted` avec poids non-uniformes
6. Une dépense `percentage` avec arrondis (ex: 100€ entre 3 = 33.33 + 33.33 + 33.34)

### Cas limites à tester (au moins 3 au choix parmi)

- Membre supprimé qui figure dans une vieille dépense
- Dépense de 0€ (à autoriser ou rejeter — votre choix, justifiez)
- Dépense avec un seul bénéficiaire (le payeur lui-même)
- Liste vide de dépenses
- Très grand nombre de membres (10+)
- Pourcentages qui ne somment pas exactement à 100

---

## Exercice 2 — TDD strict

### Objectif

Implémenter `simplifyDebts(balances)` en TDD strict, avec un git log qui
documente vos cycles red → green → refactor.

### Spécification

**Entrée :** un objet `{ [memberId]: balance }` (le résultat de l'exo 1)

**Sortie :** une liste de `Settlement[]` :
```typescript
type Settlement = {
  from: string;     // memberId du débiteur
  to: string;       // memberId du créditeur
  amount: number;
};
```

**Contrainte de qualité :** l'algo doit produire le **nombre minimum** de
settlements pour solder le groupe.

### Exemples

```typescript
// 2 personnes
simplifyDebts({ a: 10, b: -10 })
// → [{ from: 'b', to: 'a', amount: 10 }]

// 3 personnes en triangle (A doit à B doit à C doit à A)
simplifyDebts({ a: 10, b: 0, c: -10 })
// → [{ from: 'c', to: 'a', amount: 10 }]
// (et NON deux settlements via b)

// 4 personnes, dette circulaire complexe
simplifyDebts({ a: 30, b: -20, c: -10, d: 0 })
// → [{ from: 'b', to: 'a', amount: 20 },
//    { from: 'c', to: 'a', amount: 10 }]
// (2 settlements minimum, pas 3)
```

### Contrainte TDD STRICTE

**Règle absolue :** vous ne pouvez ajouter une ligne de code de production
QUE si un test rouge l'exige.

**Format des commits exigé :**
```
RED: ajout du test pour 2 personnes
GREEN: implémentation triviale qui retourne le bon résultat
GREEN: ajout du test pour 3 personnes en triangle
GREEN: généralisation avec un Map de balances
REFACTOR: extraction de la fonction findLargestCreditor
GREEN: ajout du test pour 4 personnes circulaire
...
```

**Au moins 6 cycles complets** doivent apparaître dans votre git log.

## Exercice 3 — Doubles de test

### Objectif

Tester `ExpenseService.create()` qui dépend de **5 collaborateurs**, en
utilisant les **5 types de doubles** de la taxonomie de Meszaros.

### Le code à tester

Le fichier `src/domain/expense.service.ts` est déjà fourni :

```typescript
export class ExpenseService {
  constructor(
    private readonly repo: ExpenseRepository,
    private readonly notifier: EmailNotifier,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async create(input: CreateExpenseInput): Promise<Expense> {
    const expense: Expense = {
      id: this.idGen.next(),
      ...input,
      createdAt: this.clock.now(),
    };

    await this.repo.save(expense);
    this.logger.info(`Expense ${expense.id} created`);

    if (expense.amount >= 100) {
      await this.notifier.notifyGroupMembers(
        expense.groupId,
        `Nouvelle dépense importante: ${expense.description}`,
      );
    }

    return expense;
  }
}
```

### Contrainte

Écrire **un seul fichier de test** où chacun des 5 types de doubles est
utilisé **explicitement et avec un commentaire** :

```typescript
// ─── DUMMY ──────────────────────────────────────
const dummyLogger: Logger = ...

// ─── STUB ───────────────────────────────────────
const stubClock: Clock = ...

// ─── SPY ────────────────────────────────────────
// ...

// ─── MOCK ───────────────────────────────────────
// ...

// ─── FAKE ───────────────────────────────────────
// ...
```

Le test doit vérifier au moins ceci :
- L'expense retourné a les bonnes valeurs
- Le repository contient bien l'expense après save
- Le notifier a été appelé si `amount >= 100`
- Le notifier n'est PAS appelé si `amount < 100` (autre test)

---

## Exercice 4 — Tests d'intégration

### Objectif

Implémenter `PgExpenseRepository` et le tester avec une vraie base
Postgres lancée via Testcontainers.

### Pré-requis

Docker doit être installé et en cours d'exécution sur votre machine.

### Spécification

`src/infrastructure/pg-expense.repository.ts` à compléter (signature
donnée, corps `throw new Error('Not implemented')`).

Méthodes à implémenter :

```typescript
class PgExpenseRepository implements ExpenseRepository {
  async save(expense: Expense): Promise<void>
  async findById(id: string): Promise<Expense | null>
  async findByGroupId(groupId: string): Promise<Expense[]>
  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]>
}
```

### Tests obligatoires

1. **`save() puis findById()`** retourne l'expense identique (mêmes valeurs)
2. **`findByGroupId()`** retourne uniquement les expenses du groupe demandé
   (en présence d'autres groupes)
3. **`findInDateRange()`** filtre correctement (inclusif sur les bornes)
4. **La contrainte `UNIQUE(group_id, paid_at, amount, paid_by)`** rejette
   un doublon avec une exception
5. **Une transaction** qui échoue à mi-parcours rollback proprement
   (aucune ligne sauvegardée)

### Contraintes techniques

- `beforeAll` avec timeout ≥ 60_000 ms
- `TRUNCATE expenses CASCADE` dans `beforeEach`
- Migrations SQL exécutées dans `beforeAll` (le fichier est dans `migrations/`)
- Image Postgres : `postgres:16-alpine`

---

## Exercice 5 — Contract testing avec Pact

### Objectif

Établir un contrat Pact entre :
- **Consumer** : `splitto-frontend` (déjà existant, simulé par un client HTTP)
- **Provider** : `splitto-api` (le serveur Express)

L'interaction testée : `GET /api/groups/:id/balances`

### Architecture

```
┌─────────────────────┐      pact JSON      ┌─────────────────────┐
│   splitto-frontend  │ ─────contrat──────► │     splitto-api     │
│   (consumer)        │                     │     (provider)      │
└─────────────────────┘                     └─────────────────────┘
```

### Côté consumer

Fichier : `tests/contract/balances.consumer.pact.test.ts`

**Au moins 2 interactions à déclarer :**

1. `GET /api/groups/group-1/balances` quand le groupe a des dépenses
   → retourne 200 avec un body `{ balances: { ... } }`

2. `GET /api/groups/inexistant/balances` quand le groupe n'existe pas
   → retourne 404

**Contraintes :**
- Utiliser des matchers (`like`, `regex`, `eachLike`) — pas de littéraux
  pour les valeurs dynamiques
- Générer le pact dans `pacts/`

### Côté provider

Fichier : `tests/contract/balances.provider.pact.test.ts`

**State handlers requis :**

1. `'group-1 a 3 membres et 2 dépenses'` → INSERT en DB :
   - 3 lignes dans `members`
   - 2 lignes dans `expenses`

2. `'aucun groupe inexistant'` → TRUNCATE (état vide)

**Contraintes :**
- Le serveur doit vraiment démarrer (pas de mock)
- Utiliser une DB Testcontainers (comme exo 4)

---

## Exercice 6 — Tests E2E avec Playwright

### Objectif

4 scénarios E2E qui pilotent un vrai navigateur sur l'app complète.

### Scénarios obligatoires

1. **Créer un groupe avec 3 membres** : aller sur la page de création,
   remplir le formulaire, vérifier que le groupe apparaît dans la liste

2. **Ajouter une dépense** : aller dans un groupe existant, ouvrir le
   formulaire de dépense, remplir, vérifier qu'elle apparaît dans la liste

3. **Voir les soldes mis à jour** : après avoir ajouté une dépense de
   30€ payée par Alice pour 3 personnes, vérifier que :
   - Alice est créditrice de 20€
   - Les 2 autres sont débiteurs de 10€ chacun

4. **Marquer un règlement comme « réglé »** : depuis la page des soldes,
   cliquer sur « Régler » à côté d'un settlement, confirmer, vérifier
   qu'il disparaît de la liste

### Contraintes

- **Page Object Model** obligatoire : 1 fichier par page importante
- **Sélecteurs sémantiques uniquement** : `getByRole`, `getByLabel`,
  `getByTestId`. **Aucun** `locator('.css-class')`, `locator('xpath/...')`,
  `locator('div > span')`.
- **Isolation totale** : `beforeEach` qui appelle `POST /_test/reset`
- **Aucun `waitForTimeout`** : utiliser uniquement l'auto-wait

---

## Exercice 7 — Mutation testing avec Stryker

### Objectif

Atteindre **80% minimum de mutation score** sur les fichiers
`src/domain/balances.ts` (exo 1) ET `src/domain/simplify.ts` (exo 2).

### Démarche attendue

1. Lancer `npm run test:mutation` une première fois
2. Capturer le rapport HTML : `stryker-report-before.png` (screenshot ou
   le HTML directement)
3. Analyser les **mutants survivants** dans `reports/mutation/mutation.html`
4. Améliorer vos tests (exos 1 et 2) pour tuer le maximum de mutants
5. Re-lancer Stryker
6. Capturer le nouveau rapport : `stryker-report-after.png`
7. Rédiger `MUTATION_ANALYSIS.md`

### Contenu attendu de `MUTATION_ANALYSIS.md`

```markdown
# Analyse des mutations

## Score initial
- balances.ts : XX%
- simplify.ts : XX%

## Score final
- balances.ts : XX%
- simplify.ts : XX%

## Mutants survivants après amélioration

### Mutant 1 : <description>
- Fichier : balances.ts:42
- Mutation : `===` → `!==`
- Pourquoi il survit : <équivalent / non couvert / impossible à tuer>
- Décision : <accepté / à corriger plus tard>

### Mutant 2 : ...
```
---

## Modalités de rendu

### Format

- **Repo Git public sur GitHub**
- **Lien envoyé par email** ehouri@formateur.ief2i.fr avant la deadline

### Deadline

Dimanche 10 juin 2026 à 20h

---

## Conseils pratiques

1. **Lisez le sujet en entier AVANT de commencer.** Ça vous évitera de
   refaire des choses qui sont demandées plus tard.

2. **Faites les exercices DANS L'ORDRE.** Les exos 4, 5, 6 dépendent du code
   que vous écrivez aux exos 1, 2, 3.

3. **Commitez SOUVENT.** Surtout pour l'exo 2 (TDD) où le git log fait
   partie de la note.

---

**Bon courage. Le but n'est pas de tout réussir parfaitement : c'est de
montrer que vous maîtrisez chaque type de test et savez les choisir à bon
escient.**
