const https = require('https');
const crypto = require('crypto');
const env = require('../config/env');
const { sendError } = require('../utils/apiResponse');

// 1. HTTP Connection Pooling Agent configuration
// Reuses TCP connections to eliminate TCP/TLS handshake overhead (~100-300ms per call)
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 10000 // 10s timeout
});

// 2. In-Memory Cache with TTL fallback (if Redis is not configured or fails)
class FastCacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.redisClient = null;
    this.initRedis();
  }

  initRedis() {
    // Attempt to dynamically load redis if configured in env
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      try {
        const Redis = require('ioredis');
        this.redisClient = new Redis(process.env.REDIS_URL || {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        });
        console.log('[Cache] Redis client initialized successfully.');
      } catch (err) {
        console.warn('[Cache] Could not initialize Redis client. Falling back to In-Memory cache.', err.message);
      }
    }
  }

  async get(key) {
    if (this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch (err) {
        console.error('[Cache] Redis get error, falling back to memory:', err.message);
      }
    }
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    return cached.value;
  }

  async set(key, value, ttlSeconds = 300) {
    if (this.redisClient) {
      try {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.error('[Cache] Redis set error:', err.message);
      }
    }
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }
}

const cacheManager = new FastCacheManager();

// Static prefix prompt configuration (prefix-caching friendly)
const STATIC_SYSTEM_PROMPT = `Role: Campus access validator.
Rule: Output raw minified JSON only. No explanations, intro, markdown block (\`\`\`json), or prose.
Keys:
- \`auth\`: "OK", "NO", "HOLD"
- \`msg\`: String (rejection/pending details) or "" (authorized)
- \`ts\`: ISO8601 string of check time
Logic:
1. Blacklisted = "NO".
2. Out of permitted hours = "NO".
3. Host approved false = "NO".
4. Host approved true and all clear = "OK".
5. Else = "HOLD".`;

/**
 * Generates an MD5 cache key for a given input payload to look up in cache
 */
function generateCacheKey(payload) {
  const serialized = JSON.stringify({
    name: payload.visitorName,
    type: payload.visitorType,
    purp: payload.purpose,
    host: payload.hostName,
    dept: payload.hostDept,
    time: payload.checkInTime,
    limit: payload.permittedHours,
    ok: !!payload.hostApproved,
    bad: !!payload.isBlacklisted
  });
  return 'visitor:verify:' + crypto.createHash('md5').update(serialized).digest('hex');
}

/**
 * Controller to handle Visitor verification with SSE, caching, and connection pooling
 */
const verifyVisitor = async (req, res) => {
  const {
    visitorName,
    visitorType,
    purpose,
    hostName,
    hostDept,
    checkInTime,
    permittedHours,
    hostApproved,
    isBlacklisted
  } = req.body;

  // Validate required inputs
  if (!visitorName || !visitorType || !purpose || !hostName) {
    return sendError(res, 'Missing required visitor verification fields', 420);
  }

  const payload = {
    visitorName,
    visitorType,
    purpose,
    hostName,
    hostDept: hostDept || 'General',
    checkInTime: checkInTime || new Date().toISOString(),
    permittedHours: permittedHours || '08:00-18:00',
    hostApproved: hostApproved !== undefined ? hostApproved : true,
    isBlacklisted: !!isBlacklisted
  };

  const cacheKey = generateCacheKey(payload);

  // Check cache (In-Memory / Redis)
  const cachedResult = await cacheManager.get(cacheKey);
  if (cachedResult) {
    console.log('[Visitor verification] Cache hit! Serving instantly.');
    
    // Support streaming even for cached requests to maintain consistency for the frontend
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    
    res.write(`data: ${cachedResult}\n\n`);
    res.write('event: end\ndata: [DONE]\n\n');
    res.end();
    return;
  }

  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Write initial chunk to establish connection immediately (lowers perceived latency)
  res.write('event: status\ndata: {"state":"processing"}\n\n');

  // Format dynamic user payload (Keep it compressed and at the very bottom for prompt caching)
  const userPayload = JSON.stringify({
    name: payload.visitorName,
    type: payload.visitorType,
    purp: payload.purpose,
    host: payload.hostName,
    dept: payload.hostDept,
    time: payload.checkInTime,
    limit: payload.permittedHours,
    ok: payload.hostApproved,
    bad: payload.isBlacklisted
  });

  // Call the LLM provider using the pooled Keep-Alive agent
  const provider = process.env.LLM_PROVIDER || 'gemini'; // fallback to Gemini
  
  if (provider === 'openai') {
    callOpenAIStream(res, cacheKey, userPayload);
  } else {
    callGeminiStream(res, cacheKey, userPayload);
  }
};

/**
 * Stream API implementation for OpenAI
 */
