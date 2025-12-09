// Lightweight PostHog helpers reused across messaging channels

const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY')
const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') || 'https://app.posthog.com'

export function generateTraceId(): string {
  return crypto.randomUUID()
}

export function calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    'gpt-4-turbo': { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
    'gpt-4': { input: 30.00 / 1_000_000, output: 60.00 / 1_000_000 },
    'whisper-1': { input: 0.006 / 60, output: 0 },
    'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 }
  }

  const modelPricing = pricing[model] || pricing['gpt-4o']
  return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output)
}

export async function identifyUser(
  userId: string,
  properties: { name?: string; phone?: string; conversation_id?: string; whatsapp_number?: string; [key: string]: any }
): Promise<void> {
  if (!POSTHOG_API_KEY) return

  try {
    const identifyData = {
      api_key: POSTHOG_API_KEY,
      event: '$identify',
      distinct_id: userId,
      properties: {
        $set: {
          ...(properties.name && { name: properties.name }),
          ...(properties.phone && { phone: properties.phone }),
          ...(properties.whatsapp_number && { whatsapp_number: properties.whatsapp_number }),
          ...(properties.conversation_id && { conversation_id: properties.conversation_id })
        },
        $set_once: {
          ...(properties.name && { name: properties.name })
        }
      }
    }

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identifyData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`PostHog identify failed: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.warn(`Error identifying PostHog user:`, error)
  }
}

export async function trackEvent(
  eventName: string,
  properties: Record<string, any>,
  distinctId: string,
  traceId?: string
): Promise<void> {
  if (!POSTHOG_API_KEY) {
    console.log('PostHog API key not configured, skipping event tracking')
    return
  }

  try {
    const eventData = {
      api_key: POSTHOG_API_KEY,
      event: eventName,
      distinct_id: distinctId,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        ...(traceId && { trace_id: traceId })
      }
    }

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`PostHog tracking failed for event ${eventName}: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.warn(`Error tracking PostHog event ${eventName}:`, error)
  }
}

export async function trackLLMGeneration(
  operation: string,
  model: string,
  input: any[],
  response: any,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  latency: number,
  userId: string,
  traceId: string,
  customProperties?: Record<string, any>
): Promise<void> {
  if (!POSTHOG_API_KEY) return

  try {
    const cost = calculateOpenAICost(model, usage.prompt_tokens, usage.completion_tokens)

    const eventData = {
      api_key: POSTHOG_API_KEY,
      event: '$ai_generation',
      distinct_id: userId,
      properties: {
        $ai_model: model,
        $ai_latency: latency / 1000,
        $ai_tools: Array.isArray(response.tools) ? response.tools.map((t: any) => t?.function?.name || t) : (response.tool_calls ? response.tool_calls.map((tc: any) => tc?.function?.name || 'unknown') : []),
        $ai_input: input,
        $ai_input_tokens: usage.prompt_tokens,
        $ai_output_choices: response.choices || [],
        $ai_output_tokens: usage.completion_tokens,
        $ai_total_cost_usd: cost,
        $ai_trace_id: traceId,
        operation,
        trace_id: traceId,
        used_tool_calling: !!(response.tool_calls && response.tool_calls.length > 0),
        ...customProperties
      }
    }

    const posthogResponse = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    })

    if (!posthogResponse.ok) {
      const errorText = await posthogResponse.text()
      console.warn(`PostHog LLM tracking failed: ${posthogResponse.status} - ${errorText}`)
    }
  } catch (error) {
    console.warn(`Error tracking PostHog LLM event:`, error)
  }
}



