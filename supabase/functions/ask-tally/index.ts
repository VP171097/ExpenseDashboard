/**
 * Ask Tally: answers questions about a signed-in user's dashboard with Claude or Gemini.
 *
 * The browser sends a summary of the dashboard plus the conversation; this function checks the
 * caller is a signed-in user of your project, asks the AI, and streams the answer back as
 * newline-delimited JSON events. The AI key stays here as a secret and never reaches the
 * browser. Nothing from the request is logged or stored.
 *
 * Secrets (one of the two keys is needed):
 * - ANTHROPIC_API_KEY: answer with Claude (TALLY_AI_MODEL optional, default claude-opus-5-5)
 * - GEMINI_API_KEY: answer with Google Gemini, which has a free tier (GEMINI_MODEL optional,
 *   default gemini-flash-latest). Google may use free-tier requests to improve its products.
 * - TALLY_AI_PROVIDER: "claude" or "gemini" to choose when both keys are set (default claude).
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { ApiError, GoogleGenAI } from 'npm:@google/genai@2.29.1'
import { buildRequest, geminiRequest, GEMINI_MODEL, pump, pumpGemini, TALLY_MODEL, validate, type AiEvent, type Turn } from '../_shared/tally-ai.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) || ''
const provider = env('TALLY_AI_PROVIDER') === 'gemini' || (!env('ANTHROPIC_API_KEY') && env('GEMINI_API_KEY')) ? 'gemini' : 'claude'
let anthropic: Anthropic | null = null
let gemini: GoogleGenAI | null = null
async function* answer(context: string, turns: Turn[]): AsyncGenerator<AiEvent> {
  if (provider === 'gemini') {
    gemini ??= new GoogleGenAI({ apiKey: env('GEMINI_API_KEY'), ...(env('GEMINI_BASE_URL') ? { httpOptions: { baseUrl: env('GEMINI_BASE_URL') } } : {}) })
    yield* pumpGemini(await gemini.models.generateContentStream(geminiRequest(context, turns, env('GEMINI_MODEL') || GEMINI_MODEL)))
  } else {
    anthropic ??= new Anthropic() // reads ANTHROPIC_API_KEY
    yield* pump(anthropic.beta.messages.stream(buildRequest(context, turns, env('TALLY_AI_MODEL') || TALLY_MODEL)))
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  // only signed-in users of this project can use its AI key
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Sign in to Tally cloud to use Ask Tally.' })

  let body: { context?: unknown; turns?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'Badly formed request.' }) }
  const problem = validate(body.context, body.turns)
  if (problem) return json(400, { error: problem })

  const enc = new TextEncoder()
  const out = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (e: AiEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + '\n'))
      try {
        for await (const e of answer(body.context as string, body.turns as Turn[])) send(e)
      } catch (err) {
        send({ type: 'error', message: friendly(err) })
      } finally {
        ctrl.close()
      }
    },
  })
  return new Response(out, { headers: { ...cors, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } })
})

function friendly(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Ask Tally has reached its free limit for now. Try again in a minute.'
    if (err.status === 400 || err.status === 401 || err.status === 403) return 'The Gemini key on the server is missing or wrong. Check the GEMINI_API_KEY secret.'
    return `Gemini had a problem (${err.status}). Try again.`
  }
  if (err instanceof Anthropic.AuthenticationError) return 'The AI key on the server is missing or wrong. Check the ANTHROPIC_API_KEY secret.'
  if (err instanceof Anthropic.RateLimitError) return 'Ask Tally is busy right now. Try again in a minute.'
  if (err instanceof Anthropic.BadRequestError) return 'That question could not be sent. Try a shorter one.'
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Try again.'
  if (err instanceof Anthropic.APIError) return `The AI service had a problem (${err.status ?? 'unknown'}). Try again.`
  return 'Something went wrong. Try again.'
}
