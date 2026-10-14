/**
 * Tally AI: answers questions about a signed-in user's dashboard with Google Gemini.
 *
 * The browser sends a summary of the dashboard plus the conversation; this function checks the
 * caller is a signed-in user of your project, asks Gemini, and streams the answer back as
 * newline-delimited JSON events. The Gemini key stays here as a secret and never reaches the
 * browser. Nothing from the request is logged or stored.
 *
 * Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default gemini-flash-latest).
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
async function* answer(context: string, turns: Turn[]): AsyncGenerator<AiEvent> {
  gemini ??= new GoogleGenAI({ apiKey: env('GEMINI_API_KEY'), ...(env('GEMINI_BASE_URL') ? { httpOptions: { baseUrl: env('GEMINI_BASE_URL') } } : {}) })
  yield* pumpGemini(await gemini.models.generateContentStream(geminiRequest(context, turns, env('GEMINI_MODEL') || GEMINI_MODEL)))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  // only signed-in users of this project can use its AI key
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Log in to use Tally AI.' })
  if (!env('GEMINI_API_KEY')) return json(503, { error: 'Tally AI is not set up on the server yet.' })

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
    if (err.status === 429) return 'Tally AI is busy right now. Try again in a minute.'
    if (err.status === 400 || err.status === 401 || err.status === 403) return 'Tally AI is not set up correctly on the server. (Check the GEMINI_API_KEY secret.)'
    return `Tally AI had a problem (${err.status}). Try again.`
  }
  return 'Tally AI could not answer just now. Try again.'
}
