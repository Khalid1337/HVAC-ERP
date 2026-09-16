const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');

process.env.ERP_DB_PATH = path.join(app.getPath('userData'), 'erp.db');
process.env.ERP_BACKUP_DIR = path.join(app.getPath('userData'), 'backups');

const { createApp } = require('../server/dist/app.js');
const { initDB } = require('../server/dist/db.js');

let server;

const start = async () => {
  try {
    await initDB();
    const expressApp = createApp(false);

    server = expressApp.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const window = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: '#0b0f19',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      window.loadURL(`http://127.0.0.1:${port}`);
    });
  } catch (error) {
    console.error(error);
    dialog.showErrorBox('HVAC ERP could not start', error.message || String(error));
    app.quit();
  }
};

app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});