function callOpenAIStream(res, cacheKey, userPayload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.write('event: error\ndata: {"message":"OpenAI API key missing"}\n\n');
    res.end();
    return;
  }

  const postData = JSON.stringify({
    model: process.env.LLM_MODEL || 'gpt-4o-mini', // lightweight model
    messages: [
      { role: 'system', content: STATIC_SYSTEM_PROMPT },
      { role: 'user', content: userPayload }
    ],
    temperature: 0.0,
    stream: true
  });

  const reqOptions = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    },
    agent: keepAliveAgent
  };

  let fullResponseText = '';

  const llmRequest = https.request(reqOptions, (llmResponse) => {
    let buffer = '';

    llmResponse.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial last line

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine) continue;
        if (cleanedLine === 'data: [DONE]') continue;
        
        if (cleanedLine.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(cleanedLine.substring(6));
            const delta = parsed.choices[0]?.delta?.content || '';
            if (delta) {
              fullResponseText += delta;
              res.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors on incomplete chunk lines
          }
        }
      }
    });

    llmResponse.on('end', () => {
      // Process final bit in buffer if any
      if (buffer && buffer.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(buffer.substring(6));
          const delta = parsed.choices[0]?.delta?.content || '';
          if (delta) fullResponseText += delta;
        } catch (e) {}
      }

      finishVerificationStream(res, cacheKey, fullResponseText);
    });
  });

  llmRequest.on('error', (err) => {
    console.error('[OpenAI Stream Error]', err);
    res.write(`event: error\ndata: {"message":"LLM verification failed","error":"${err.message}"}\n\n`);
    res.end();
  });

  llmRequest.write(postData);
  llmRequest.end();
}

/**
 * Stream API implementation for Google Gemini
 */
function callGeminiStream(res, cacheKey, userPayload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.write('event: error\ndata: {"message":"Gemini API key missing"}\n\n');
    res.end();
    return;
  }

  const model = process.env.LLM_MODEL || 'gemini-1.5-flash';
  const postData = JSON.stringify({
    systemInstruction: {
      parts: { text: STATIC_SYSTEM_PROMPT }
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPayload }]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json'
    }
  });

  // Use the streamGenerateContent API endpoint
  const reqOptions = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    agent: keepAliveAgent
  };

  let fullResponseText = '';

  const llmRequest = https.request(reqOptions, (llmResponse) => {
    let responseBody = '';

    llmResponse.on('data', (chunk) => {
      responseBody += chunk.toString();
      
      // Gemini streams in JSON arrays of candidates, let's parse incremental chunks
      try {
        const regex = /"text":\s*"([^"]*)"/g;
        let match;
        let incrementalDelta = '';
        while ((match = regex.exec(chunk.toString())) !== null) {
          const cleanText = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
          incrementalDelta += cleanText;
        }

        if (incrementalDelta) {
          fullResponseText += incrementalDelta;
          res.write(`data: ${JSON.stringify({ chunk: incrementalDelta })}\n\n`);
        }
      } catch (e) {
        // Continue buffering
      }
    });

    llmResponse.on('end', () => {
      if (!fullResponseText) {
        try {
          const parsed = JSON.parse(responseBody);
          if (Array.isArray(parsed)) {
            fullResponseText = parsed
              .map(p => p.candidates?.[0]?.content?.parts?.[0]?.text || '')
              .join('');
          } else {
            fullResponseText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        } catch (e) {
          const textMatch = responseBody.match(/"text":\s*"([^"]+)"/g);
          if (textMatch) {
            fullResponseText = textMatch
              .map(m => m.replace(/"text":\s*"/, '').replace(/"$/, ''))
              .join('')
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"');
          }
        }
      }

      finishVerificationStream(res, cacheKey, fullResponseText);
    });
  });

  llmRequest.on('error', (err) => {
    console.error('[Gemini Stream Error]', err);
    res.write(`event: error\ndata: {"message":"LLM verification failed","error":"${err.message}"}\n\n`);
    res.end();
  });

  llmRequest.write(postData);
  llmRequest.end();
}

/**
 * Closes the SSE stream, caches the aggregated output, and signals completion
 */
async function finishVerificationStream(res, cacheKey, fullResponseText) {
  let cleanedOutput = fullResponseText.trim();
  if (cleanedOutput.startsWith('```')) {
    cleanedOutput = cleanedOutput.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  }
  cleanedOutput = cleanedOutput.trim();

  try {
    JSON.parse(cleanedOutput);
    await cacheManager.set(cacheKey, cleanedOutput, 300);
    console.log('[Visitor verification] Stream finished. Cached decision:', cleanedOutput);
    res.write(`event: result\ndata: ${cleanedOutput}\n\n`);
  } catch (err) {
    console.error('[Visitor verification] Response was not valid JSON:', cleanedOutput);
    const fallback = JSON.stringify({
      auth: 'HOLD',
      msg: 'Verification result format error. Manual review required.',
      ts: new Date().toISOString()
    });
    res.write(`event: result\ndata: ${fallback}\n\n`);
  }

  res.write('event: end\ndata: [DONE]\n\n');
  res.end();
}

module.exports = {
  verifyVisitor
};
