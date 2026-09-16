import { backupDatabase, db, initDB } from './db';

const run = async () => {
  await initDB({ createBackup: false });
  await backupDatabase();
  await db.close();
};

run().catch(error => {
  console.error('❌ [backup]: Manual backup failed:', error);
  process.exitCode = 1;
});
