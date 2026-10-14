/**
 * SpendCop AI: answers questions about a signed-in user's dashboard with Google Gemini.
 *
 * The browser sends a summary of the dashboard plus the conversation; this function checks the
 * caller is a signed-in user of your project, asks Gemini, and streams the answer back as
 * newline-delimited JSON events. The Gemini key stays here as a secret and never reaches the
 * browser. Nothing from the request is logged or stored.
 *
 * Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default gemini-flash-latest),
 * GEMINI_FALLBACK_MODEL (optional, used when the main model is busy; default gemini-flash-lite-latest).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { ApiError, GoogleGenAI } from 'npm:@google/genai@2.29.1'
import { geminiRequest, GEMINI_MODEL, pumpGemini, validate, type AiEvent, type Turn } from '../_shared/tally-ai.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) || ''
let gemini: GoogleGenAI | null = null
/** Google's lighter model, used when the main one is too busy to answer. */
const FALLBACK_MODEL = 'gemini-flash-lite-latest'
const busy = (e: unknown) => e instanceof ApiError && (e.status === 503 || e.status === 500 || e.status === 429)
async function* answer(context: string, turns: Turn[]): AsyncGenerator<AiEvent> {
  gemini ??= new GoogleGenAI({ apiKey: env('GEMINI_API_KEY'), ...(env('GEMINI_BASE_URL') ? { httpOptions: { baseUrl: env('GEMINI_BASE_URL') } } : {}) })
  const main = env('GEMINI_MODEL') || GEMINI_MODEL, spare = env('GEMINI_FALLBACK_MODEL') || FALLBACK_MODEL
  // when Gemini is busy: try again once, then switch to the lighter model
  const tries = [main, main, ...(spare !== main ? [spare] : [])]
  for (const [i, model] of tries.entries()) {
    let sent = false
    try {
      for await (const e of pumpGemini(await gemini.models.generateContentStream(geminiRequest(context, turns, model)))) { sent ||= e.type === 'text'; yield e }
      return
    } catch (e) {
      // once part of an answer has gone out, starting again would repeat it
      if (sent || !busy(e) || i === tries.length - 1) throw e
      if (i === 0) await new Promise((r) => setTimeout(r, 800))
    }
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
  if (!user) return json(401, { error: 'Log in to use SpendCop AI.' })
  if (!env('GEMINI_API_KEY')) return json(503, { error: 'SpendCop AI is not set up on the server yet.' })

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
    if (err.status === 429 || err.status === 503 || err.status === 500) return 'SpendCop AI is busy right now. Try again in a minute.'
    if (err.status === 400 || err.status === 401 || err.status === 403) return 'SpendCop AI is not set up correctly on the server. (Check the GEMINI_API_KEY secret.)'
    return `SpendCop AI had a problem (${err.status}). Try again.`
  }
  return 'SpendCop AI could not answer just now. Try again.'
}
