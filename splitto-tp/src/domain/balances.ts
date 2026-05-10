import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  const balances: Balances = {};

  group.members.forEach(member => {
    balances[member.id] = 0;
  });

  const memberIds = new Set(group.members.map(m => m.id));

  expenses.forEach(expense => {
    if (!memberIds.has(expense.paidBy)) {
      return;
    }

    const split = expense.split;
    
    if (split.mode === 'equal') {
      const beneficiaries = split.beneficiaries.filter(id => memberIds.has(id));
      
      if (beneficiaries.length === 0) {
        return;
      }

      balances[expense.paidBy] += expense.amount;
      const sharePerPerson = expense.amount / beneficiaries.length;
      
      beneficiaries.forEach(memberId => {
        balances[memberId] -= sharePerPerson;
      });
    } 
    else if (split.mode === 'weighted') {
      const validWeights: Record<string, number> = {};
      let totalWeight = 0;

      Object.entries(split.weights).forEach(([memberId, weight]) => {
        if (memberIds.has(memberId)) {
          validWeights[memberId] = weight;
          totalWeight += weight;
        }
      });

      if (totalWeight === 0) {
        return;
      }

      balances[expense.paidBy] += expense.amount;

      Object.entries(validWeights).forEach(([memberId, weight]) => {
        const share = (weight / totalWeight) * expense.amount;
        balances[memberId] -= share;
      });
    } 
    else if (split.mode === 'percentage') {
      const validPercentages: Record<string, number> = {};
      let totalPercentage = 0;

      Object.entries(split.percentages).forEach(([memberId, percentage]) => {
        if (memberIds.has(memberId)) {
          validPercentages[memberId] = percentage;
          totalPercentage += percentage;
        }
      });

      if (totalPercentage === 0) {
        return;
      }

      balances[expense.paidBy] += expense.amount;

      const memberEntries = Object.entries(validPercentages);
      memberEntries.forEach(([memberId, percentage], index) => {
        let share: number;
        
        if (index === memberEntries.length - 1) {
          const alreadyDistributed = memberEntries
            .slice(0, -1)
            .reduce((sum, [, pct]) => {
              return sum + (pct / totalPercentage) * expense.amount;
            }, 0);
          share = expense.amount - alreadyDistributed;
        } else {
          share = (percentage / totalPercentage) * expense.amount;
        }
        
        balances[memberId] -= share;
      });
    }
  });

  return balances;
}