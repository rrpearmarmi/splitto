import { test, expect } from '@playwright/test';
import { GroupListPage }   from './pages/GroupListPage';
import { CreateGroupPage } from './pages/CreateGroupPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { AddExpensePage }  from './pages/AddExpensePage';
import { BalancesPage }    from './pages/BalancesPage';

// ─── Isolation totale ─────────────────────────────────────────────────────────
// POST /_test/reset fait un TRUNCATE groups CASCADE (voir server.ts)
test.beforeEach(async ({ request }) => {
  await request.post('/_test/reset');
});

// ─── Helpers de seed via API (évite de repasser par l'UI pour chaque test) ────
async function seedGroup(
  request: any,
  groupId: string,
  groupName: string,
  members: { id: string; name: string; email: string }[],
) {
  await request.post('/api/groups', {
    data: { id: groupId, name: groupName, currency: 'EUR', members },
  });
}

async function seedExpense(
  request: any,
  groupId: string,
  expenseId: string,
  description: string,
  amount: number,
  paidBy: string,
  beneficiaries: string[],
) {
  await request.post(`/api/groups/${groupId}/expenses`, {
    data: {
      id: expenseId,
      description,
      amount,
      currency: 'EUR',
      paidBy,
      paidAt: new Date().toISOString(),
      split: { mode: 'equal', beneficiaries },
    },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Scénario 1 — Créer un groupe avec 3 membres
// ═════════════════════════════════════════════════════════════════════════════
test('créer un groupe avec 3 membres et le voir dans la liste', async ({ page }) => {
  const listPage   = new GroupListPage(page);
  const createPage = new CreateGroupPage(page);

  await listPage.goto();
  await listPage.clickCreateGroup();

  await createPage.fillGroupName('Vacances été');
  await createPage.fillCurrency('EUR');
  await createPage.addMember('Alice');
  await createPage.addMember('Bob');
  await createPage.addMember('Charlie');
  await createPage.submit();

  // Après soumission on doit voir le groupe dans la liste
  await expect(page.getByRole('link', { name: /Vacances été/i })).toBeVisible();
});

// ═════════════════════════════════════════════════════════════════════════════
// Scénario 2 — Ajouter une dépense et la voir dans la liste
// ═════════════════════════════════════════════════════════════════════════════
test('ajouter une dépense et la voir dans la liste du groupe', async ({ page, request }) => {
  // Seed via API : plus rapide que repasser par l'UI
  await seedGroup(request, 'grp-1', 'Coloc', [
    { id: 'mbr-alice', name: 'Alice', email: 'alice@test.com' },
    { id: 'mbr-bob',   name: 'Bob',   email: 'bob@test.com'   },
  ]);

  const listPage       = new GroupListPage(page);
  const detailPage     = new GroupDetailPage(page);
  const addExpensePage = new AddExpensePage(page);

  await listPage.goto();
  await listPage.openGroup('Coloc');

  await detailPage.clickAddExpense();

  await addExpensePage.fillDescription('Courses du lundi');
  await addExpensePage.fillAmount(45);
  await addExpensePage.selectPaidBy('Alice');
  await addExpensePage.submit();

  // La dépense doit apparaître dans la liste
  await expect(
    page.getByTestId('expense-item').filter({ hasText: 'Courses du lundi' })
  ).toBeVisible();
});

// ═════════════════════════════════════════════════════════════════════════════
// Scénario 3 — Soldes corrects après une dépense de 30€
// ═════════════════════════════════════════════════════════════════════════════
test('affiche les soldes corrects après une dépense de 30€ payée par Alice', async ({ page, request }) => {
  await seedGroup(request, 'grp-2', 'Trio', [
    { id: 'mbr-alice',   name: 'Alice',   email: 'alice@test.com'   },
    { id: 'mbr-bob',     name: 'Bob',     email: 'bob@test.com'     },
    { id: 'mbr-charlie', name: 'Charlie', email: 'charlie@test.com' },
  ]);

  await seedExpense(
    request,
    'grp-2',
    'exp-1',
    'Restaurant',
    30,
    'mbr-alice',
    ['mbr-alice', 'mbr-bob', 'mbr-charlie'],
  );

  const listPage   = new GroupListPage(page);
  const detailPage = new GroupDetailPage(page);
  const balancesPage = new BalancesPage(page);

  await listPage.goto();
  await listPage.openGroup('Trio');
  await detailPage.goToBalances();

  // Alice a payé 30€ pour 3 personnes → créditrice de 20€ (30 - 10)
  const aliceBalance = await balancesPage.getBalanceForMember('Alice');
  expect(aliceBalance).toBeCloseTo(20, 1);

  // Bob et Charlie sont débiteurs de 10€ chacun
  const bobBalance = await balancesPage.getBalanceForMember('Bob');
  expect(bobBalance).toBeCloseTo(-10, 1);

  const charlieBalance = await balancesPage.getBalanceForMember('Charlie');
  expect(charlieBalance).toBeCloseTo(-10, 1);
});

// ═════════════════════════════════════════════════════════════════════════════
// Scénario 4 — Marquer un settlement comme réglé
// ═════════════════════════════════════════════════════════════════════════════
test('marquer un settlement comme réglé le fait disparaître de la liste', async ({ page, request }) => {
  await seedGroup(request, 'grp-3', 'Duo', [
    { id: 'mbr-alice', name: 'Alice', email: 'alice@test.com' },
    { id: 'mbr-bob',   name: 'Bob',   email: 'bob@test.com'   },
  ]);

  // Alice paie 20€ pour Bob uniquement → Bob doit 20€ à Alice
  await seedExpense(
    request,
    'grp-3',
    'exp-2',
    'Cinéma',
    20,
    'mbr-alice',
    ['mbr-bob'],
  );

  const listPage     = new GroupListPage(page);
  const detailPage   = new GroupDetailPage(page);
  const balancesPage = new BalancesPage(page);

  await listPage.goto();
  await listPage.openGroup('Duo');
  await detailPage.goToBalances();

  // Vérifier qu'il y a bien 1 settlement avant de régler
  const countBefore = await balancesPage.getSettlementsCount();
  expect(countBefore).toBe(1);

  // Régler le settlement
  await balancesPage.settleFirst();
  await balancesPage.confirmSettle();

  // La liste des settlements doit être vide
  await expect(page.getByTestId('settlement-item')).toHaveCount(0);
});