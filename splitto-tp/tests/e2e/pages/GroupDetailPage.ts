import type { Page } from '@playwright/test';

export class GroupDetailPage {
  constructor(private page: Page) {}

  async clickAddExpense() {
    await this.page.getByRole('button', { name: /ajouter une dépense/i }).click();
  }

  async isExpenseVisible(description: string): Promise<boolean> {
    return this.page.getByTestId('expense-item')
      .filter({ hasText: description })
      .isVisible();
  }

  async goToBalances() {
    await this.page.getByRole('link', { name: /soldes|balances/i }).click();
  }
}