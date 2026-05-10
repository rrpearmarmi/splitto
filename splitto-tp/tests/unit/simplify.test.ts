import { describe, it, expect } from 'vitest';
import { simplifyDebts, Settlement } from '../../domain/simplify';

describe('simplifyDebts', () => {
  it('should handle 2 people: one debtor, one creditor', () => {
    const result = simplifyDebts({ a: 10, b: -10 });
    expect(result).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('should handle 3 people in triangle (skip intermediate)', () => {
    const result = simplifyDebts({ a: 10, b: 0, c: -10 });
    expect(result).toEqual([{ from: 'c', to: 'a', amount: 10 }]);
  });

  it('should handle 4 people with complex circular debt', () => {
    const result = simplifyDebts({ a: 30, b: -20, c: -10, d: 0 });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from: 'b', to: 'a', amount: 20 });
    expect(result).toContainEqual({ from: 'c', to: 'a', amount: 10 });
  });
  it('should return empty array for empty balances', () => {
    const result = simplifyDebts({});
    expect(result).toEqual([]);
  });

  it('should return empty array when all members are balanced', () => {
    const result = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(result).toEqual([]);
  });
  it('should handle multiple debtors and creditors', () => {
    const result = simplifyDebts({ a: 20, b: 10, c: -15, d: -15 });
    expect(result).toHaveLength(2);
    expect(result.some(s => s.amount === 15)).toBe(true);
    expect(result.some(s => s.amount === 20)).toBe(true);
  });
});