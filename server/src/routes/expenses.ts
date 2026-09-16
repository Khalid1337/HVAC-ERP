import { Router, Request, Response } from 'express';
import { db } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { date, amount, notes } = req.body;
  const parsedAmount = Number(amount);
  const expenseDate = date || new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Expense amount must be greater than zero.' });
  }
  if (!notes || !String(notes).trim()) {
    return res.status(400).json({ error: 'Expense notes are required.' });
  }

  try {
    const expense = {
      id: randomUUID(),
      date: expenseDate,
      category: 'Daily Expense',
      amount: parsedAmount,
      notes: String(notes).trim()
    };

    await db.run(
      'INSERT INTO expenses (id, date, category, amount, notes) VALUES (?, ?, ?, ?, ?)',
      [expense.id, expense.date, expense.category, expense.amount, expense.notes]
    );

    res.status(201).json(expense);
  } catch (error: any) {
    console.error('Failed to create expense:', error.message || error);
    res.status(500).json({ error: 'Failed to save expense.' });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const expenses = await db.all('SELECT * FROM expenses ORDER BY date DESC');
    res.json(expenses || []);
  } catch (error) {
    console.error('Failed to fetch expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.get('/summary/monthly', async (req: Request, res: Response) => {
  const { month } = req.query;
  try {
    const revenueResult = await db.get(
      `SELECT SUM(total_amount) as total FROM invoices WHERE strftime('%Y-%m', date) = ?`,
      [month]
    );

    const expenseResult = await db.get(
      `SELECT SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', date) = ?`,
      [month]
    );

    const revenue = revenueResult?.total || 0;
    const expenses = expenseResult?.total || 0;
    const netEarnings = revenue - expenses;

    res.json({ month, revenue, expenses, netEarnings });
  } catch (error) {
    console.error('Failed to compute monthly financial ledger:', error);
    res.status(500).json({ error: 'Failed to compute monthly ledger' });
  }
});

router.get('/summary/lifetime', async (_req: Request, res: Response) => {
  try {
    const revenueResult = await db.get('SELECT SUM(total_amount) as total FROM invoices');
    const expenseResult = await db.get('SELECT SUM(amount) as total FROM expenses');

    const revenue = revenueResult?.total || 0;
    const expenses = expenseResult?.total || 0;

    res.json({ revenue, expenses, netEarnings: revenue - expenses });
  } catch (error) {
    console.error('Failed to compute lifetime financial ledger:', error);
    res.status(500).json({ error: 'Failed to compute lifetime ledger' });
  }
});

export default router;
