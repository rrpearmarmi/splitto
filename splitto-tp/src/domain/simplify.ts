export type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export function simplifyDebts(balances: { [memberId: string]: number }): Settlement[] {
  const settlements: Settlement[] = [];
  
  const entries = Object.entries(balances);
  const creditor = entries.find(([_, balance]) => balance > 0);
  const debtor = entries.find(([_, balance]) => balance < 0);
  
  if (creditor && debtor) {
    settlements.push({
      from: debtor[0],
      to: creditor[0],
      amount: creditor[1]
    });
  }
  
  return settlements;
}