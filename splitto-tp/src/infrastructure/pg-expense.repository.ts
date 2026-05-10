import { Pool } from 'pg';
import type { Expense } from '../../domain/types';
import type { ExpenseRepository } from '../../ports/expense.repository';

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly pool: Pool) {}

  async save(expense: Expense): Promise<void> {
    const query = `
      INSERT INTO expenses (
        id, group_id, description, amount, currency, paid_by, paid_at,
        split_mode, split_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        description = $3,
        amount = $4,
        currency = $5,
        paid_by = $6,
        paid_at = $7,
        split_mode = $8,
        split_data = $9,
        created_at = $10
    `;

    await this.pool.query(query, [
      expense.id,
      expense.groupId,
      expense.description,
      expense.amount,
      expense.currency,
      expense.paidBy,
      expense.paidAt,
      expense.split.mode,
      JSON.stringify(expense.split),
      expense.createdAt,
    ]);
  }

  async findById(id: string): Promise<Expense | null> {
    const query = `
      SELECT * FROM expenses WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToExpense(result.rows[0]);
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    const query = `
      SELECT * FROM expenses
      WHERE group_id = $1
      ORDER BY paid_at DESC
    `;

    const result = await this.pool.query(query, [groupId]);
    return result.rows.map(row => this.mapRowToExpense(row));
  }

  async findInDateRange(startDate: Date, endDate: Date): Promise<Expense[]> {
    const query = `
      SELECT * FROM expenses
      WHERE paid_at >= $1 AND paid_at <= $2
      ORDER BY paid_at DESC
    `;

    const result = await this.pool.query(query, [startDate, endDate]);
    return result.rows.map(row => this.mapRowToExpense(row));
  }

  private mapRowToExpense(row: any): Expense {
    return {
      id: row.id,
      groupId: row.group_id,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      paidBy: row.paid_by,
      paidAt: new Date(row.paid_at),
      split: JSON.parse(row.split_data),
      createdAt: new Date(row.created_at),
    };
  }
}