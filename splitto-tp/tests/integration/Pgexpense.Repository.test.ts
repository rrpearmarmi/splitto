import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { PgExpenseRepository } from '../../infrastructure/repositories/pg-expense.repository';
import type { Expense } from '../../domain/types';

describe('PgExpenseRepository — Integration Tests', () => {
  let pool: Pool;
  let repository: PgExpenseRepository;

  const TEST_GROUP_ID = 'group-test-1';
  const TEST_MEMBER_ID = 'member-alice';

  // ─── SETUP: Connect to PostgreSQL ──────────────
  beforeAll(async () => {
    console.log('🔗 Connecting to PostgreSQL...');
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'splitto',
      user: 'splitto',
      password: 'splitto',
    });

    // Verify connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    client.release();

    repository = new PgExpenseRepository(pool);

    // Setup test data (group and member)
    await setupTestData(pool);
  });

  // ─── TEARDOWN: Close connections ──────────────
  afterAll(async () => {
    console.log('🧹 Closing connections...');
    await cleanupTestData(pool);
    await pool.end();
    console.log('✅ Disconnected');
  });

  // ─── BEFORE EACH: Clear test expenses ──────────────
  beforeEach(async () => {
    await pool.query('DELETE FROM expenses WHERE group_id = $1', [TEST_GROUP_ID]);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Save and retrieve a single expense
  // ─────────────────────────────────────────────────────────────
  it('should save an expense to the database', async () => {
    const expense: Expense = {
      id: 'exp-1',
      groupId: TEST_GROUP_ID,
      description: 'Lunch',
      amount: 50,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-15T12:00:00Z'),
      split: {
        mode: 'equal',
        beneficiaries: [TEST_MEMBER_ID, 'member-bob'],
      },
      createdAt: new Date('2024-01-15T10:00:00Z'),
    };

    await repository.save(expense);

    const retrieved = await repository.findById('exp-1');
    expect(retrieved).toEqual(expense);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Find expenses by group ID
  // ─────────────────────────────────────────────────────────────
  it('should find all expenses for a specific group', async () => {
    const expense1: Expense = {
      id: 'exp-1',
      groupId: TEST_GROUP_ID,
      description: 'Lunch',
      amount: 50,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-15T12:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-15T10:00:00Z'),
    };

    const expense2: Expense = {
      id: 'exp-2',
      groupId: TEST_GROUP_ID,
      description: 'Dinner',
      amount: 80,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-15T18:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-15T17:00:00Z'),
    };

    const otherGroupExpense: Expense = {
      id: 'exp-3',
      groupId: 'group-other',
      description: 'Movie',
      amount: 20,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-15T19:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-15T18:30:00Z'),
    };

    await repository.save(expense1);
    await repository.save(expense2);
    // Don't save otherGroupExpense since it has a different group

    const groupExpenses = await repository.findByGroupId(TEST_GROUP_ID);

    expect(groupExpenses).toHaveLength(2);
    expect(groupExpenses.map(e => e.id)).toContain('exp-1');
    expect(groupExpenses.map(e => e.id)).toContain('exp-2');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Find expenses in a date range
  // ─────────────────────────────────────────────────────────────
  it('should find expenses within a specific date range', async () => {
    const expense1: Expense = {
      id: 'exp-1',
      groupId: TEST_GROUP_ID,
      description: 'Early expense',
      amount: 50,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-10T12:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-10T10:00:00Z'),
    };

    const expense2: Expense = {
      id: 'exp-2',
      groupId: TEST_GROUP_ID,
      description: 'Middle expense',
      amount: 80,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-15T18:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-15T17:00:00Z'),
    };

    const expense3: Expense = {
      id: 'exp-3',
      groupId: TEST_GROUP_ID,
      description: 'Late expense',
      amount: 20,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-25T19:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-25T18:30:00Z'),
    };

    await repository.save(expense1);
    await repository.save(expense2);
    await repository.save(expense3);

    const startDate = new Date('2024-01-12T00:00:00Z');
    const endDate = new Date('2024-01-20T23:59:59Z');

    const rangeExpenses = await repository.findInDateRange(startDate, endDate);

    expect(rangeExpenses).toHaveLength(1);
    expect(rangeExpenses[0].id).toBe('exp-2');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Find non-existent expense returns null
  // ─────────────────────────────────────────────────────────────
  it('should return null for non-existent expense', async () => {
    const result = await repository.findById('exp-999');
    expect(result).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Update an existing expense
  // ─────────────────────────────────────────────────────────────
  it('should update an existing expense', async () => {
    const expense: Expense = {
      id: 'exp-1',
      groupId: TEST_GROUP_ID,
      description: 'Original',
      amount: 50,
      currency: 'EUR',
      paidBy: TEST_MEMBER_ID,
      paidAt: new Date('2024-01-15T12:00:00Z'),
      split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
      createdAt: new Date('2024-01-15T10:00:00Z'),
    };

    await repository.save(expense);

    const updated: Expense = {
      ...expense,
      description: 'Updated description',
      amount: 75,
    };

    await repository.save(updated);

    const retrieved = await repository.findById('exp-1');
    expect(retrieved?.description).toBe('Updated description');
    expect(retrieved?.amount).toBe(75);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Empty database queries
  // ─────────────────────────────────────────────────────────────
  it('should return empty array when no expenses exist', async () => {
    const groupExpenses = await repository.findByGroupId(TEST_GROUP_ID);
    expect(groupExpenses).toEqual([]);

    const rangeExpenses = await repository.findInDateRange(
      new Date('2024-01-01'),
      new Date('2024-12-31'),
    );
    expect(rangeExpenses).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Multiple expenses ordered by date
  // ─────────────────────────────────────────────────────────────
  it('should return expenses ordered by paid_at descending', async () => {
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        groupId: TEST_GROUP_ID,
        description: 'First',
        amount: 50,
        currency: 'EUR',
        paidBy: TEST_MEMBER_ID,
        paidAt: new Date('2024-01-15T12:00:00Z'),
        split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
        createdAt: new Date('2024-01-15T10:00:00Z'),
      },
      {
        id: 'exp-2',
        groupId: TEST_GROUP_ID,
        description: 'Second',
        amount: 80,
        currency: 'EUR',
        paidBy: TEST_MEMBER_ID,
        paidAt: new Date('2024-01-16T18:00:00Z'),
        split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
        createdAt: new Date('2024-01-16T17:00:00Z'),
      },
      {
        id: 'exp-3',
        groupId: TEST_GROUP_ID,
        description: 'Third',
        amount: 30,
        currency: 'EUR',
        paidBy: TEST_MEMBER_ID,
        paidAt: new Date('2024-01-17T08:00:00Z'),
        split: { mode: 'equal', beneficiaries: [TEST_MEMBER_ID] },
        createdAt: new Date('2024-01-17T07:00:00Z'),
      },
    ];

    for (const expense of expenses) {
      await repository.save(expense);
    }

    const retrieved = await repository.findByGroupId(TEST_GROUP_ID);
    expect(retrieved).toHaveLength(3);
    // Should be ordered by paid_at DESC (newest first)
    expect(retrieved[0].id).toBe('exp-3');
    expect(retrieved[1].id).toBe('exp-2');
    expect(retrieved[2].id).toBe('exp-1');
  });
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function setupTestData(pool: Pool): Promise<void> {
  // Create test group
  await pool.query(
    `INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    ['group-test-1', 'Test Group', 'EUR'],
  );

  // Create test member
  await pool.query(
    `INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    ['member-alice', 'group-test-1', 'Alice', 'alice@test.com'],
  );
}

async function cleanupTestData(pool: Pool): Promise<void> {
  // Cascade delete will remove expenses and members when group is deleted
  await pool.query('DELETE FROM groups WHERE id = $1', ['group-test-1']);
}