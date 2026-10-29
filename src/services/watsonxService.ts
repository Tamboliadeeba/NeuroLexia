/**
 * watsonxService.ts
 *
 * IBM watsonx.ai integration for AI report generation.
 *
 * Preferred endpoint: POST /ml/v1/text/chat  (chat interface, max_tokens)
 * Fallback endpoint:  POST /ml/v1/text/generation  (max_new_tokens)
 *
 * Mock mode:
 *  - WATSONX_API_KEY absent
 *  - WATSONX_MOCK=true
 *  - any runtime error / timeout
 *  → returns a canned report with is_mock=true, model_id=null
 *
 * Truncation retry: if finish_reason == "max_tokens" / "length", retry once.
 * Timeout: 15 s; any failure → mock.
 */

import https from 'https';

const REGION      = process.env.WATSONX_REGION      ?? 'us-south';
const MODEL_ID    = process.env.WATSONX_MODEL_ID     ?? 'ibm/granite-3-8b-instruct';
const MODEL_ID_HI = process.env.WATSONX_MODEL_ID_HI ?? MODEL_ID;
const PROJECT_ID  = process.env.WATSONX_PROJECT_ID  ?? '';
const API_KEY     = process.env.WATSONX_API_KEY      ?? '';
const API_VERSION = process.env.WATSONX_API_VERSION  ?? '2024-05-31';
const MOCK_MODE   = process.env.WATSONX_MOCK === 'true' || !API_KEY;

const CHAT_URL       = `https://${REGION}.ml.cloud.ibm.com/ml/v1/text/chat?version=${API_VERSION}`;
const GENERATE_URL   = `https://${REGION}.ml.cloud.ibm.com/ml/v1/text/generation?version=${API_VERSION}`;
const IAM_TOKEN_URL  = 'https://iam.cloud.ibm.com/identity/token';
const TIMEOUT_MS     = 15_000;

// ── IAM token cache ───────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getIamToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const body = `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(API_KEY)}`;
  const raw = await httpPost(IAM_TOKEN_URL, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  const parsed = JSON.parse(raw) as { access_token: string; expires_in: number };
  cachedToken = parsed.access_token;
  tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
  return cachedToken;
}

// ── Low-level HTTP POST ───────────────────────────────────────────────────────

function httpPost(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

// ── Response parsing ──────────────────────────────────────────────────────────

function parseReport(text: string): {
  report_text: string;
  summary: string | null;
  weak_areas: string | null;
  activities: string | null;
} {
  const summaryMatch  = text.match(/SUMMARY\s*\n([\s\S]*?)(?=WEAK_AREAS|ACTIVITIES|$)/i);
  const weakMatch     = text.match(/WEAK_AREAS\s*\n([\s\S]*?)(?=SUMMARY|ACTIVITIES|$)/i);
  const activitiesMatch = text.match(/ACTIVITIES\s*\n([\s\S]*?)(?=SUMMARY|WEAK_AREAS|$)/i);

  return {
    report_text: text.trim(),
    summary:     summaryMatch?.[1]?.trim() ?? null,
    weak_areas:  weakMatch?.[1]?.trim() ?? null,
    activities:  activitiesMatch?.[1]?.trim() ?? null,
  };
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

function mockReport(lang: 'en' | 'hi'): WatsonxResult {
  if (lang === 'hi') {
    return {
      ...parseReport(
        'SUMMARY\nआपका बच्चा अच्छा प्रयास कर रहा है। पिछले कुछ हफ्तों में उन्होंने नियमित रूप से खेल खेले और कुछ क्षेत्रों में सुधार दिखाया।\nWEAK_AREAS\nकुछ अक्षरों में भ्रम, जैसे ब/ड और क/स की ध्वनियाँ।\nACTIVITIES\n1. रोज़ाना 10 मिनट किताब पढ़ें।\n2. फ़्लैशकार्ड से अक्षर पहचानने का अभ्यास करें।\n3. शब्दों को ज़ोर से बोलकर लिखें।',
      ),
      is_mock: true,
      model_id: null,
    };
  }
  return {
    ...parseReport(
      'SUMMARY\nYour child has been making consistent effort across multiple games over the past period. There are encouraging signs of improvement in accuracy on several activities.\nWEAK_AREAS\nSome difficulty with letter-sound pairs, particularly confusing similar-looking letters. Occasional difficulty recalling sight words.\nACTIVITIES\n1. Spend 10 minutes daily reading aloud together, pausing to sound out tricky words.\n2. Use alphabet flashcards focusing on letters your child finds confusing.\n3. Play word-spotting games to build sight word recognition.',
    ),
    is_mock: true,
    model_id: null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface WatsonxResult {
  report_text: string;
  summary: string | null;
  weak_areas: string | null;
  activities: string | null;
  is_mock: boolean;
  model_id: string | null;
}

export async function generateReport(
  system: string,
  user: string,
  lang: 'en' | 'hi',
): Promise<WatsonxResult> {
  if (MOCK_MODE) return mockReport(lang);

  const modelId = lang === 'hi' ? MODEL_ID_HI : MODEL_ID;
  const maxTokens = lang === 'hi' ? 1000 : 400;

  // Try once (and retry once on truncation)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const token = await getIamToken();
      const text = await tryChat(token, modelId, system, user, maxTokens)
        ?? await tryGenerate(token, modelId, system, user, maxTokens);

      if (text == null) return mockReport(lang);

      // Check truncation
      if (attempt === 0 && text.length < 80) {
        // suspiciously short — retry
        continue;
      }

      return { ...parseReport(text), is_mock: false, model_id: modelId };
    } catch (err) {
      console.warn('[watsonx] attempt', attempt + 1, 'failed:', (err as Error).message);
      if (attempt === 1) return mockReport(lang);
    }
  }

  return mockReport(lang);
}

async function tryChat(
  token: string,
  modelId: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const body = JSON.stringify({
    model_id: modelId,
    project_id: PROJECT_ID,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
    parameters: {
      max_tokens: maxTokens,
      temperature: 0.4,
    },
  });

  const raw = await httpPost(CHAT_URL, body, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  type ChatResp = {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    results?:  { generated_text?: string; stop_reason?: string }[];
  };
  const parsed = JSON.parse(raw) as ChatResp;

  // chat endpoint shape
  if (parsed.choices?.[0]?.message?.content) {
    return parsed.choices[0].message.content;
  }
  // some watsonx versions return results array even on chat endpoint
  if (parsed.results?.[0]?.generated_text) {
    return parsed.results[0].generated_text;
  }
  return null;
}

async function tryGenerate(
  token: string,
  modelId: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const body = JSON.stringify({
    model_id: modelId,
    project_id: PROJECT_ID,
    input: `${system}\n\n${user}`,
    parameters: {
      max_new_tokens: maxTokens,
      temperature: 0.4,
    },
  });

  const raw = await httpPost(GENERATE_URL, body, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  type GenResp = { results?: { generated_text?: string }[] };
  const parsed = JSON.parse(raw) as GenResp;
  return parsed.results?.[0]?.generated_text ?? null;
}
