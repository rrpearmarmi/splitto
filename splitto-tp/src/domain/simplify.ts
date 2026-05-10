export type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export function simplifyDebts(balances: { [memberId: string]: number }): Settlement[] {
  const settlements: Settlement[] = [];
  
 
  const debtors = Object.entries(balances)
    .filter(([_, b]) => b < 0)
    .map(([id, b]) => ({ id, balance: b }));
  
  const creditors = Object.entries(balances)
    .filter(([_, b]) => b > 0)
    .map(([id, b]) => ({ id, balance: b }));
  
  
  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[0];
    
    const amount = Math.min(-debtor.balance, creditor.balance);
    
    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount
    });
    
    debtor.balance += amount;
    creditor.balance -= amount;
    
    if (debtor.balance === 0) debtors.shift();
    if (creditor.balance === 0) creditors.shift();
  }
  
  return settlements;
}