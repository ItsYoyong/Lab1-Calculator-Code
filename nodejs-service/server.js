const express = require('express');
const axios = require('axios');
const path = require('node:path');
const { open, appendFile, readFile } = require('node:fs/promises');

const app = express();
const port = Number(process.env.PORT) || 3000;
const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
const historyPath = path.join(__dirname, 'history.csv');
const historyHeader = 'timestamp,num1,num2,operation,result,status\n';
let historyReady;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function ensureHistoryFile() {
  if (!historyReady) {
    historyReady = (async () => {
      const file = await open(historyPath, 'a+');
      try {
        if ((await file.stat()).size === 0) {
          await file.write(historyHeader);
        }
      } finally {
        await file.close();
      }
    })();
  }

  await historyReady;
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
}

async function appendCalculation(payload, pythonResult) {
  const values = [
    new Date().toISOString(),
    payload.num1,
    payload.num2,
    payload.operation,
    pythonResult.result,
    pythonResult.status,
  ];
  const row = `${values.map(csvCell).join(',')}\n`;
  await appendFile(historyPath, row, 'utf8');
}

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from the Node.js API gateway' });
});

app.get('/api/status', async (req, res) => {
  try {
    const workerResponse = await axios.get(`${pythonServiceUrl}/ping`, { timeout: 3000 });
    res.json({ status: 'ok', gateway: 'ok', python_worker: workerResponse.data });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      gateway: 'ok',
      python_worker: { status: 'unavailable', message: 'Python data worker is not reachable' },
    });
  }
});

app.post('/api/calculate', async (req, res) => {
  let pythonResult;
  let statusCode = 200;
  let gatewayMessage = 'Calculation forwarded to Python worker';

  try {
    const workerResponse = await axios.post(`${pythonServiceUrl}/calculate`, req.body, { timeout: 5000 });
    pythonResult = workerResponse.data;
  } catch (error) {
    if (error.response) {
      pythonResult = error.response.data;
      statusCode = error.response.status;
      gatewayMessage = 'Python worker returned a calculation error';
    } else {
      pythonResult = {
        status: 'error',
        input: req.body || {},
        result: null,
        message: 'Python data worker is not reachable',
      };
      statusCode = 502;
      gatewayMessage = 'Unable to reach Python worker';
    }
  }

  try {
    await appendCalculation(req.body || {}, pythonResult);
  } catch (error) {
    console.error('Failed to append calculation history:', error);
    return res.status(500).json({
      gateway_message: 'Calculation could not be recorded',
      python_result: pythonResult,
    });
  }

  res.status(statusCode).json({
    gateway_message: gatewayMessage,
    python_result: pythonResult,
  });
});

async function start() {
  await ensureHistoryFile();
  app.listen(port, () => {
    console.log(`Node.js API gateway listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start API gateway:', error);
  process.exitCode = 1;
});

app.get('/api/history', async (req, res) => {
  try {
    await ensureHistoryFile();
    const contents = await readFile(historyPath, 'utf8');
    const lines = contents.trim().split('\n').slice(1).filter(Boolean);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 25;
    const history = lines.slice(-limit).reverse().map((line) => {
      const [timestamp, num1, num2, operation, result, status] = parseCsvLine(line);
      return { timestamp, num1, num2, operation, result, status };
    });

    res.json({ history });
  } catch (error) {
    console.error('Failed to read calculation history:', error);
    res.status(500).json({ message: 'Calculation history is unavailable' });
  }
});