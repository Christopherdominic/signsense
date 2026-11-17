// Firebase AI Logic: hybrid on-device / cloud inference for SignSense.
//
//  Quick explanation  -> hybrid model (default PREFER_ON_DEVICE).
//                        Runs on Gemini Nano in Chrome when available, otherwise
//                        falls back to Gemini in the cloud. The prompt is built from
//                        a REDACTED summary: no wallet addresses, no balances.
//  Deep check         -> ONLY_IN_CLOUD, user-initiated, with Google Search grounding.
//                        Tools such as Google Search only exist in the cloud, so this
//                        is the part that genuinely needs the bigger model.

import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, Schema } from 'firebase/ai';
import { getString, getBoolean } from 'firebase/remote-config';
import { app, rc, rcReady, RC_DEFAULTS } from './firebase.js';

const ai = getAI(app, { backend: new GoogleAIBackend() });

export async function getSettings() {
  await rcReady;
  const stored = await chrome.storage.local.get('mode');
  return {
    mode: stored.mode || getString(rc, 'quick_mode') || RC_DEFAULTS.quick_mode,
    quickCloudModel: getString(rc, 'quick_cloud_model') || RC_DEFAULTS.quick_cloud_model,
    deepCloudModel: getString(rc, 'deep_cloud_model') || RC_DEFAULTS.deep_cloud_model,
    deepCheckEnabled: getBoolean(rc, 'deep_check_enabled'),
  };
}

// ---------- Quick explanation (hybrid) ----------

const SYSTEM = `You are SignSense, a wallet security assistant. A user is about to sign a crypto
transaction or message. Explain in plain, friendly English what signing it will do and how risky it is.
Rules: be concrete and short. Never invent facts that are not in the request.
If any risk flag starts with DANGER, the verdict must be "likely_scam" or "be_careful", never "looks_safe".
Write for someone who is not technical.`;

const QUICK_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['looks_safe', 'be_careful', 'likely_scam'] },
    headline: { type: 'string', description: 'At most 12 words.' },
    explanation: { type: 'string', description: '2 or 3 short sentences.' },
    checks: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things the user should check before signing.' },
  },
  required: ['verdict', 'headline', 'explanation', 'checks'],
};
// Same shape for the cloud model, built with the SDK's Schema helpers.
const QUICK_SCHEMA_CLOUD = Schema.object({
  properties: {
    verdict: Schema.enumString({ enum: ['looks_safe', 'be_careful', 'likely_scam'] }),
    headline: Schema.string({ description: 'At most 12 words.' }),
    explanation: Schema.string({ description: '2 or 3 short sentences.' }),
    checks: Schema.array({ items: Schema.string(), description: 'Up to 3 things the user should check before signing.' }),
  },
});

const modelCache = new Map();
export function quickModel(mode, cloudModel) {
  const key = `${mode}|${cloudModel}`;
  if (!modelCache.has(key)) {
    modelCache.set(key, getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: cloudModel,
        systemInstruction: SYSTEM,
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: QUICK_SCHEMA_CLOUD },
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: 'text', languages: ['en'] }],
          expectedOutputs: [{ type: 'text', languages: ['en'] }],
          initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM }] }],
        },
        promptOptions: { responseConstraint: QUICK_SCHEMA },
      },
    }));
  }
  return modelCache.get(key);
}

export async function explainQuick(aiSummary, modeOverride) {
  const s = await getSettings();
  if (modeOverride) s.mode = modeOverride;
  const model = quickModel(s.mode, s.quickCloudModel);
  const prompt = `The user is about to approve this wallet request. Explain it.\n\n${JSON.stringify(aiSummary, null, 2)}`;
  const started = performance.now();
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { verdict: 'be_careful', headline: 'Review this request carefully', explanation: text, checks: [] }; }
  return {
    ...parsed,
    source: result.response.inferenceSource || (s.mode === InferenceMode.ONLY_IN_CLOUD ? 'in_cloud' : 'unknown'),
    ms: Math.round(performance.now() - started),
    mode: s.mode,
  };
}

// ---------- On-device model status / download ----------

export async function deviceAvailability() {
  if (typeof self.LanguageModel === 'undefined') return 'unsupported';
  try {
    return await self.LanguageModel.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  } catch { return 'unavailable'; }
}

/** Must be called from a click handler: Chrome only downloads the model after a user gesture. */
export async function downloadDeviceModel(onProgress) {
  const s = await getSettings();
  return quickModel(s.mode === InferenceMode.ONLY_IN_CLOUD ? InferenceMode.PREFER_ON_DEVICE : s.mode, s.quickCloudModel)
    .initializeDeviceModel(onProgress);
}

// ---------- Deep check (cloud only, grounded with Google Search) ----------

const DEEP_INSTRUCTION = `${SYSTEM}\nYou may search the web. Look for public reports that the site domain or the
contract/spender addresses are scams, wallet drainers or phishing, and whether they belong to a known, legitimate protocol.
Say clearly when you found nothing. Finish with one line: "Bottom line: ..."`;

const isQuotaError = (e) => /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(String(e?.message || e));

export async function deepCheck(deepContext) {
  const s = await getSettings();
  if (!s.deepCheckEnabled) throw new Error('Deep check is turned off in Remote Config.');
  const prompt = `Investigate this wallet request before the user signs it:\n${JSON.stringify(deepContext, null, 2)}`;
  // Try the stronger model first; if the project is out of quota for it, fall back to the
  // lighter model, which usually has a bigger free-tier allowance.
  const candidates = [...new Set([s.deepCloudModel, s.quickCloudModel])];
  let lastErr;
  for (const modelName of candidates) {
    try {
      const model = getGenerativeModel(ai, { model: modelName, tools: [{ googleSearch: {} }], systemInstruction: DEEP_INSTRUCTION });
      const result = await model.generateContent(prompt);
      const gm = result.response.candidates?.[0]?.groundingMetadata;
      return {
        text: result.response.text(),
        sources: (gm?.groundingChunks || []).map((c) => c.web).filter(Boolean),
        searchWidget: gm?.searchEntryPoint?.renderedContent || null,
        source: 'in_cloud',
        model: modelName,
        fellBack: modelName !== s.deepCloudModel,
      };
    } catch (e) {
      lastErr = e;
      if (!isQuotaError(e)) throw e;
      console.warn(`[SignSense] ${modelName} is out of quota, trying the next model`);
    }
  }
  const err = new Error('The cloud quota for deep checks is used up. Try again in a minute, or upgrade the Firebase project to the Blaze plan.');
  err.cause = lastErr;
  throw err;
}

export { InferenceMode };
