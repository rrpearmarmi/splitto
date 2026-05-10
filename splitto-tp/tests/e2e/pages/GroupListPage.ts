import type { Page } from '@playwright/test';

export class GroupListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async clickCreateGroup() {
    await this.page.getByRole('button', { name: /créer un groupe/i }).click();
  }

  async openGroup(name: string) {
    await this.page.getByRole('link', { name }).click();
  }

  async isGroupVisible(name: string): Promise<boolean> {
    return this.page.getByRole('link', { name }).isVisible();
  }
}