import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can backup or restore data' });
  }
  next();
}

// Get database stats / counts
r.get('/info', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const tableCounts = {};
    const tables = ['products', 'customers', 'sales', 'purchases', 'suppliers', 'expenses', 'product_serials'];
    for (const t of tables) {
      try {
        tableCounts[t] = db.prepare(`SELECT COUNT(*) AS count FROM "${t}"`).get()?.count || 0;
      } catch {
        tableCounts[t] = 0;
      }
    }

    let dbSizeBytes = 0;
    try {
      const dataDir = path.join(__dirname, '..', '..', 'data');
      const dbFile = process.env.ELECTROPOS_DB_PATH || path.join(dataDir, 'electropos.db');
      if (fs.existsSync(dbFile)) {
        dbSizeBytes = fs.statSync(dbFile).size;
      }
    } catch {}

    res.json({
      ok: true,
      size_bytes: dbSizeBytes,
      counts: tableCounts,
      server_time: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// Download full SQLite database (.db)
r.get('/download-db', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `primepos-backup-${timestamp}.db`;
    const tempPath = path.join(os.tmpdir(), filename);

    // better-sqlite3 backup performs an atomic, consistent online snapshot (checkpoints WAL)
    await db.backup(tempPath);

    res.download(tempPath, filename, (err) => {
      try { fs.unlinkSync(tempPath); } catch {}
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
});

// Export human-readable JSON
r.get('/export-json', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'sessions'").all().map(row => row.name);
    const dump = {
      app: 'Prime POS',
      version: '1.0',
      exported_at: new Date().toISOString(),
      tables: {}
    };

    for (const table of tables) {
      dump.tables[table] = db.prepare(`SELECT * FROM "${table}"`).all();
    }

    try {
      dump.sqlite_sequence = db.prepare('SELECT * FROM sqlite_sequence').all();
    } catch {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="primepos-export-${timestamp}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    next(err);
  }
});

// Restore from uploaded .db SQLite file (streamed)
r.post('/restore-db', requireAuth, requireAdmin, (req, res, next) => {
  const tempUpload = path.join(os.tmpdir(), `restore-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const writeStream = fs.createWriteStream(tempUpload);

  req.pipe(writeStream);

  writeStream.on('error', (err) => {
    try { fs.unlinkSync(tempUpload); } catch {}
    next(err);
  });

  writeStream.on('finish', () => {
    try {
      const stat = fs.statSync(tempUpload);
      if (stat.size < 100) {
        try { fs.unlinkSync(tempUpload); } catch {}
        return res.status(400).json({ error: 'Uploaded file is empty or too small to be a valid database.' });
      }

      // Verify file integrity before touching main database
      let testDb;
      try {
        testDb = new Database(tempUpload, { readonly: true, fileMustExist: true });
        const check = testDb.prepare('PRAGMA integrity_check').get();
        if (check?.integrity_check !== 'ok') {
          testDb.close();
          try { fs.unlinkSync(tempUpload); } catch {}
          return res.status(400).json({ error: 'Database integrity check failed: file may be corrupted.' });
        }

        const sourceTables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
        const required = ['users', 'products', 'categories', 'sales'];
        const missing = required.filter(t => !sourceTables.includes(t));
        if (missing.length > 0) {
          testDb.close();
          try { fs.unlinkSync(tempUpload); } catch {}
          return res.status(400).json({ error: `Invalid backup file. Missing required tables: ${missing.join(', ')}` });
        }
        testDb.close();
      } catch (err) {
        try { if (testDb) testDb.close(); } catch {}
        try { fs.unlinkSync(tempUpload); } catch {}
        return res.status(400).json({ error: `Not a valid SQLite database file: ${err.message}` });
      }

      // Attach uploaded database to current connection and copy across in an atomic transaction
      const attachPath = tempUpload.replace(/\\/g, '/');
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'sessions'").all().map(row => row.name);

      db.pragma('foreign_keys = OFF');
      db.exec(`ATTACH DATABASE '${attachPath}' AS backup_source;`);

      try {
        const sourceTableList = db.prepare("SELECT name FROM backup_source.sqlite_master WHERE type='table'").all().map(row => row.name);

        const restoreTx = db.transaction(() => {
          for (const tbl of tables) {
            if (sourceTableList.includes(tbl)) {
              db.exec(`DELETE FROM main."${tbl}";`);
              db.exec(`INSERT INTO main."${tbl}" SELECT * FROM backup_source."${tbl}";`);
            }
          }

          try {
            db.exec('DELETE FROM main.sqlite_sequence;');
            db.exec('INSERT OR REPLACE INTO main.sqlite_sequence SELECT * FROM backup_source.sqlite_sequence;');
          } catch {}
        });

        restoreTx();
      } finally {
        try { db.exec('DETACH DATABASE backup_source;'); } catch {}
        db.pragma('foreign_keys = ON');
        try { fs.unlinkSync(tempUpload); } catch {}
      }

      res.json({ ok: true, message: 'Database successfully restored from backup file.' });
    } catch (err) {
      try { fs.unlinkSync(tempUpload); } catch {}
      next(err);
    }
  });
});

// Restore from uploaded JSON
r.post('/restore-json', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload || !payload.tables || typeof payload.tables !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON backup format. Missing "tables" object.' });
    }

    const required = ['users', 'products', 'categories', 'sales'];
    const missing = required.filter(t => !payload.tables[t]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `JSON backup missing required tables: ${missing.join(', ')}` });
    }

    db.pragma('foreign_keys = OFF');
    const restoreJsonTx = db.transaction(() => {
      for (const [tbl, rows] of Object.entries(payload.tables)) {
        if (!Array.isArray(rows) || tbl === 'sessions') continue;

        const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tbl);
        if (!exists) continue;

        db.exec(`DELETE FROM "${tbl}";`);
        if (rows.length === 0) continue;

        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(', ');
        const insertStmt = db.prepare(`INSERT INTO "${tbl}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`);

        for (const row of rows) {
          const values = cols.map(c => (row[c] !== undefined ? row[c] : null));
          insertStmt.run(...values);
        }
      }

      if (Array.isArray(payload.sqlite_sequence)) {
        try {
          db.exec('DELETE FROM sqlite_sequence;');
          const insSeq = db.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)');
          for (const s of payload.sqlite_sequence) {
            insSeq.run(s.name, s.seq);
          }
        } catch {}
      }
    });

    try {
      restoreJsonTx();
    } finally {
      db.pragma('foreign_keys = ON');
    }

    res.json({ ok: true, message: 'Data successfully restored from JSON backup.' });
  } catch (err) {
    next(err);
  }
});

export { r as backupRouter };
