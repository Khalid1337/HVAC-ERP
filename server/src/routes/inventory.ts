import { Router, Request, Response } from 'express';
import { db } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/inventory - Fetch all HVAC parts
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await db.all('SELECT * FROM inventory ORDER BY name ASC');
    res.json(items || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
});

// POST /api/inventory - Add a new HVAC item to stock
router.post('/', async (req: Request, res: Response) => {
  const { name, description, quantity, unit_cost, reorder_level, purchase_date } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Item name is required.' });
  }

  const id = randomUUID();

  try {
    await db.run(
      'INSERT INTO inventory (id, name, description, quantity, unit_cost, reorder_level, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, description || '', parseInt(quantity) || 0, parseFloat(unit_cost) || 0, parseInt(reorder_level) || 0, purchase_date || new Date().toISOString().slice(0, 10)]
    );
    res.status(201).json({ id, name, description, quantity, unit_cost, reorder_level, purchase_date: purchase_date || new Date().toISOString().slice(0, 10) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

// PUT /api/inventory/:id - Update inventory item
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, quantity, unit_cost, reorder_level, purchase_date } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Item name is required.' });
  }

  try {
    const result = await db.run(
      'UPDATE inventory SET name = ?, description = ?, quantity = ?, unit_cost = ?, reorder_level = ?, purchase_date = ? WHERE id = ?',
      [name, description || '', parseInt(quantity) || 0, parseFloat(unit_cost) || 0, parseInt(reorder_level) || 0, purchase_date || null, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    res.json({ message: 'Inventory item updated successfully', item: { id, name, description, quantity, unit_cost, reorder_level, purchase_date: purchase_date || null } });
  } catch (error: any) {
    console.error('Inventory Update Error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// DELETE /api/inventory/:id - Delete item from stock
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await db.run('DELETE FROM inventory WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    res.json({ message: 'Inventory item deleted successfully', id });
  } catch (error: any) {
    console.error('Inventory Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

export default router;
