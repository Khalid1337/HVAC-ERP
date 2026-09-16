import { Router, Request, Response } from 'express';
import { db } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/customers - Get all customer profiles
router.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await db.all('SELECT * FROM customers ORDER BY name ASC');
    res.json(customers || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/customers - Register a new customer record
router.post('/', async (req: Request, res: Response) => {
  const { name, phone, address, email } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required.' });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await db.run(
      'INSERT INTO customers (id, name, phone, address, email, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, phone, address || '', email || '', createdAt]
    );
    res.status(201).json({ id, name, phone, address: address || '', email: email || '', created_at: createdAt });
  } catch (error: any) {
    console.error('Customer Creation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create customer record' });
  }
});

// GET /api/customers/:id/business - Get invoice history and business totals
router.get('/:id/business', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const customer = await db.get('SELECT id FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer record not found.' });
    }

    const business = await db.all(`
      SELECT
        invoices.id,
        invoices.date,
        invoices.total_amount,
        CASE
          WHEN invoices.status = 'paid' THEN invoices.total_amount
          ELSE COALESCE(invoices.paid_amount, 0)
        END AS paid_amount,
        invoices.status,
        COALESCE(
          GROUP_CONCAT(CASE WHEN invoice_items.type = 'service' THEN invoice_items.description END, ', '),
          'No service description'
        ) AS services
      FROM invoices
      LEFT JOIN invoice_items ON invoice_items.invoice_id = invoices.id
      WHERE invoices.customer_id = ?
      GROUP BY invoices.id
      ORDER BY invoices.date DESC, invoices.id DESC
    `, [id]);

    const summary = business.reduce((totals: { total_billed: number; total_collected: number }, invoice: { total_amount: number; paid_amount: number }) => ({
      total_billed: totals.total_billed + (Number(invoice.total_amount) || 0),
      total_collected: totals.total_collected + (Number(invoice.paid_amount) || 0)
    }), { total_billed: 0, total_collected: 0 });

    res.json({ invoices: business, ...summary });
  } catch (error: any) {
    console.error('Failed to fetch customer business history:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch customer business history.' });
  }
});

// PUT /api/customers/:id - Update customer profile
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, phone, address, email } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required.' });
  }

  try {
    const result = await db.run(
      'UPDATE customers SET name = ?, phone = ?, address = ?, email = ? WHERE id = ?',
      [name, phone, address || '', email || '', id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Customer record not found.' });
    }

    res.json({ message: 'Customer updated successfully', customer: { id, name, phone, address, email } });
  } catch (error: any) {
    console.error('Customer Update Error:', error);
    res.status(500).json({ error: 'Failed to update customer profile' });
  }
});

// DELETE /api/customers/:id - Delete customer profile
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Optional: Check if customer has associated invoices before deleting
    const invoiceCheck = await db.get('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?', [id]);
    if (invoiceCheck && invoiceCheck.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete customer. They have ${invoiceCheck.count} associated invoice(s).` 
      });
    }

    const result = await db.run('DELETE FROM customers WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Customer record not found.' });
    }

    res.json({ message: 'Customer deleted successfully', id });
  } catch (error: any) {
    console.error('Customer Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
