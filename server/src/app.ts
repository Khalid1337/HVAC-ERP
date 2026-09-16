import express, { Express } from 'express';
import cors from 'cors';
import { initDB } from './db';

// Import all API routes
import customerRoutes from './routes/customers';
import inventoryRoutes from './routes/inventory';
import invoiceRoutes from './routes/invoices';
import jobsRouter from './routes/jobs';
import scrapRoutes from './routes/scrap';
import expensesRoutes from './routes/expenses'; // 👈 ADDED IMPORT
import fs from 'fs';
import path from 'path';

export const createApp = (initializeDatabase = true): Express => {
  const app = express();

  // Initialize Database connection on app start
  if (initializeDatabase) {
    initDB().catch(err => {
      console.error('❌ Failed to initialize database:', err);
    });
  }

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/customers', customerRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/scrap', scrapRoutes);
  app.use('/api/expenses', expensesRoutes); // 👈 ADDED ROUTE MOUNT

  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  return app;
};

export default createApp;
