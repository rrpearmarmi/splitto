import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpenseService } from '../../domain/expense.service';
import type {
  Expense,
  CreateExpenseInput,
  Currency,
} from '../../domain/types';
import type { ExpenseRepository } from '../../ports/expense.repository';
import type { EmailNotifier } from '../../ports/notifier';
import type { Clock } from '../../ports/clock';
import type { IdGenerator } from '../../ports/id-generator';
import type { Logger } from '../../ports/logger';

describe('ExpenseService.create() — Test Doubles', () => {
  let service: ExpenseService;

  // ─── DUMMY ──────────────────────────────────────
  // Logger is passed to the constructor but never verified or used in assertions.
  // Its methods may be called, but we don't care about the calls.
  const dummyLogger: Logger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  // ─── STUB ───────────────────────────────────────
  // Clock always returns a hardcoded date. No expectations, just controlled output.
  const fixedDate = new Date('2024-01-15T10:00:00Z');
  const stubClock: Clock = {
    now: vi.fn(() => fixedDate),
  };

  // IdGenerator returns pre-determined sequential IDs via mocking.
  const stubIdGen: IdGenerator = {
    next: vi.fn()
      .mockReturnValueOnce('exp-001')
      .mockReturnValueOnce('exp-002')
      .mockReturnValueOnce('exp-003'),
  };

  // ─── SPY ────────────────────────────────────────
  // Repository is a real object (wrapped in vi.fn) where we spy on calls
  // while allowing the real behavior to execute (in this case, we mock it).
  const spyRepo: ExpenseRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByGroupId: vi.fn(),
    findInDateRange: vi.fn(),
  };

  // ─── MOCK ───────────────────────────────────────
  // Notifier is mocked to verify it's called with EXACT parameters.
  // We care about WHETHER it was called and WITH WHAT arguments.
  const mockNotifier: EmailNotifier = {
    notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    service = new ExpenseService(
      spyRepo,
      mockNotifier,
      stubClock,
      stubIdGen,
      dummyLogger,
    );
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Create expense with amount < 100 (NO notification)
  // ─────────────────────────────────────────────────────────────
  it('should create expense and NOT notify when amount < 100', async () => {
    const input: CreateExpenseInput = {
      groupId: 'group-1',
      description: 'Lunch',
      amount: 50,
      currency: 'EUR',
      paidBy: 'alice',
      paidAt: new Date('2024-01-15T12:00:00Z'),
      split: {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      },
    };

    const result = await service.create(input);

    // Verify the expense was created with correct values
    expect(result).toEqual({
      id: 'exp-001',
      groupId: 'group-1',
      description: 'Lunch',
      amount: 50,
      currency: 'EUR',
      paidBy: 'alice',
      paidAt: new Date('2024-01-15T12:00:00Z'),
      split: {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      },
      createdAt: fixedDate,
    });

    // SPY: Verify repo.save() was called exactly once with the expense
    expect(spyRepo.save).toHaveBeenCalledOnce();
    expect(spyRepo.save).toHaveBeenCalledWith(result);

    // MOCK: Verify notifier was NOT called (amount < 100)
    expect(mockNotifier.notifyGroupMembers).not.toHaveBeenCalled();

    // STUB: Verify idGen.next() was called
    expect(stubIdGen.next).toHaveBeenCalledOnce();

    // STUB: Verify clock.now() was used for createdAt
    expect(result.createdAt).toEqual(fixedDate);

    // DUMMY: Logger exists and is initialized
    expect(dummyLogger).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Create expense with amount >= 100 (SHOULD notify)
  // ─────────────────────────────────────────────────────────────
  it('should create expense and notify when amount >= 100', async () => {
    const input: CreateExpenseInput = {
      groupId: 'group-2',
      description: 'Hotel',
      amount: 250,
      currency: 'EUR',
      paidBy: 'alice',
      paidAt: new Date('2024-01-15T14:00:00Z'),
      split: {
        mode: 'equal',
        beneficiaries: ['alice', 'bob', 'charlie'],
      },
    };

    const result = await service.create(input);

    // SPY: Verify repo.save() was called
    expect(spyRepo.save).toHaveBeenCalledOnce();
    expect(spyRepo.save).toHaveBeenCalledWith(result);

    // MOCK: Verify notifier WAS called with exact parameters
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledOnce();
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledWith(
      'group-2',
      'Nouvelle dépense importante : Hotel (250€)',
    );

    // Verify the expense structure
    expect(result.id).toBe('exp-002');
    expect(result.amount).toBe(250);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Multiple expenses with sequential IDs
  // ─────────────────────────────────────────────────────────────
  it('should generate sequential IDs and notify only for large expenses', async () => {
    const expense1: CreateExpenseInput = {
      groupId: 'group-3',
      description: 'Coffee',
      amount: 5,
      currency: 'EUR',
      paidBy: 'alice',
      paidAt: new Date('2024-01-15T09:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['alice'] },
    };

    const result1 = await service.create(expense1);
    expect(result1.id).toBe('exp-001');

    const expense2: CreateExpenseInput = {
      groupId: 'group-3',
      description: 'Flight',
      amount: 500,
      currency: 'EUR',
      paidBy: 'bob',
      paidAt: new Date('2024-01-15T10:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['bob'] },
    };

    const result2 = await service.create(expense2);
    expect(result2.id).toBe('exp-002');

    // STUB: Verify idGen.next() was called twice
    expect(stubIdGen.next).toHaveBeenCalledTimes(2);

    // SPY: Verify repo.save() was called twice
    expect(spyRepo.save).toHaveBeenCalledTimes(2);

    // MOCK: Verify notifier was called ONLY for the second expense (>= 100)
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledOnce();
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledWith(
      'group-3',
      'Nouvelle dépense importante : Flight (500€)',
    );
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Boundary case — exactly 100 (should notify)
  // ─────────────────────────────────────────────────────────────
  it('should notify when amount is exactly 100', async () => {
    const input: CreateExpenseInput = {
      groupId: 'group-4',
      description: 'Books',
      amount: 100,
      currency: 'EUR',
      paidBy: 'charlie',
      paidAt: new Date('2024-01-15T15:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['charlie', 'diana'] },
    };

    const result = await service.create(input);

    // MOCK: Verify notifier WAS called (amount >= 100, boundary case)
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledOnce();
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledWith(
      'group-4',
      'Nouvelle dépense importante : Books (100€)',
    );

    expect(result.amount).toBe(100);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Verify all 5 doubles are used correctly
  // ─────────────────────────────────────────────────────────────
  it('should use all 5 collaborators correctly', async () => {
    const input: CreateExpenseInput = {
      groupId: 'group-5',
      description: 'Test all doubles',
      amount: 150,
      currency: 'EUR',
      paidBy: 'diana',
      paidAt: new Date('2024-01-15T16:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['diana', 'evan'] },
    };

    await service.create(input);

    // ✅ DUMMY: Logger was injected
    expect(dummyLogger).toBeDefined();
    expect(dummyLogger.info).toBeDefined();
    expect(dummyLogger.error).toBeDefined();

    // ✅ STUB: Clock returns hardcoded date
    expect(stubClock.now()).toEqual(fixedDate);

    // ✅ STUB: IdGen generates IDs
    expect(stubIdGen.next).toHaveBeenCalled();

    // ✅ SPY: Repository.save was called
    expect(spyRepo.save).toHaveBeenCalled();
    const savedExpense = (spyRepo.save as any).mock.calls[0][0];
    expect(savedExpense.description).toBe('Test all doubles');

    // ✅ MOCK: Notifier was called for large expense
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalled();
    const [groupId, message] = (mockNotifier.notifyGroupMembers as any).mock.calls[0];
    expect(groupId).toBe('group-5');
    expect(message).toContain('Test all doubles');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Verify idempotency — different calls use different IDs
  // ─────────────────────────────────────────────────────────────
  it('should not reuse IDs across different calls', async () => {
    const input1: CreateExpenseInput = {
      groupId: 'group-6',
      description: 'First',
      amount: 30,
      currency: 'EUR',
      paidBy: 'alice',
      paidAt: new Date('2024-01-15T17:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['alice'] },
    };

    const input2: CreateExpenseInput = {
      groupId: 'group-6',
      description: 'Second',
      amount: 40,
      currency: 'EUR',
      paidBy: 'bob',
      paidAt: new Date('2024-01-15T18:00:00Z'),
      split: { mode: 'equal', beneficiaries: ['bob'] },
    };

    const result1 = await service.create(input1);
    const result2 = await service.create(input2);

    expect(result1.id).not.toBe(result2.id);
    expect(result1.id).toBe('exp-001');
    expect(result2.id).toBe('exp-002');
  });
});
