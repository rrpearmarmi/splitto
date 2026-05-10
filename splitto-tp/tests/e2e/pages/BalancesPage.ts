import type { Page } from '@playwright/test';

export class BalancesPage {
  constructor(private page: Page) {}

  // Retourne le solde numérique d'un membre (ex: "+20.00 €" → 20)
  async getBalanceForMember(memberName: string): Promise<number> {
    const row = this.page
      .getByTestId('balance-row')
      .filter({ hasText: memberName });

    const text = await row.getByTestId('balance-amount').innerText();
    // Garde le signe négatif éventuel + les chiffres/point
    return parseFloat(text.replace(/[^0-9.\-]/g, ''));
  }

  async getSettlementsCount(): Promise<number> {
    return this.page.getByTestId('settlement-item').count();
  }

  // Clique sur "Régler" du premier settlement de la liste
  async settleFirst() {
    await this.page
      .getByTestId('settlement-item')
      .first()
      .getByRole('button', { name: /régler/i })
      .click();
  }

  async confirmSettle() {
    await this.page.getByRole('button', { name: /confirmer/i }).click();
  }
}