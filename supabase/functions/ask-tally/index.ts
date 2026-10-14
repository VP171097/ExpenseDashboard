/**
 * Ask Tally: answers questions about a signed-in user's dashboard with Claude.
 *
 * The browser sends a summary of the dashboard plus the conversation; this function checks the
 * caller is a signed-in user of your project, asks Claude, and streams the answer back as
 * newline-delimited JSON events. The Anthropic API key stays here as a secret and never
 * reaches the browser. Nothing from the request is logged or stored.
 *
 * Secrets: ANTHROPIC_API_KEY (required), TALLY_AI_MODEL (optional, defaults to claude-opus-5-5).
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { buildRequest, pump, TALLY_MODEL, validate, type AiEvent, type Turn } from '../_shared/tally-ai.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  // only signed-in users of this project can spend its Claude credits
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Sign in to Tally cloud to use Ask Tally.' })

  let body: { context?: unknown; turns?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'Badly formed request.' }) }
  const problem = validate(body.context, body.turns)
  if (problem) return json(400, { error: problem })

  const params = buildRequest(body.context as string, body.turns as Turn[], Deno.env.get('TALLY_AI_MODEL') || TALLY_MODEL)
  const enc = new TextEncoder()
  const out = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (e: AiEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + '\n'))
      try {
        for await (const e of pump(anthropic.beta.messages.stream(params))) send(e)
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
  if (err instanceof Anthropic.AuthenticationError) return 'The AI key on the server is missing or wrong. Check the ANTHROPIC_API_KEY secret.'
  if (err instanceof Anthropic.RateLimitError) return 'Ask Tally is busy right now. Try again in a minute.'
  if (err instanceof Anthropic.BadRequestError) return 'That question could not be sent. Try a shorter one.'
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Try again.'
  if (err instanceof Anthropic.APIError) return `The AI service had a problem (${err.status ?? 'unknown'}). Try again.`
  return 'Something went wrong. Try again.'
}
