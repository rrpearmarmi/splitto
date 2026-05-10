import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Group, Expense } from '../../src/domain/types';

describe('computeBalances', () => {
  const createMember = (id: string, name: string) => ({
    id,
    name,
    email: `${id}@example.com`,
  });

  const createGroup = (members: ReturnType<typeof createMember>[]): Group => ({
    id: 'group1',
    name: 'Test Group',
    currency: 'EUR',
    members,
  });

  const createExpense = (
    paidBy: string,
    amount: number,
    split: any,
  ): Expense => ({
    id: `expense${Math.random()}`,
    groupId: 'group1',
    description: 'Test expense',
    amount,
    currency: 'EUR',
    paidBy,
    paidAt: new Date(),
    split,
    createdAt: new Date(),
  });

  const roundBalance = (balance: number) => Math.round(balance * 100) / 100;

  describe('Cas obligatoires', () => {
    it('Groupe vide → tous les soldes sont 0', () => {
      const group = createGroup([]);
      const balances = computeBalances(group, []);
      expect(balances).toEqual({});
    });

    it('Cas 1: Une dépense equal entre 3 personnes (payeur inclus)', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const charlie = createMember('charlie', 'Charlie');
      const group = createGroup([alice, bob, charlie]);

      const expense = createExpense('alice', 30, {
        mode: 'equal',
        beneficiaries: ['alice', 'bob', 'charlie'],
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(20);
      expect(roundBalance(balances['bob'])).toBe(-10);
      expect(roundBalance(balances['charlie'])).toBe(-10);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Cas 2: Une dépense equal entre 3 personnes (payeur PAS bénéficiaire)', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const charlie = createMember('charlie', 'Charlie');
      const group = createGroup([alice, bob, charlie]);

      const expense = createExpense('alice', 30, {
        mode: 'equal',
        beneficiaries: ['bob', 'charlie'],
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(30);
      expect(roundBalance(balances['bob'])).toBe(-15);
      expect(roundBalance(balances['charlie'])).toBe(-15);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Cas 3: Plusieurs dépenses qui se compensent partiellement', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense1 = createExpense('alice', 50, {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      });

      const expense2 = createExpense('bob', 30, {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      });

      const balances = computeBalances(group, [expense1, expense2]);

      expect(roundBalance(balances['alice'])).toBe(10);
      expect(roundBalance(balances['bob'])).toBe(-10);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Cas 4: Une dépense weighted avec poids non-uniformes', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const charlie = createMember('charlie', 'Charlie');
      const group = createGroup([alice, bob, charlie]);

      const expense = createExpense('alice', 100, {
        mode: 'weighted',
        weights: {
          alice: 2,
          bob: 1,
          charlie: 1,
        },
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(50);
      expect(roundBalance(balances['bob'])).toBe(-25);
      expect(roundBalance(balances['charlie'])).toBe(-25);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Cas 5: Une dépense percentage avec arrondis', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const charlie = createMember('charlie', 'Charlie');
      const group = createGroup([alice, bob, charlie]);

      const expense = createExpense('alice', 100, {
        mode: 'percentage',
        percentages: {
          alice: 33.33,
          bob: 33.33,
          charlie: 33.34,
        },
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(66.67);
      expect(roundBalance(balances['bob'])).toBe(-33.33);
      expect(roundBalance(balances['charlie'])).toBe(-33.34);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });
  });

  describe('Cas limites', () => {
    it('Limite 1: Membre supprimé qui figure dans une vieille dépense', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense = createExpense('alice', 30, {
        mode: 'equal',
        beneficiaries: ['alice', 'bob', 'deleted-member'],
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(15);
      expect(roundBalance(balances['bob'])).toBe(-15);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Limite 2: Dépense de 0€', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense = createExpense('alice', 0, {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      });

      const balances = computeBalances(group, [expense]);

      expect(balances['alice']).toBe(0);
      expect(balances['bob']).toBe(0);
    });

    it('Limite 3: Dépense avec un seul bénéficiaire (le payeur lui-même)', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense = createExpense('alice', 50, {
        mode: 'equal',
        beneficiaries: ['alice'],
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(50);
      expect(roundBalance(balances['bob'])).toBe(0);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Limite 4: Liste vide de dépenses', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const balances = computeBalances(group, []);

      expect(balances['alice']).toBe(0);
      expect(balances['bob']).toBe(0);
    });

    it('Limite 5: Très grand nombre de membres (12)', () => {
      const members = Array.from({ length: 12 }, (_, i) =>
        createMember(`member${i}`, `Member ${i}`)
      );
      const group = createGroup(members);

      const beneficiaries = members.map(m => m.id);
      const expense = createExpense(members[0].id, 120, {
        mode: 'equal',
        beneficiaries,
      });

      const balances = computeBalances(group, [expense]);

      Object.entries(balances).forEach(([memberId, balance]) => {
        if (memberId === members[0].id) {
          expect(roundBalance(balance)).toBe(110);
        } else {
          expect(roundBalance(balance)).toBe(-10);
        }
      });

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Limite 6: Pourcentages qui ne somment pas exactement à 100', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const charlie = createMember('charlie', 'Charlie');
      const group = createGroup([alice, bob, charlie]);

      const expense = createExpense('alice', 100, {
        mode: 'percentage',
        percentages: {
          alice: 40,
          bob: 35,
          charlie: 20,
        },
      });

      const balances = computeBalances(group, [expense]);

      expect(roundBalance(balances['alice'])).toBe(60);
      expect(roundBalance(balances['bob'])).toBe(-35);
      expect(roundBalance(balances['charlie'])).toBe(-20);

      const sum = Object.values(balances).reduce((a, b) => a + b, 0);
      expect(roundBalance(sum)).toBe(0);
    });

    it('Limite 7: Payeur qui ne figure pas dans le groupe', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense = createExpense('unknown', 30, {
        mode: 'equal',
        beneficiaries: ['alice', 'bob'],
      });

      const balances = computeBalances(group, [expense]);

      expect(balances['alice']).toBe(0);
      expect(balances['bob']).toBe(0);
    });

    it('Limite 8: Poids qui somment à 0 (cas invalide)', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense = createExpense('alice', 50, {
        mode: 'weighted',
        weights: {
          alice: 0,
          bob: 0,
        },
      });

      const balances = computeBalances(group, [expense]);

      expect(balances['alice']).toBe(0);
      expect(balances['bob']).toBe(0);
    });

    it('Limite 9: Pourcentages qui somment à 0 (cas invalide)', () => {
      const alice = createMember('alice', 'Alice');
      const bob = createMember('bob', 'Bob');
      const group = createGroup([alice, bob]);

      const expense = createExpense('alice', 50, {
        mode: 'percentage',
        percentages: {
          alice: 0,
          bob: 0,
        },
      });

      const balances = computeBalances(group, [expense]);

      expect(balances['alice']).toBe(0);
      expect(balances['bob']).toBe(0);
    });
  });
});
