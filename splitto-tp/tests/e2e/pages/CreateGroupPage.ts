import type { Page } from '@playwright/test';

export class CreateGroupPage {
  constructor(private page: Page) {}

  async fillGroupName(name: string) {
    await this.page.getByLabel(/nom du groupe/i).fill(name);
  }

  async fillCurrency(currency: string) {
    await this.page.getByLabel(/devise/i).fill(currency);
  }

  // Clique sur "Ajouter un membre" puis remplit le dernier champ apparu
  async addMember(name: string) {
    await this.page.getByRole('button', { name: /ajouter un membre/i }).click();
    await this.page.getByLabel(/membre/i).last().fill(name);
  }

  async submit() {
    await this.page.getByRole('button', { name: /créer|valider|confirmer/i }).click();
  }
}