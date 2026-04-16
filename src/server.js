import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { CaseSummaryOrchestrator } from './orchestrator.js';

try { validateConfig(); } catch (error) {
  logger.error('Configuration validation failed:', { error: error.message });
  process.exit(1);
}

const app = express();
const orchestrator = new CaseSummaryOrchestrator();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'));
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, { query: req.query });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.post('/api/v1/summarize', async (req, res) => {
  try {
    const { sys_id, table } = req.body;
    if (!sys_id) return res.status(400).json({ success: false, error: 'Missing required field: sys_id' });
    logger.info('Summarize request received', { sys_id, table: table || 'incident' });
    const result = await orchestrator.generateSummary(sys_id, table || 'incident');
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    logger.error('Summarize endpoint error:', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/v1/summarize/batch', async (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases)) return res.status(400).json({ success: false, error: 'Missing required field: cases (array)' });
    logger.info('Batch summarize request received', { count: cases.length });
    const results = await Promise.all(cases.map(c => orchestrator.generateSummary(c.sys_id, c.table || 'incident')));
    res.json({ success: true, results: results, total: results.length });
  } catch (error) {
    logger.error('Batch summarize endpoint error:', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/v1/info', (req, res) => {
  res.json({
    name: 'Case Summary ServiceNow',
    version: '1.0.0',
    provider: orchestrator.llmClient.provider,
    model: orchestrator.llmClient.provider === 'circuit' ? config.circuit.model : config.openai.model,
    endpoints: ['POST /api/v1/summarize', 'POST /api/v1/summarize/batch', 'GET /api/v1/info', 'GET /health']
  });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, { env: config.nodeEnv, provider: orchestrator.llmClient.provider });
});
