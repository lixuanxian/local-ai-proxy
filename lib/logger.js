const db = require("./db");
const { getSetting } = require("./config");

const stmtInsert = db.prepare(`
  INSERT INTO request_logs (api_format, provider_id, model, request_body, response_body, status_code, input_tokens, output_tokens, latency_ms, error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Log a request/response pair
 */
function logRequest({ apiFormat, providerId, model, requestBody, responseBody, statusCode, inputTokens, outputTokens, latencyMs, error }) {
  if (getSetting("logging_enabled") !== "true") return;

  try {
    stmtInsert.run(
      apiFormat || null,
      providerId || null,
      model || null,
      requestBody ? JSON.stringify(requestBody).slice(0, 10000) : null,
      responseBody ? JSON.stringify(responseBody).slice(0, 10000) : null,
      statusCode || null,
      inputTokens || 0,
      outputTokens || 0,
      latencyMs || 0,
      error || null,
    );
  } catch (err) {
    console.error("[LOG ERROR]", err.message);
  }
}

/**
 * Express middleware that logs requests to /v1/* endpoints
 */
function loggerMiddleware(req, res, next) {
  if (!req.path.startsWith("/v1/")) return next();
  if (req.method !== "POST") return next();

  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    const latency = Date.now() - start;
    const apiFormat = req.path.includes("/messages") ? "anthropic" : "openai";

    logRequest({
      apiFormat,
      providerId: req.body?.provider || null,
      model: req.body?.model || null,
      requestBody: { messages: req.body?.messages?.length, model: req.body?.model, provider: req.body?.provider },
      responseBody: body,
      statusCode: res.statusCode,
      inputTokens: body?.usage?.prompt_tokens || body?.usage?.input_tokens || 0,
      outputTokens: body?.usage?.completion_tokens || body?.usage?.output_tokens || 0,
      latencyMs: latency,
      error: body?.error?.message || null,
    });

    return originalJson(body);
  };

  next();
}

/**
 * Query logs with pagination and filters
 */
function queryLogs({ page = 1, limit = 50, provider, since, until } = {}) {
  let where = "1=1";
  const params = [];

  if (provider) {
    where += " AND provider_id = ?";
    params.push(provider);
  }
  if (since) {
    where += " AND timestamp >= ?";
    params.push(since);
  }
  if (until) {
    where += " AND timestamp <= ?";
    params.push(until);
  }

  const offset = (page - 1) * limit;
  const total = db.prepare(`SELECT COUNT(*) as c FROM request_logs WHERE ${where}`).get(...params).c;
  const rows = db.prepare(`SELECT * FROM request_logs WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  return { rows, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * Get aggregate stats
 */
function getStats() {
  const total = db.prepare("SELECT COUNT(*) as c FROM request_logs").get().c;
  const avgLatency = db.prepare("SELECT AVG(latency_ms) as avg FROM request_logs").get().avg || 0;
  const errors = db.prepare("SELECT COUNT(*) as c FROM request_logs WHERE error IS NOT NULL").get().c;
  const byProvider = db.prepare("SELECT provider_id, COUNT(*) as count FROM request_logs GROUP BY provider_id").all();
  const today = db.prepare("SELECT COUNT(*) as c FROM request_logs WHERE timestamp >= date('now')").get().c;

  return { total, today, avgLatency: Math.round(avgLatency), errors, byProvider };
}

/**
 * Clear all logs
 */
function clearLogs() {
  db.prepare("DELETE FROM request_logs").run();
}

module.exports = { logRequest, loggerMiddleware, queryLogs, getStats, clearLogs };
