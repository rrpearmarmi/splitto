import type { Page } from '@playwright/test';

export class AddExpensePage {
  constructor(private page: Page) {}

  async fillDescription(description: string) {
    await this.page.getByLabel(/description/i).fill(description);
  }

  async fillAmount(amount: number) {
    await this.page.getByLabel(/montant/i).fill(String(amount));
  }

  async selectPaidBy(memberName: string) {
    await this.page.getByLabel(/payé par/i).selectOption({ label: memberName });
  }

  async submit() {
    await this.page.getByRole('button', { name: /ajouter|valider|confirmer/i }).click();
  }
}