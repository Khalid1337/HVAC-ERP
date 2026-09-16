import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /api/invoices - Create new invoice
router.post('/', async (req: Request, res: Response) => {
  const { customer_id, items, status, warranty_terms } = req.body;
  const date = new Date().toISOString().split('T')[0]; 

  try {
    if (!customer_id) {
      return res.status(400).json({ error: "Missing customer association profile." });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cannot process an empty invoice table." });
    }

    const countResult = await db.get('SELECT COUNT(*) as count FROM invoices');
    const nextNumber = (countResult?.count || 0) + 1;
    const invoice_id = `INV-${String(nextNumber).padStart(4, '0')}`;

    await db.run('BEGIN TRANSACTION');

    let total_amount = 0;

    for (const item of items) {
      const { type, item_id, quantity, unit_price } = item;
      const parsedQty = parseInt(quantity) || 0;
      const parsedPrice = parseFloat(unit_price) || 0;
      total_amount += parsedQty * parsedPrice;

      if (type === 'part') {
        if (!item_id) {
          throw new Error("Invalid part reference item inside invoice selection dropdown.");
        }

        const inventoryItem = await db.get('SELECT quantity, name FROM inventory WHERE id = ?', [item_id]);

        if (!inventoryItem) {
          throw new Error("Selected part profile does not exist in local database.");
        }

        if (inventoryItem.quantity < parsedQty) {
          throw new Error(`Insufficient Stock for "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${parsedQty}`);
        }

        await db.run(
          'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
          [parsedQty, item_id]
        );
      }

      const item_line_id = 'ITM-' + Math.random().toString(36).substr(2, 9);
      await db.run(
        'INSERT INTO invoice_items (id, invoice_id, type, item_id, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item_line_id, invoice_id, type, item_id || null, item.description || 'HVAC Service Item', parsedQty, parsedPrice]
      );
    }

    await db.run(
      'INSERT INTO invoices (id, customer_id, date, total_amount, status, warranty_terms) VALUES (?, ?, ?, ?, ?, ?)',
      [invoice_id, customer_id, date, total_amount, status || 'unpaid', warranty_terms || '1 week checking warranty']
    );

    await db.run('COMMIT');

    res.status(201).json({
      message: '🎉 Invoice processed successfully!',
      invoice_id,
      total_amount
    });

  } catch (error: any) {
    await db.run('ROLLBACK');
    console.error("❌ Transaction Failed:", error.message);
    res.status(400).json({ error: error.message || 'Failed to process transaction.' });
  }
});

// GET /api/invoices - Fetch all generated invoices cleanly
router.get('/', async (req: Request, res: Response) => {
  try {
    const invoices = await db.all(`
      SELECT 
        invoices.*, 
        invoices.date AS created_at,
        COALESCE(customers.name, 'Unknown Customer') AS customer_name 
      FROM invoices 
      LEFT JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
    `);
    res.json(invoices || []);
  } catch (error: any) {
    console.error('Failed to fetch invoice ledger archive:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch invoice ledger archive.' });
  }
});

// GET /api/invoices/:id/items - Fetch line items for an invoice
router.get('/:id/items', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const items = await db.all(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [id]
    );
    res.json(items);
  } catch (error) {
    console.error('Failed to fetch invoice items:', error);
    res.status(500).json({ error: 'Failed to retrieve invoice line items.' });
  }
});

// PATCH /api/invoices/:id/status - Quick status update
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, paid_amount } = req.body;

  if (!['paid', 'unpaid', 'partial'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payment status' });
  }

  try {
    const invoice = await db.get('SELECT total_amount, paid_amount FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const requestedPaidAmount = paid_amount === undefined
      ? invoice.paid_amount || 0
      : Number(paid_amount);
    const normalizedPaidAmount = status === 'paid'
      ? Number(invoice.total_amount) || 0
      : status === 'unpaid'
        ? 0
        : requestedPaidAmount;

    if (!Number.isFinite(normalizedPaidAmount) || normalizedPaidAmount < 0 || normalizedPaidAmount > invoice.total_amount) {
      return res.status(400).json({ error: 'Paid amount must be between zero and the invoice total.' });
    }

    await db.run(
      'UPDATE invoices SET status = ?, paid_amount = ? WHERE id = ?',
      [status, normalizedPaidAmount, id]
    );
    return res.json({ success: true, id, status, paid_amount: normalizedPaidAmount });
  } catch (error: any) {
    console.error('Failed to update invoice status:', error.message || error);
    return res.status(500).json({ error: 'Database update failed' });
  }
});

// PUT /api/invoices/:id - Update complete invoice details and handle inventory adjustments
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { customer_id, items, status, warranty_terms } = req.body;

  try {
    if (!customer_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer ID and items are required.' });
    }

    await db.run('BEGIN TRANSACTION');

    // 1. Fetch old items to restore stock before updating
    const oldItems = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
    for (const oldItem of oldItems) {
      if (oldItem.type === 'part' && oldItem.item_id) {
        await db.run('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [oldItem.quantity, oldItem.item_id]);
      }
    }

    // 2. Clear old invoice items
    await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

    // 3. Re-process new items and deduct fresh inventory amounts
    let total_amount = 0;
    for (const item of items) {
      const { type, item_id, quantity, unit_price } = item;
      const parsedQty = parseInt(quantity) || 0;
      const parsedPrice = parseFloat(unit_price) || 0;
      total_amount += parsedQty * parsedPrice;

      if (type === 'part') {
        if (!item_id) throw new Error("Invalid part reference in selection.");

        const inventoryItem = await db.get('SELECT quantity, name FROM inventory WHERE id = ?', [item_id]);
        if (!inventoryItem || inventoryItem.quantity < parsedQty) {
          throw new Error(`Insufficient Stock for "${inventoryItem?.name || 'Item'}".`);
        }

        await db.run('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [parsedQty, item_id]);
      }

      const item_line_id = 'ITM-' + Math.random().toString(36).substr(2, 9);
      await db.run(
        'INSERT INTO invoice_items (id, invoice_id, type, item_id, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item_line_id, id, type, item_id || null, item.description || 'HVAC Service Item', parsedQty, parsedPrice]
      );
    }

    // 4. Update main invoice table
    await db.run(
      'UPDATE invoices SET customer_id = ?, total_amount = ?, status = ?, warranty_terms = ? WHERE id = ?',
      [customer_id, total_amount, status || 'unpaid', warranty_terms || '1 week checking warranty', id]
    );

    await db.run('COMMIT');
    res.json({ success: true, message: 'Invoice updated successfully!', total_amount });

  } catch (error: any) {
    await db.run('ROLLBACK');
    console.error('Failed to update invoice:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to update invoice.' });
  }
});

// DELETE /api/invoices/:id - Delete invoice & restore stock
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await db.run('BEGIN TRANSACTION');

    // 1. Get associated line items and return parts stock to warehouse
    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
    for (const item of items) {
      if (item.type === 'part' && item.item_id) {
        await db.run(
          'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
          [item.quantity, item.item_id]
        );
      }
    }

    // 2. Delete invoice line items
    await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

    // 3. Delete invoice main record
    await db.run('DELETE FROM invoices WHERE id = ?', [id]);

    await db.run('COMMIT');
    res.json({ success: true, message: 'Invoice deleted and stock restored successfully.' });

  } catch (error: any) {
    await db.run('ROLLBACK');
    console.error('Failed to delete invoice:', error.message || error);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
});

export default router;
