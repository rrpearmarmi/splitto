export type Settlement = {
  from: string;
  to: string;
  amount: number;
};

function findLargestDebtor(debtors: Array<{ id: string; balance: number }>): { id: string; balance: number } | null {
  if (debtors.length === 0) return null;
  return debtors.reduce((max, current) => current.balance < max.balance ? current : max);
}

function findLargestCreditor(creditors: Array<{ id: string; balance: number }>): { id: string; balance: number } | null {
  if (creditors.length === 0) return null;
  return creditors.reduce((max, current) => current.balance > max.balance ? current : max);
}

function removeSettledParty(parties: Array<{ id: string; balance: number }>, party: { id: string; balance: number }): void {
  const index = parties.indexOf(party);
  if (index > -1) {
    parties.splice(index, 1);
  }
}

export function simplifyDebts(balances: { [memberId: string]: number }): Settlement[] {
  const settlements: Settlement[] = [];
  
  const debtors = Object.entries(balances)
    .filter(([_, b]) => b < 0)
    .map(([id, b]) => ({ id, balance: b }));
  
  const creditors = Object.entries(balances)
    .filter(([_, b]) => b > 0)
    .map(([id, b]) => ({ id, balance: b }));
  
  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = findLargestDebtor(debtors)!;
    const creditor = findLargestCreditor(creditors)!;
    
    const amount = Math.min(-debtor.balance, creditor.balance);
    
    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount
    });
    
    debtor.balance += amount;
    creditor.balance -= amount;
    
    if (debtor.balance === 0) removeSettledParty(debtors, debtor);
    if (creditor.balance === 0) removeSettledParty(creditors, creditor);
  }
  
  return settlements;
}