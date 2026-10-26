import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadUser } from './auth.js';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/catalog.js';
import { salesRouter } from './routes/sales.js';
import { reportsRouter } from './routes/reports.js';
import { purchasesRouter } from './routes/purchases.js';
import { expensesRouter } from './routes/expenses.js';
import { registerRouter } from './routes/register.js';
import { returnsRouter } from './routes/returns.js';
import { serialsRouter } from './routes/serials.js';
import { backupRouter } from './routes/backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use('/api/backup/restore-json', express.json({ limit: '50mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(loadUser);

// Health check must come before routers (router-level auth middleware would 401 it)
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', authRouter);
app.use('/api', apiRouter);
app.use('/api', salesRouter);
app.use('/api', purchasesRouter);
app.use('/api', expensesRouter);
app.use('/api', registerRouter);
app.use('/api', returnsRouter);
app.use('/api', serialsRouter);
app.use('/api', reportsRouter);
app.use('/api/backup', backupRouter);

// Serve built client if present (production single-server deploy)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Central error handler (turns thrown validation errors into 4xx JSON)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ElectroPOS API listening on http://localhost:${PORT}`));
