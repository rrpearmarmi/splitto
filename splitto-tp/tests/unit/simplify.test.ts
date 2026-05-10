import { describe, it, expect } from 'vitest';
import { simplifyDebts, Settlement } from '../../domain/simplify';

describe('simplifyDebts', () => {
  it('should handle 2 people: one debtor, one creditor', () => {
    const result = simplifyDebts({ a: 10, b: -10 });
    expect(result).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });
});