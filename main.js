const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Auto-updater (only when packaged) ────────────────────────────────────────
let autoUpdater = null;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload    = false; // user confirms before download
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;           // no console spam
  } catch(_) { autoUpdater = null; }
}

let mainWindow;
let db;

// ── Database initialization ─────────────────────────────────────────────────
function initDatabase() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'hrm_stats.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      annee INTEGER NOT NULL,
      mois INTEGER NOT NULL,
      service TEXT NOT NULL,
      indicateur TEXT NOT NULL,
      valeur REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(annee, mois, service, indicateur)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stats_period ON monthly_stats(annee, mois);
    CREATE INDEX IF NOT EXISTS idx_stats_service ON monthly_stats(service);
    CREATE INDEX IF NOT EXISTS idx_stats_indicateur ON monthly_stats(indicateur);
  `);

  // Trigger for updated_at
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_timestamp
    AFTER UPDATE ON monthly_stats
    BEGIN
      UPDATE monthly_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
}

// ── Logo helper ───────────────────────────────────────────────────────────────
function _logoDataUrl(filePath, ext) {
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
let _handlersRegistered = false;
function setupIpcHandlers() {
  if (_handlersRegistered) return;
  _handlersRegistered = true;

  // Save a full month of data (upsert)
  ipcMain.handle('save-month-data', (_, { annee, mois, data }) => {
    const upsert = db.prepare(`
      INSERT INTO monthly_stats (annee, mois, service, indicateur, valeur)
      VALUES (@annee, @mois, @service, @indicateur, @valeur)
      ON CONFLICT(annee, mois, service, indicateur)
      DO UPDATE SET valeur = excluded.valeur, updated_at = CURRENT_TIMESTAMP
    `);
    const saveAll = db.transaction((rows) => {
      for (const row of rows) upsert.run(row);
    });
    const rows = [];
    for (const [service, indicators] of Object.entries(data)) {
      for (const [indicateur, valeur] of Object.entries(indicators)) {
        rows.push({ annee, mois, service, indicateur, valeur: parseFloat(valeur) || 0 });
      }
    }
    saveAll(rows);
    return { success: true };
  });

  // Load data for a specific month
  ipcMain.handle('load-month-data', (_, { annee, mois }) => {
    const rows = db.prepare(
      'SELECT service, indicateur, valeur FROM monthly_stats WHERE annee = ? AND mois = ?'
    ).all(annee, mois);
    const result = {};
    for (const row of rows) {
      if (!result[row.service]) result[row.service] = {};
      result[row.service][row.indicateur] = row.valeur;
    }
    return result;
  });

  // Load annual consolidated data
  ipcMain.handle('load-annual-data', (_, { annee }) => {
    const rows = db.prepare(
      'SELECT mois, service, indicateur, valeur FROM monthly_stats WHERE annee = ? ORDER BY mois'
    ).all(annee);
    return rows;
  });

  // Get years with data
  ipcMain.handle('get-available-years', () => {
    return db.prepare(
      'SELECT DISTINCT annee FROM monthly_stats ORDER BY annee DESC'
    ).all().map(r => r.annee);
  });

  // Get months with data for a year
  ipcMain.handle('get-available-months', (_, { annee }) => {
    return db.prepare(
      'SELECT DISTINCT mois FROM monthly_stats WHERE annee = ? ORDER BY mois'
    ).all(annee).map(r => r.mois);
  });

  // Multi-period query with filters
  ipcMain.handle('query-stats', (_, { annee, moisDebut, moisFin, services, indicateurs }) => {
    let sql = 'SELECT annee, mois, service, indicateur, valeur FROM monthly_stats WHERE annee = ?';
    const params = [annee];
    if (moisDebut && moisFin) {
      sql += ' AND mois BETWEEN ? AND ?';
      params.push(moisDebut, moisFin);
    }
    if (services && services.length > 0) {
      sql += ` AND service IN (${services.map(() => '?').join(',')})`;
      params.push(...services);
    }
    if (indicateurs && indicateurs.length > 0) {
      sql += ` AND indicateur IN (${indicateurs.map(() => '?').join(',')})`;
      params.push(...indicateurs);
    }
    sql += ' ORDER BY mois, service, indicateur';
    return db.prepare(sql).all(...params);
  });

  // Dashboard summary: SUM sauf nbre_lit (MAX) et liste des mois présents
  ipcMain.handle('get-dashboard-summary', (_, { annee, moisDebut, moisFin }) => {
    let sql = `
      SELECT service, indicateur,
        CASE WHEN indicateur = 'nbre_lit'
          THEN MAX(valeur)
          ELSE SUM(valeur)
        END as total,
        COUNT(DISTINCT mois) as nb_mois,
        GROUP_CONCAT(DISTINCT mois) as mois_list
      FROM monthly_stats WHERE annee = ?
    `;
    const params = [annee];
    if (moisDebut && moisFin) {
      sql += ' AND mois BETWEEN ? AND ?';
      params.push(moisDebut, moisFin);
    }
    sql += ' GROUP BY service, indicateur';
    return db.prepare(sql).all(...params);
  });

  // Monthly trend: totals per month for a given indicator across all services
  ipcMain.handle('get-monthly-trend', (_, { annee, indicateur }) => {
    return db.prepare(`
      SELECT mois, SUM(valeur) as total
      FROM monthly_stats
      WHERE annee = ? AND indicateur = ?
      GROUP BY mois ORDER BY mois
    `).all(annee, indicateur);
  });

  // Check if a month already has data
  ipcMain.handle('month-has-data', (_, { annee, mois }) => {
    const row = db.prepare(
      'SELECT COUNT(*) as cnt FROM monthly_stats WHERE annee = ? AND mois = ?'
    ).get(annee, mois);
    return row.cnt > 0;
  });

  // Delete a month's data
  ipcMain.handle('delete-month-data', (_, { annee, mois }) => {
    db.prepare('DELETE FROM monthly_stats WHERE annee = ? AND mois = ?').run(annee, mois);
    return { success: true };
  });

  // App settings (key/value JSON store)
  ipcMain.handle('get-setting', (_, key) => {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  });
  ipcMain.handle('set-setting', (_, { key, value }) => {
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    return { success: true };
  });

  // Get last known nbre_lit per service (for pre-filling new months)
  ipcMain.handle('get-nbre-lit-defaults', (_, { annee, mois }) => {
    // Find most recent month before (annee,mois) that has nbre_lit data
    const rows = db.prepare(`
      SELECT service, valeur FROM monthly_stats
      WHERE indicateur = 'nbre_lit' AND (annee < ? OR (annee = ? AND mois < ?))
      ORDER BY annee DESC, mois DESC
    `).all(annee, annee, mois);
    const result = {};
    for (const r of rows) {
      if (!result[r.service]) result[r.service] = r.valeur; // first = most recent
    }
    return result;
  });

  // ── Logo ──────────────────────────────────────────────────────────────────
  ipcMain.handle('select-logo', async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir le logo de l\'hôpital',
      filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','bmp','webp'] }],
      properties: ['openFile'],
    });
    if (!filePaths || !filePaths.length) return null;
    const src = filePaths[0];
    const ext = path.extname(src).toLowerCase().replace('.', '') || 'png';
    // Remove any old logo
    for (const e of ['png','jpg','jpeg','gif','bmp','webp']) {
      const old = path.join(app.getPath('userData'), `logo.${e}`);
      try { if (fs.existsSync(old)) fs.unlinkSync(old); } catch(_) {}
    }
    const dest = path.join(app.getPath('userData'), `logo.${ext}`);
    fs.copyFileSync(src, dest);
    db.prepare('INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)').run('logo_ext', JSON.stringify(ext));
    return _logoDataUrl(dest, ext);
  });

  ipcMain.handle('get-logo', () => {
    try {
      const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get('logo_ext');
      if (!row) return null;
      const ext  = JSON.parse(row.value);
      const file = path.join(app.getPath('userData'), `logo.${ext}`);
      return fs.existsSync(file) ? _logoDataUrl(file, ext) : null;
    } catch(_) { return null; }
  });

  ipcMain.handle('remove-logo', () => {
    try {
      const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get('logo_ext');
      if (row) {
        const ext  = JSON.parse(row.value);
        const file = path.join(app.getPath('userData'), `logo.${ext}`);
        if (fs.existsSync(file)) fs.unlinkSync(file);
        db.prepare('DELETE FROM app_settings WHERE key=?').run('logo_ext');
      }
    } catch(_) {}
    return { success: true };
  });

  // ── Backup / Restore database ─────────────────────────────────────────────
  ipcMain.handle('backup-database', async () => {
    const dbPath = path.join(app.getPath('userData'), 'hrm_stats.db');
    const date   = new Date().toISOString().slice(0, 10);
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter la base de données',
      defaultPath: `HRM_Stats_${date}.db`,
      filters: [
        { name: 'Base de données HRM Stats', extensions: ['db'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    });
    if (!filePath) return { cancelled: true };
    try {
      // Hot backup : utiliser l'API backup de SQLite pour une copie cohérente
      db.backup(filePath);
      return { success: true, path: filePath };
    } catch (e) {
      // Fallback : copie fichier si backup API indisponible
      try { fs.copyFileSync(dbPath, filePath); return { success: true, path: filePath }; }
      catch (e2) { return { success: false, error: e2.message }; }
    }
  });

  ipcMain.handle('restore-database', async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer une base de données HRM Stats',
      filters: [
        { name: 'Base de données HRM Stats', extensions: ['db'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (!filePaths || !filePaths.length) return { cancelled: true };

    const srcPath  = filePaths[0];
    const destPath = path.join(app.getPath('userData'), 'hrm_stats.db');

    // Vérifier que le fichier source est un DB SQLite valide
    try {
      const Database = require('better-sqlite3');
      const testDb = new Database(srcPath, { readonly: true });
      // Doit contenir la table monthly_stats
      const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_stats'").get();
      testDb.close();
      if (!tables) return { success: false, error: 'Fichier invalide : table monthly_stats introuvable.' };
    } catch (e) {
      return { success: false, error: 'Fichier non reconnu : ' + e.message };
    }

    try {
      // Fermer la DB courante proprement
      if (db) { db.close(); db = null; }
      fs.copyFileSync(srcPath, destPath);
      // Relancer l'application pour recharger la nouvelle DB
      app.relaunch();
      app.exit(0);
      return { success: true };
    } catch (e) {
      // Ré-ouvrir l'ancienne DB en cas d'erreur
      initDatabase();
      return { success: false, error: e.message };
    }
  });

  // ── Auto-update actions ────────────────────────────────────────────────────
  ipcMain.handle('update-download', () => {
    if (autoUpdater) { try { autoUpdater.downloadUpdate(); } catch(_) {} }
  });
  ipcMain.handle('update-install', () => {
    if (autoUpdater) { try { autoUpdater.quitAndInstall(true, true); } catch(_) {} }
  });
  ipcMain.handle('get-app-version', () => app.getVersion());

  // Get DB path for info
  ipcMain.handle('get-db-info', () => {
    return { path: path.join(app.getPath('userData'), 'hrm_stats.db') };
  });

  // Open userData folder
  ipcMain.handle('open-data-folder', () => {
    shell.openPath(app.getPath('userData'));
  });

  // Export to formatted Excel
  ipcMain.handle('export-excel', async (_, { annee, services, indicateursGroupes }) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter vers Excel',
      defaultPath: `HRM_Stats_${annee}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (!filePath) return { success: false };
    try {
      const { exportToExcel } = require('./excel-export');
      await exportToExcel({ db, annee, filePath, services, indicateursGroupes });
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Export data as CSV
  ipcMain.handle('export-csv', async (_, { annee }) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter les données',
      defaultPath: `HRM_Stats_${annee}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (!filePath) return { success: false };

    const rows = db.prepare(
      'SELECT annee, mois, service, indicateur, valeur FROM monthly_stats WHERE annee = ? ORDER BY mois, service, indicateur'
    ).all(annee);

    const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    let csv = 'Année,Mois,Service,Indicateur,Valeur\n';
    for (const r of rows) {
      csv += `${r.annee},"${MOIS_NOMS[r.mois - 1]}","${r.service}","${r.indicateur}",${r.valeur}\n`;
    }
    fs.writeFileSync(filePath, '﻿' + csv, 'utf8');
    return { success: true, path: filePath };
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Copy Chart.js UMD before anything else (synchronous, safe)
  try {
    const chartSrc  = path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
    const vendorDir = path.join(__dirname, 'src', 'vendor');
    const chartDest = path.join(vendorDir, 'chart.umd.js');
    fs.mkdirSync(vendorDir, { recursive: true });
    if (!fs.existsSync(chartDest)) fs.copyFileSync(chartSrc, chartDest);
  } catch (e) { console.warn('[Chart.js copy]', e.message); }

  try {
    initDatabase();
  } catch (e) {
    console.error('[initDatabase] FATAL:', e.message);
    // Show a user-facing error dialog instead of silent crash
    const { dialog } = require('electron');
    dialog.showErrorBox('Erreur base de données', `Impossible d'initialiser la base de données :\n${e.message}`);
    app.quit();
    return;
  }

  // Guard against double-registration on renderer reload
  try { setupIpcHandlers(); } catch (e) { console.warn('[setupIpcHandlers]', e.message); }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#f0f4f8'
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();

    // Vérifier les mises à jour 4 secondes après le démarrage
    if (autoUpdater) {
      autoUpdater.on('update-available', info => {
        mainWindow.webContents.send('update-status', { type: 'available', version: info.version });
      });
      autoUpdater.on('download-progress', p => {
        mainWindow.webContents.send('update-status', { type: 'progress', percent: Math.round(p.percent) });
      });
      autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-status', { type: 'ready' });
      });
      autoUpdater.on('error', () => {}); // silent fail (hors-ligne normal)

      setTimeout(() => {
        try { autoUpdater.checkForUpdates(); } catch(_) {}
      }, 4000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (db) db.close();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
