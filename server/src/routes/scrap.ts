import { Router, Request, Response } from 'express';
import { db } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await db.all('SELECT * FROM scrap_inventory ORDER BY acquired_date DESC');
    res.json(items || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scrap inventory' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { item_description, category, purchase_cost } = req.body;
  if (!item_description || purchase_cost === undefined) {
    return res.status(400).json({ error: 'Item description and purchase cost are required.' });
  }

  const id = randomUUID();
  const acquiredDate = new Date().toISOString();

  try {
    // 1. Insert into scrap inventory
    await db.run(
      `INSERT INTO scrap_inventory (id, item_description, category, purchase_cost, status, acquired_date) VALUES (?, ?, ?, ?, 'In Stock', ?)`,
      [id, item_description, category || 'AC', purchase_cost, acquiredDate]
    );

    // 2. Automatically log the purchase cost as an expense so it deducts from current month's earnings
    const expenseId = randomUUID();
    await db.run(
      `INSERT INTO expenses (id, date, category, amount, notes) VALUES (?, ?, ?, ?, ?)`,
      [expenseId, acquiredDate, 'Scrap Purchase', purchase_cost, `Purchase of scrap: ${item_description}`]
    );

    res.status(201).json({ id, item_description, category, purchase_cost, status: 'In Stock', acquired_date: acquiredDate });
  } catch (error) {
    console.error('Failed to add scrap item and expense log:', error);
    res.status(500).json({ error: 'Failed to add scrap item' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { item_description, category, purchase_cost, sold_price } = req.body;

  if (!item_description || purchase_cost === undefined) {
    return res.status(400).json({ error: 'Item description and purchase cost are required.' });
  }

  const parsedPurchaseCost = Number(purchase_cost);
  const parsedSoldPrice = sold_price === undefined || sold_price === '' ? null : Number(sold_price);

  if (!Number.isFinite(parsedPurchaseCost) || parsedPurchaseCost < 0 || (parsedSoldPrice !== null && (!Number.isFinite(parsedSoldPrice) || parsedSoldPrice < 0))) {
    return res.status(400).json({ error: 'Costs and sale price must be valid non-negative numbers.' });
  }

  try {
    const item = await db.get('SELECT * FROM scrap_inventory WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Scrap item not found' });
    }

    await db.run('BEGIN TRANSACTION');

    await db.run(
      `UPDATE scrap_inventory
       SET item_description = ?, category = ?, purchase_cost = ?, sold_price = ?
       WHERE id = ?`,
      [item_description, category || 'AC', parsedPurchaseCost, item.status === 'Sold' ? parsedSoldPrice : null, id]
    );

    const purchaseExpense = await db.get(
      `SELECT id FROM expenses WHERE category = 'Scrap Purchase' AND date = ? AND notes = ?`,
      [item.acquired_date, `Purchase of scrap: ${item.item_description}`]
    );
    if (purchaseExpense) {
      await db.run(
        `UPDATE expenses SET amount = ?, notes = ? WHERE id = ?`,
        [parsedPurchaseCost, `Purchase of scrap: ${item_description}`, purchaseExpense.id]
      );
    }

    if (item.status === 'Sold') {
      const saleExpense = await db.get(
        `SELECT id FROM expenses WHERE category = 'Scrap Sale Revenue' AND date = ? AND notes = ?`,
        [item.sold_date, `Sale of scrap: ${item.item_description}`]
      );
      if (saleExpense) {
        await db.run(
          `UPDATE expenses SET amount = ?, notes = ? WHERE id = ?`,
          [-(parsedSoldPrice || 0), `Sale of scrap: ${item_description}`, saleExpense.id]
        );
      }
    }

    await db.run('COMMIT');
    const updatedItem = await db.get('SELECT * FROM scrap_inventory WHERE id = ?', [id]);
    res.json(updatedItem);
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Failed to edit scrap item:', error);
    res.status(500).json({ error: 'Failed to edit scrap item' });
  }
});

router.patch('/:id/sell', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sold_price } = req.body;
  const soldDate = new Date().toISOString();
  const parsedSoldPrice = Number(sold_price) || 0;

  try {
    // Fetch the scrap item details first so we have the description for logging revenue/notes if needed
    const item = await db.get(`SELECT * FROM scrap_inventory WHERE id = ?`, [id]);
    if (!item) {
      return res.status(404).json({ error: 'Scrap item not found' });
    }

    // 1. Update scrap inventory status and sold price
    await db.run(
      `UPDATE scrap_inventory SET status = 'Sold', sold_price = ?, sold_date = ? WHERE id = ?`,
      [parsedSoldPrice, soldDate, id]
    );

    // 2. Log the sale. Depending on how your monthly earnings route computes revenue:
    // Option A: If revenue is calculated from invoices, you can insert a synthetic invoice or income entry.
    // Option B: If you track other revenue streams, you can add it as a negative expense or custom earnings log.
    // Here we log it as an income/revenue entry in expenses as a negative expense, or you can track it via an income table. 
    // A standard approach for ERP net earnings (Revenue - Expenses) is adding a positive income item or treating scrap sales as negative expenses (recovering cost/earning profit):
    const saleExpenseId = randomUUID();
    await db.run(
      `INSERT INTO expenses (id, date, category, amount, notes) VALUES (?, ?, ?, ?, ?)`,
      [saleExpenseId, soldDate, 'Scrap Sale Revenue', -parsedSoldPrice, `Sale of scrap: ${item.item_description}`]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark scrap item as sold:', error);
    res.status(500).json({ error: 'Failed to mark scrap item as sold' });
  }
});

export default router;
