import { Router, Request, Response } from 'express';
import { db } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/jobs - Fetch all repair jobs with customer info
router.get('/', async (req: Request, res: Response) => {
  try {
    const jobs = await db.all(`
      SELECT j.*, c.name as customer_name, c.phone as customer_phone 
      FROM service_jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      ORDER BY j.created_at DESC
    `);
    res.json(jobs || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workshop jobs' });
  }
});

// POST /api/jobs - Intake a new unit into the repair center
router.post('/', async (req: Request, res: Response) => {
  const { customer_id, item_description, serial_number, fault_reported } = req.body;

  if (!customer_id || !item_description) {
    return res.status(400).json({ error: 'Customer and item description are required.' });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const initialStatus = 'Intake';

  try {
    await db.run(
      'INSERT INTO service_jobs (id, customer_id, item_description, serial_number, status, fault_reported, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, customer_id, item_description, serial_number || '', initialStatus, fault_reported || '', createdAt]
    );

    // Create initial log entry
    await db.run(
      'INSERT INTO job_logs (id, job_id, stage, notes, logged_at) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), id, initialStatus, `Unit received. Fault: ${fault_reported || 'None specified'}`, createdAt]
    );

    res.status(201).json({ id, customer_id, item_description, serial_number, status: initialStatus, fault_reported, created_at: createdAt });
  } catch (error: any) {
    console.error('Job Intake Error:', error);
    res.status(500).json({ error: 'Failed to create service job' });
  }
});

// POST /api/jobs/:id/logs - Add a stage update/repair action (e.g., replace gas, copper pipes)
router.post('/:id/logs', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stage, notes } = req.body;

  if (!stage || !notes) {
    return res.status(400).json({ error: 'Stage and repair notes are required.' });
  }

  const logId = randomUUID();
  const loggedAt = new Date().toISOString();

  try {
    // Insert history log
    await db.run(
      'INSERT INTO job_logs (id, job_id, stage, notes, logged_at) VALUES (?, ?, ?, ?, ?)',
      [logId, id, stage, notes, loggedAt]
    );

    // Update main job status if changed
    await db.run('UPDATE service_jobs SET status = ? WHERE id = ?', [stage, id]);

    res.status(201).json({ id: logId, job_id: id, stage, notes, logged_at: loggedAt });
  } catch (error: any) {
    console.error('Job Log Error:', error);
    res.status(500).json({ error: 'Failed to record job update' });
  }
});

// GET /api/jobs/:id/logs - Get granular history for a unit
router.get('/:id/logs', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const logs = await db.all('SELECT * FROM job_logs WHERE job_id = ? ORDER BY logged_at ASC', [id]);
    res.json(logs || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job history' });
  }
});

// GET /api/jobs/:id/costs - Get repair costs assigned to a unit
router.get('/:id/costs', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const costs = await db.all(
      'SELECT * FROM repair_costs WHERE job_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json(costs || []);
  } catch (error) {
    console.error('Failed to fetch repair costs:', error);
    res.status(500).json({ error: 'Failed to fetch repair costs' });
  }
});

// POST /api/jobs/:id/costs - Record an in-house or outsourced repair cost
router.post('/:id/costs', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { source, inventory_item_id, description, quantity, amount } = req.body;
  const parsedQuantity = parseInt(quantity, 10) || 0;

  if (!['in_house', 'outsourced'].includes(source)) {
    return res.status(400).json({ error: 'Repair cost source must be in-house or outsourced.' });
  }
  if (parsedQuantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than zero.' });
  }
  if (source === 'outsourced' && (!description || Number(amount) <= 0)) {
    return res.status(400).json({ error: 'Outsourced part description and amount are required.' });
  }
  if (source === 'in_house' && !inventory_item_id) {
    return res.status(400).json({ error: 'Select an in-house inventory part.' });
  }

  try {
    await db.run('BEGIN TRANSACTION');

    const job = await db.get('SELECT id FROM service_jobs WHERE id = ?', [id]);
    if (!job) {
      throw new Error('Workshop repair job not found.');
    }

    let costDescription = String(description || '').trim();
    let unitCost = 0;
    let totalAmount = Number(amount) || 0;

    if (source === 'in_house') {
      const inventoryItem = await db.get(
        'SELECT name, quantity, unit_cost FROM inventory WHERE id = ?',
        [inventory_item_id]
      );
      if (!inventoryItem) {
        throw new Error('Selected inventory part was not found.');
      }
      if (inventoryItem.quantity < parsedQuantity) {
        throw new Error(`Insufficient stock for "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${parsedQuantity}`);
      }

      costDescription = inventoryItem.name;
      unitCost = Number(inventoryItem.unit_cost) || 0;
      totalAmount = unitCost * parsedQuantity;
      await db.run(
        'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
        [parsedQuantity, inventory_item_id]
      );
    } else {
      unitCost = totalAmount / parsedQuantity;
    }

    const createdAt = new Date().toISOString();
    const costId = randomUUID();
    await db.run(
      `INSERT INTO repair_costs
        (id, job_id, source, inventory_item_id, description, quantity, unit_cost, total_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [costId, id, source, source === 'in_house' ? inventory_item_id : null, costDescription, parsedQuantity, unitCost, totalAmount, createdAt]
    );

    await db.run(
      'INSERT INTO expenses (id, date, category, amount, notes) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), createdAt.slice(0, 10), source === 'in_house' ? 'Workshop In-House Part' : 'Workshop Outsourced Part', totalAmount, `${costDescription} for repair job ${id}`]
    );

    await db.run('COMMIT');
    res.status(201).json({ id: costId, job_id: id, source, description: costDescription, quantity: parsedQuantity, unit_cost: unitCost, total_amount: totalAmount, created_at: createdAt });
  } catch (error: any) {
    await db.run('ROLLBACK');
    console.error('Failed to record repair cost:', error.message || error);
    res.status(400).json({ error: error.message || 'Failed to record repair cost.' });
  }
});

export default router;
