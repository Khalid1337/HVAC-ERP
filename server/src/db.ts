import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

export let db: Database;
let dbPath = '';
let backupTimer: NodeJS.Timeout | undefined;

const backupDirectory = () => process.env.ERP_BACKUP_DIR || path.resolve(__dirname, '../backups');

export const backupDatabase = async () => {
  if (!db || !dbPath) {
    throw new Error('Database is not initialized');
  }

  await db.exec('PRAGMA wal_checkpoint(FULL)');
  await fs.promises.mkdir(backupDirectory(), { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory(), `erp-${timestamp}.db`);
  await fs.promises.copyFile(dbPath, backupPath);

  const backupFiles = (await fs.promises.readdir(backupDirectory()))
    .filter(file => /^erp-.*\.db$/.test(file))
    .sort()
    .reverse();

  await Promise.all(
    backupFiles.slice(30).map(file => fs.promises.unlink(path.join(backupDirectory(), file)))
  );

  console.log(`💾 [backup]: Database backup created at ${backupPath}`);
  return backupPath;
};

export const initDB = async (options: { createBackup?: boolean } = {}) => {
  dbPath = process.env.ERP_DB_PATH || path.resolve(__dirname, '../erp.db');

  // Diagnostic check: Does the file exist on disk and what is its size?
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log(`🔍 [database debug]: Found existing ERP database file at ${dbPath} (Size: ${stats.size} bytes)`);
  } else {
    console.warn(`⚠️ [database debug]: No database file found at ${dbPath}. A new one will be created.`);
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log(`💾 [database]: Connected to SQLite file at ${dbPath}`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, 
      name TEXT, 
      phone TEXT, 
      address TEXT, 
      email TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY, 
      name TEXT, 
      description TEXT, 
      quantity INTEGER, 
      unit_cost REAL, 
      reorder_level INTEGER,
      purchase_date TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, 
      customer_id TEXT, 
      date TEXT, 
      total_amount REAL, 
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT, 
      warranty_terms TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY, 
      invoice_id TEXT, 
      type TEXT, 
      item_id TEXT, 
      description TEXT, 
      quantity INTEGER, 
      unit_price REAL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY, 
      date TEXT, 
      category TEXT, 
      amount REAL, 
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS service_jobs (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      item_description TEXT,
      serial_number TEXT,
      status TEXT,
      fault_reported TEXT,
      created_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS job_logs (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      stage TEXT,
      notes TEXT,
      logged_at TEXT,
      FOREIGN KEY (job_id) REFERENCES service_jobs(id)
    );

    CREATE TABLE IF NOT EXISTS repair_costs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      source TEXT NOT NULL,
      inventory_item_id TEXT,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES service_jobs(id),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS scrap_inventory (
      id TEXT PRIMARY KEY,
      item_description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'AC',
      purchase_cost REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'In Stock',
      sold_price REAL,
      acquired_date TEXT,
      sold_date TEXT
    );
  `);

  const customerColumns = await db.all('PRAGMA table_info(customers)');
  if (!customerColumns.some((column: { name: string }) => column.name === 'created_at')) {
    await db.exec('ALTER TABLE customers ADD COLUMN created_at TEXT');
  }

  const inventoryColumns = await db.all('PRAGMA table_info(inventory)');
  if (!inventoryColumns.some((column: { name: string }) => column.name === 'purchase_date')) {
    await db.exec('ALTER TABLE inventory ADD COLUMN purchase_date TEXT');
  }

  const invoiceColumns = await db.all('PRAGMA table_info(invoices)');
  if (!invoiceColumns.some((column: { name: string }) => column.name === 'paid_amount')) {
    await db.exec('ALTER TABLE invoices ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0');
  }

  // Diagnostic check: Count rows to see if records are actually present in this file
  try {
    const custCount = await db.get('SELECT COUNT(*) as count FROM customers');
    const invCount = await db.get('SELECT COUNT(*) as count FROM inventory');
    const invoiceCount = await db.get('SELECT COUNT(*) as count FROM invoices');
    
    console.log(`📊 [database status]: Customers: ${custCount?.count || 0} | Inventory Items: ${invCount?.count || 0} | Invoices: ${invoiceCount?.count || 0}`);
  } catch (err) {
    console.error('❌ [database debug]: Failed to query row counts:', err);
  }

  console.log('📊 [database]: All structural relational tables are verified.');

  if (options.createBackup !== false) {
    await backupDatabase();
  }
  if (!backupTimer) {
    backupTimer = setInterval(() => {
      backupDatabase().catch(error => console.error('❌ [backup]: Scheduled backup failed:', error));
    }, 24 * 60 * 60 * 1000);
    backupTimer.unref();
  }

  return db;
};
