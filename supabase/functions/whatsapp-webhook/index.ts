import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OpenAI API configuration
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1'

// PostHog configuration
const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY')
const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') || 'https://app.posthog.com'

// Normalize Brazilian phone numbers by removing the 9th digit (extra 9 from mobile)
// This allows matching numbers with or without the extra 9
// Example: +5543991234567 becomes 554391234567
//          +554391234567 also becomes 554391234567
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '')
  
  // Brazilian phone format: Country(2) + Area(2) + Number(8-9)
  // If the number has 13 digits (55 + 2 area + 9 digits), remove the 9th digit (position 4)
  // 5543991234567 -> 554391234567 (removes the extra 9 at position 4)
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    // Check if position 4 is a 9 (the extra mobile digit)
    if (cleaned[4] === '9') {
      return cleaned.slice(0, 4) + cleaned.slice(5) // Remove the 9th digit
    }
  }
  
  return cleaned
}

interface WhatsAppMessage {
  conversation_id?: string
  message_type?: 'text' | 'audio' | 'image' | string
  content?: string
  content_type?: string
  media_url?: string
  timestamp?: string
  sender?: {
    phone_number: string
    name?: string
    type?: string
  }
  // Chatwoot specific fields
  conversation?: {
    id: number
  }
}

interface ProcessedBet {
  bet_type: string
  sport: string
  league?: string
  matches: Array<{
    description: string
    bet_description: string
    odds: number
    match_date?: string
    is_combined_odd?: boolean
  }>
  stake_amount: number
  bet_date: string
  odds_are_individual?: boolean
}

// Daily bet limit configuration
const DAILY_BET_LIMIT = 3
const TIMEZONE_GMT3 = 'America/Cuiaba' // GMT-3 (UTC-3)

// JSON Schema for structured outputs
// OpenAI requires additionalProperties: false for structured outputs
const BETTING_INFO_SCHEMA = {
  type: "object",
  properties: {
    bet_type: {
      type: "string",
      enum: ["single", "multiple", "system"]
    },
    sport: {
      type: "string"
    },
    league: {
      type: ["string", "null"]
    },
    matches: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["description", "bet_description", "odds", "match_date", "is_combined_odd"],
        properties: {
          description: {
            type: "string"
          },
          bet_description: {
            type: "string"
          },
          odds: {
            type: "number",
            minimum: 1.01
          },
          match_date: {
            type: ["string", "null"]
          },
          is_combined_odd: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    },
    stake_amount: {
      type: "number",
      minimum: 0
    },
    bet_date: {
      type: "string"
    },
    odds_are_individual: {
      type: "boolean"
    }
  },
  required: ["bet_type", "sport", "matches", "stake_amount", "bet_date", "odds_are_individual", "league"],
  additionalProperties: false
}

// Calculator tool definition
const CALCULATE_ODDS_TOOL = {
  type: "function",
  function: {
    name: "calculate_multiple_odds",
    description: "Calculate the combined odds for multiple bets by multiplying individual odds together. Use this tool when you need to verify or calculate odds for a multiple bet, especially when uncertain about whether odds are individual or already combined.",
    parameters: {
      type: "object",
      properties: {
        odds: {
          type: "array",
          items: { type: "number" },
          description: "Array of individual odds to multiply together"
        }
      },
      required: ["odds"]
    }
  }
}

// Calculator function implementation
async function calculateMultipleOdds(odds: number[]): Promise<number> {
  if (!odds || odds.length === 0) return 1
  const result = odds.reduce((acc, odd) => {
    if (odd < 1.01) return acc * 1.01 // Minimum odd safety check
    return acc * odd
  }, 1)
  return Math.round(result * 100) / 100 // Round to 2 decimal places
}

// PostHog helper functions
function generateTraceId(): string {
  return crypto.randomUUID()
}

function calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
  // OpenAI pricing as of 2024 (update as needed)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    'gpt-4-turbo': { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
    'gpt-4': { input: 30.00 / 1_000_000, output: 60.00 / 1_000_000 },
    'whisper-1': { input: 0.006 / 60, output: 0 }, // Per minute
    'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 }
  }
  
  const modelPricing = pricing[model] || pricing['gpt-4o']
  return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output)
}

// Identify user in PostHog and set properties (name, phone, conversation_id)
// This creates/updates a single person in PostHog with all user information
async function identifyUser(
  userId: string,
  properties: { name?: string; phone?: string; conversation_id?: string; whatsapp_number?: string; [key: string]: any }
): Promise<void> {
  if (!POSTHOG_API_KEY) {
    return
  }

  try {
    // PostHog $identify event format
    // This will merge/update the person with the given distinct_id
    const identifyData = {
      api_key: POSTHOG_API_KEY,
      event: '$identify',
      distinct_id: userId,
      properties: {
        $set: {
          // Set user properties - will overwrite existing values
          ...(properties.name && { name: properties.name }),
          ...(properties.phone && { phone: properties.phone }),
          ...(properties.whatsapp_number && { whatsapp_number: properties.whatsapp_number }),
          ...(properties.conversation_id && { conversation_id: properties.conversation_id })
        },
        $set_once: {
          // Only set these once if not already present (preserve first value)
          ...(properties.name && { name: properties.name })
        }
      }
    }

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(identifyData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`PostHog identify failed: ${response.status} - ${errorText}`)
    } else {
      console.log(`✅ PostHog user identified: ${userId} (name: ${properties.name || 'N/A'})`)
    }
  } catch (error) {
    console.warn(`Error identifying PostHog user:`, error)
  }
}

async function trackEvent(
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

    // PostHog HTTP API endpoint for single event capture
    // Format: POST /capture/ with JSON body containing api_key, event, distinct_id, properties
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`PostHog tracking failed for event ${eventName}: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    // Non-blocking - don't throw errors if PostHog fails
    console.warn(`Error tracking PostHog event ${eventName}:`, error)
  }
}

async function trackLLMGeneration(
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
  if (!POSTHOG_API_KEY) {
    return
  }

  try {
    const cost = calculateOpenAICost(model, usage.prompt_tokens, usage.completion_tokens)
    
    const eventData = {
      api_key: POSTHOG_API_KEY,
      event: '$ai_generation',
      distinct_id: userId,
      properties: {
        $ai_model: model,
        $ai_latency: latency / 1000, // Convert to seconds
        $ai_tools: Array.isArray(response.tools) ? response.tools.map((t: any) => t?.function?.name || t) : (response.tool_calls ? response.tool_calls.map((tc: any) => tc?.function?.name || 'unknown') : []),
        $ai_input: input,
        $ai_input_tokens: usage.prompt_tokens,
        $ai_output_choices: response.choices || [],
        $ai_output_tokens: usage.completion_tokens,
        $ai_total_cost_usd: cost,
        $ai_trace_id: traceId, // REQUIRED: PostHog LLM analytics filter requires distinct_id != properties.$ai_trace_id
        operation,
        trace_id: traceId, // Also keep trace_id for custom filtering
        used_tool_calling: !!(response.tool_calls && response.tool_calls.length > 0),
        ...customProperties
      }
    }

    // PostHog HTTP API endpoint for LLM analytics events
    // Using $ai_generation event name for LLM analytics dashboard
    const posthogResponse = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    })

    if (!posthogResponse.ok) {
      const errorText = await posthogResponse.text()
      console.warn(`PostHog LLM tracking failed: ${posthogResponse.status} - ${errorText}`)
    } else {
      console.log(`✅ PostHog LLM event tracked: ${operation} (${model}) - ${cost.toFixed(4)}`)
    }
  } catch (error) {
    console.warn(`Error tracking PostHog LLM event:`, error)
  }
}

// Get the count of bets placed today in GMT-3 timezone
async function getDailyBetCount(supabase: any, userId: string): Promise<number> {
  try {
    // Get current UTC time
    const nowUTC = new Date()
    
    // Convert to GMT-3 time (subtract 3 hours)
    const gmt3Offset = -3 * 60 * 60 * 1000 // -3 hours in milliseconds
    const nowGMT3 = new Date(nowUTC.getTime() + gmt3Offset)
    
    // Get date string in GMT-3 (YYYY-MM-DD)
    const year = nowGMT3.getUTCFullYear()
    const month = String(nowGMT3.getUTCMonth() + 1).padStart(2, '0')
    const day = String(nowGMT3.getUTCDate()).padStart(2, '0')
    const gmt3DateString = `${year}-${month}-${day}`
    
    // Create midnight in GMT-3 (00:00:00 GMT-3)
    // Since GMT-3 is UTC-3, midnight GMT-3 = 03:00 UTC
    const startOfDayUTC = new Date(`${gmt3DateString}T03:00:00.000Z`)
    
    // Start of tomorrow in GMT-3
    const tomorrowGMT3 = new Date(nowGMT3.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowYear = tomorrowGMT3.getUTCFullYear()
    const tomorrowMonth = String(tomorrowGMT3.getUTCMonth() + 1).padStart(2, '0')
    const tomorrowDay = String(tomorrowGMT3.getUTCDate()).padStart(2, '0')
    const gmt3TomorrowDateString = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`
    const startOfTomorrowUTC = new Date(`${gmt3TomorrowDateString}T03:00:00.000Z`)
    
    // Query bets from start of today (GMT-3) to start of tomorrow (GMT-3)
    const { count, error } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('bet_date', startOfDayUTC.toISOString())
      .lt('bet_date', startOfTomorrowUTC.toISOString())
    
    if (error) {
      console.error('Error counting daily bets:', error)
      return 0
    }
    
    return count || 0
  } catch (error) {
    console.error('Error getting daily bet count:', error)
    return 0
  }
}

// Check if user has reached the daily bet limit
// Also checks user betinho_subscription_status - premium users have no limit
async function hasReachedDailyLimit(supabase: any, userId: string): Promise<boolean> {
  try {
    // First, check user's Betinho subscription status
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('betinho_subscription_status')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user Betinho subscription status:', userError)
      // In case of error, fail open (allow bet)
      return false
    }

    // Premium users have no limit - skip the check
    if (user?.betinho_subscription_status === 'premium') {
      console.log(`User ${userId} has premium Betinho status - no bet limit applied`)
      return false
    }

    // Free or disabled users have the limit applied
    const betCount = await getDailyBetCount(supabase, userId)
    console.log(`User ${userId} has ${betCount} bets today (limit: ${DAILY_BET_LIMIT}, status: ${user?.betinho_subscription_status || 'free'})`)
    return betCount >= DAILY_BET_LIMIT
  } catch (error) {
    console.error('Error checking daily limit:', error)
    // In case of error, allow the bet (fail open)
    return false
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('WhatsApp webhook received:', new Date().toISOString())
    
    // Generate trace ID for this request
    const traceId = generateTraceId()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the incoming message
    const payload = await req.json()
    console.log('Received payload:', JSON.stringify(payload, null, 2))

    // Extract conversation_id from Chatwoot payload
    const conversationId = payload.conversation?.id?.toString() || payload.conversation_id
    const phoneNumber = payload.sender?.phone_number
    const content = payload.content
    const contentType = payload.content_type || 'text'
    const messageType = payload.message_type || 'incoming'
    const attachments = payload.attachments || []
    
    // Don't track message received here - we'll track it after finding the user
    
    // CRITICAL: Ignore outgoing messages to prevent infinite loops
    if (messageType === 'outgoing') {
      console.log('Ignoring outgoing message to prevent loop')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Outgoing message ignored'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    // Check if message has attachments (images/audio) BEFORE checking content
    const hasImageAttachment = attachments.some(att => att.file_type === 'image')
    const hasAudioAttachment = attachments.some(att => att.file_type === 'audio')
    
    // Only ignore empty messages if there are NO attachments
    if ((!content || content.trim().length === 0) && !hasImageAttachment && !hasAudioAttachment) {
      console.log('Ignoring empty message with no attachments')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Empty message ignored'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    // Ignore messages that look like system confirmations (only check if content exists)
    if (content) {
      const systemMessagePatterns = [
        /🎯.*Aposta Registrada com Sucesso/i,
        /📊.*Detalhes da Aposta/i,
        /❓.*Não consegui identificar uma aposta/i,
        /✅.*Sua aposta foi salva/i,
        /🆔.*ID:/i,
        /Status da Aposta Atualizado/i,
        /Parabéns.*Sua aposta foi vencedora/i,
        /Cashout realizado/i,
        /Não desista.*Continue analisando/i
      ]
      
      if (systemMessagePatterns.some(pattern => pattern.test(content))) {
        console.log('Ignoring system/bot message:', content.substring(0, 50) + '...')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'System message ignored'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
      
      // Additional check: ignore messages that are too long (likely system messages)
      if (content.length > 500) {
        console.log('Ignoring long message (likely system message):', content.length, 'characters')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Long message ignored'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }
    
    // Check if sender is a bot or system (based on sender info)
    const sender = payload.sender || {}
    const senderName = sender.name || ''
    const senderType = sender.type || 'user'
    
    // Ignore if sender is identified as bot/system
    if (senderType === 'bot' || senderType === 'system' || 
        senderName.toLowerCase().includes('bot') || 
        senderName.toLowerCase().includes('system') ||
        senderName.toLowerCase().includes('assistant')) {
      console.log('Ignoring message from bot/system sender:', senderName, senderType)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Bot/system sender ignored'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    // Determine actual content type and content (hasImageAttachment and hasAudioAttachment already defined above)
    let actualContent = content
    let actualContentType = contentType
    let mediaUrl = null
    
    // Handle cases where user sends media WITH text
    if (hasImageAttachment) {
      actualContentType = 'image'
      mediaUrl = attachments.find(att => att.file_type === 'image')?.data_url
      // Keep the text content if present - we'll combine it with image analysis later
    } else if (hasAudioAttachment) {
      actualContentType = 'audio'
      mediaUrl = attachments.find(att => att.file_type === 'audio')?.data_url
      // Keep the text content if present - we'll combine it with audio transcription later
    }

    console.log('Extracted data:', {
      conversationId,
      phoneNumber,
      content: actualContent,
      contentType: actualContentType,
      messageType,
      senderName: sender.name,
      senderType: sender.type,
      hasImageAttachment,
      hasAudioAttachment,
      mediaUrl
    })

    // Validate required fields
    if (!conversationId) {
      throw new Error('Missing conversation_id')
    }

    // Find user by conversation_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, whatsapp_number, name')
      .eq('conversation_id', conversationId)
      .single()

    if (userError || !user) {
      console.log('User not found for conversation_id:', conversationId)
      
      // If this is a sync message, try to find user by phone number
      if (phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber)
        console.log('Looking for user with normalized phone:', normalizedPhone)
        
        // Try to find user with normalized phone number
        const { data: allUsers } = await supabase
          .from('users')
          .select('id, whatsapp_number, name')
        
        // Find user by comparing normalized phone numbers
        const syncUser = allUsers?.find(u => 
          normalizePhoneNumber(u.whatsapp_number || '') === normalizedPhone
        )
        
        const syncError = !syncUser

        if (syncUser && !syncError) {
          console.log('Found user by phone, syncing conversation_id')
          
          // Check if this is the first sync by checking if conversation_id is NULL
          const { data: userBeforeSync } = await supabase
            .from('users')
            .select('conversation_id')
            .eq('id', syncUser.id)
            .single()
          
          const isFirstSync = !userBeforeSync?.conversation_id
          
          // Update user with conversation_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              conversation_id: conversationId,
              whatsapp_synced: true 
            })
            .eq('id', syncUser.id)

          if (!updateError) {
            console.log('User synced successfully:', syncUser.id)
            
            // Identify user in PostHog after sync
            await identifyUser(syncUser.id, {
              name: syncUser.name || undefined,
              phone: phoneNumber || undefined,
              conversation_id: conversationId || undefined,
              whatsapp_number: syncUser.whatsapp_number || undefined
            }).catch(() => {})
            
            // Send welcome message only if this is the first sync
            if (isFirstSync) {
              console.log('First sync detected, sending welcome message')
              await sendWelcomeMessage(supabase, syncUser.id).catch(() => {})
            }
            
            return new Response(
              JSON.stringify({
                success: true,
                message: 'WhatsApp account synced successfully',
                user_id: syncUser.id
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            )
          }
        } else {
          console.log('No user found with phone number:', normalizedPhone)
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'User not found for this conversation'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    console.log('Found user:', user.id)

    // Identify user in PostHog with name and properties
    await identifyUser(user.id, {
      name: user.name || undefined,
      phone: phoneNumber || undefined,
      conversation_id: conversationId || undefined,
      whatsapp_number: user.whatsapp_number || undefined
    }).catch(() => {})

    // Track message received event with user ID
    await trackEvent(
      'whatsapp_message_received',
      {
        conversation_id: conversationId,
        phone_number: phoneNumber,
        message_type: contentType,
        has_media: attachments.length > 0,
        content_length: content?.length || 0,
        message_type_detail: messageType
      },
      user.id,
      traceId
    ).catch(() => {})

    // Handle different message types
    let processedContent = ''
    let processedMessageType = actualContentType

    if (actualContentType === 'audio' && mediaUrl) {
      // Transcribe audio using OpenAI Whisper
      const transcription = await transcribeAudio(mediaUrl, user.id, traceId)
      
      // Combine transcription with additional text if present
      if (actualContent && actualContent.trim()) {
        processedContent = `Transcrição do áudio: ${transcription}\n\nTexto adicional: ${actualContent}`
        console.log('Combined audio transcription with text')
      } else {
        processedContent = transcription
      }
      processedMessageType = 'text' // Treat as text after transcription
    } else if (actualContentType === 'image' && mediaUrl) {
      // Process image using OpenAI Vision
      const imageAnalysis = await processImage(mediaUrl, user.id, traceId)
      
      // Combine image analysis with additional text if present
      if (actualContent && actualContent.trim()) {
        processedContent = `Análise da imagem: ${imageAnalysis}\n\nTexto adicional do usuário: ${actualContent}`
        console.log('Combined image analysis with user text')
      } else {
        processedContent = imageAnalysis
      }
      processedMessageType = 'text' // Treat as text after processing
    } else if (actualContentType === 'text' && actualContent) {
      processedContent = actualContent
    } else {
      // If no content and no media, skip processing
      console.log('No content or media to process')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No content or media to process'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Add message to queue for processing
    const { data: queueMessage, error: queueError } = await supabase
      .from('message_queue')
      .insert({
        user_id: user.id,
        message_type: processedMessageType,
        content: processedContent,
        media_url: mediaUrl,
        status: 'pending'
      })
      .select()
      .single()

    if (queueError) {
      console.error('Error adding message to queue:', queueError)
      throw new Error('Failed to add message to queue')
    }

    console.log('Message added to queue:', queueMessage.id)

    // Process the message immediately
    await processMessage(supabase, queueMessage.id, processedContent, user.id, traceId)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message processed successfully',
        queue_id: queueMessage.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in WhatsApp webhook:', error)
    
    // Track error event - try to use user ID if available, otherwise use conversation_id
    // This will be linked if we later identify the user
    const errorUserId = payload?.user?.id || payload?.conversation_id || 'unknown'
    const traceId = generateTraceId() // Generate new trace ID if we don't have one
    await trackEvent(
      'processing_error',
      {
        error_type: 'whatsapp_webhook_error',
        error_message: error.message?.substring(0, 500), // Limit message length
        conversation_id: payload?.conversation_id,
        phone_number: payload?.sender?.phone_number
      },
      errorUserId,
      traceId
    ).catch(() => {}) // Ignore PostHog errors
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioUrl: string, userId: string, traceId: string): Promise<string> {
  const startTime = Date.now()
  
  try {
    console.log('Transcribing audio:', audioUrl)
    
    const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: audioUrl,
        model: 'whisper-1',
        language: 'pt' // Portuguese
      })
    })

    const latency = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      
      // Track OpenAI API error
      await trackEvent(
        'openai_api_error',
        {
          error_type: 'transcribe_audio_error',
          error_message: errorText.substring(0, 500),
          model: 'whisper-1',
          operation: 'transcribe_audio'
        },
        userId,
        traceId
      ).catch(() => {})
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    // Track successful transcription (Whisper doesn't return usage, estimate)
    const estimatedUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    await trackLLMGeneration(
      'transcribe_audio',
      'whisper-1',
      [{ role: 'user', content: audioUrl }],
      { choices: [{ message: { content: result.text } }] },
      estimatedUsage,
      latency,
      userId,
      traceId
    ).catch(() => {})
    
    console.log('Audio transcribed successfully')
    return result.text
  } catch (error) {
    console.error('Error transcribing audio:', error)
    
    // Track error
    await trackEvent(
      'processing_error',
      {
        error_type: 'transcribe_audio_error',
        error_message: error.message?.substring(0, 500),
        operation: 'transcribe_audio'
      },
      userId,
      traceId
    ).catch(() => {})
    
    throw new Error(`Failed to transcribe audio: ${error.message}`)
  }
}

// Process image using OpenAI Vision
async function processImage(imageUrl: string, userId: string, traceId: string): Promise<string> {
  const startTime = Date.now()
  
  try {
    console.log('Processing image:', imageUrl)
    
    const messages = [{
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: `Analise esta imagem de aposta esportiva e extraia TODAS as informações possíveis em português.

CRÍTICO - Reconhecer Múltiplas Seções de Apostas Múltiplas:
- Se a imagem mostrar VÁRIAS seções de "CRIAR APOSTA" ou múltiplas apostas COM SUAS PRÓPRIAS ODDS COMBINADAS (ex: uma seção mostra "1.86" e outra mostra "4.60"), cada seção é uma MÚLTIPLA APOSTA separada com sua odd já combinada
- Cada seção de "CRIAR APOSTA" com uma odd mostrada (como "1.86" ou "4.60") representa UMA múltipla aposta já combinada
- Se houver múltiplas seções, você precisa identificar a ODD COMBINADA de cada seção (não as odds individuais dos jogadores)

CASO 1: Uma única seção com múltiplas apostas individuais
- Se houver apenas UMA seção com vários jogadores e uma odd combinada no topo (ex: "3.20")
- Extraia cada jogador individualmente com suas odds individuais
- Exemplo: "Jogador 1 - Tipo - Odd: 2.80, Jogador 2 - Tipo - Odd: 3.20"

CASO 2: Múltiplas seções de "CRIAR APOSTA" com odds combinadas
- Se houver VÁRIAS seções de "CRIAR APOSTA", cada uma com sua própria odd combinada
- Para cada seção, identifique a ODD COMBINADA mostrada (ex: "1.86" ou "4.60")
- Liste cada seção como uma "perna" com a odd combinada
- Exemplo: "SEÇÃO 1: Odd combinada 1.86 (Royce O'Neale + Devin Booker)"
         "SEÇÃO 2: Odd combinada 4.60 (Jerami Grant + Deni Avdija)"

Para cada seção/aposta identifique:
- Times/atletas envolvidos
- Tipo de aposta (pontos, assistências, rebotes, etc.)
- Se houver odd combinada mostrada claramente na seção, use essa odd (é uma múltipla aposta já calculada)
- Se não houver odd combinada, extraia odds individuais
- Valor apostado (se visível, geralmente no final)
- Esporte e liga/campeonato

Retorne apenas o texto estruturado, sem explicações adicionais.`
        },
        {
          type: 'image_url',
          image_url: { url: imageUrl }
        }
      ]
    }]
    
    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 800
      })
    })

    const latency = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      
      // Track OpenAI API error
      await trackEvent(
        'openai_api_error',
        {
          error_type: 'process_image_error',
          error_message: errorText.substring(0, 500),
          model: 'gpt-4o',
          operation: 'process_image'
        },
        userId,
        traceId
      ).catch(() => {})
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    // Track LLM generation event
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    await trackLLMGeneration(
      'process_image',
      'gpt-4o',
      messages,
      result,
      usage,
      latency,
      userId,
      traceId
    ).catch(() => {})
    
    console.log('Image processed successfully')
    return result.choices[0].message.content
  } catch (error) {
    console.error('Error processing image:', error)
    
    // Track error
    await trackEvent(
      'processing_error',
      {
        error_type: 'process_image_error',
        error_message: error.message?.substring(0, 500),
        operation: 'process_image'
      },
      userId,
      traceId
    ).catch(() => {})
    
    throw new Error(`Failed to process image: ${error.message}`)
  }
}

// Process message and extract betting information
async function processMessage(supabase: any, messageId: string, content: string, userId: string, traceId: string) {
  try {
    console.log('Processing message:', messageId)
    
    // Update message status to processing
    await supabase
      .from('message_queue')
      .update({ status: 'processing' })
      .eq('id', messageId)

    // Validate if message looks like a betting message before processing
    const normalizedContent = content.toLowerCase().trim()
    
    // List of simple greetings/common messages that are clearly not bets
    const simpleGreetings = ['oi', 'olá', 'ola', 'hello', 'hi', 'hey', 'eae', 'e aí', 'eai', 'tudo bem', 'tudo bom', 'ok', 'okay', 'beleza', 'blz']
    
    // Check if message is too short or is a simple greeting
    const isSimpleGreeting = simpleGreetings.some(greeting => normalizedContent === greeting)
    const isTooShort = normalizedContent.length < 10 && !normalizedContent.match(/\d/) // Less than 10 chars and no numbers
    
    // Check if message has betting-related keywords
    const bettingKeywords = ['odd', 'odds', 'aposta', 'apost', 'jogo', 'time', 'times', 'vs', 'pontos', 'gols', 'assist', 'rebote', 'stake', 'valor', 'reais', 'r$', 'bet', 'betting']
    const hasBettingKeywords = bettingKeywords.some(keyword => normalizedContent.includes(keyword))
    
    // If it's a simple greeting or too short without numbers, skip betting extraction and send help
    if (isSimpleGreeting || (isTooShort && !hasBettingKeywords)) {
      console.log('Message appears to be a greeting or non-betting message, skipping extraction:', content)
      
      // Track that we skipped extraction
      await trackEvent(
        'bet_extraction_skipped',
        {
          message_id: messageId,
          reason: isSimpleGreeting ? 'simple_greeting' : 'too_short_without_keywords',
          content_length: content.length
        },
        userId,
        traceId
      ).catch(() => {})
      
      // Update message status to failed
      await supabase
        .from('message_queue')
        .update({ 
          status: 'failed',
          error_message: 'Message does not appear to be a betting message'
        })
        .eq('id', messageId)
      
      // Send help message
      await sendHelpMessage(supabase, userId)
      
      return // Exit early, don't process as bet
    }
    
    // Track bet extraction started
    await trackEvent(
      'bet_extraction_started',
      {
        message_id: messageId,
        content_length: content.length
      },
      userId,
      traceId
    ).catch(() => {})

    // Use OpenAI to extract betting information
    const bettingInfo = await extractBettingInfo(content, userId, traceId)
    
    // Validate that betting info is valid and has meaningful matches
    if (bettingInfo && bettingInfo.matches && bettingInfo.matches.length > 0) {
      // Additional validation: check if matches have valid descriptions and odds
      const validMatches = bettingInfo.matches.filter(match => 
        match.description && 
        match.description.trim().length > 0 &&
        match.bet_description && 
        match.bet_description.trim().length > 0 &&
        match.odds && 
        match.odds >= 1.01
      )
      
      // If no valid matches after filtering, treat as non-betting message
      if (validMatches.length === 0) {
        console.log('No valid matches found after validation, treating as non-betting message')
        
        // Track that extraction returned invalid matches
        await trackEvent(
          'bet_extraction_failed',
          {
            message_id: messageId,
            reason: 'invalid_matches_extracted'
          },
          userId,
          traceId
        ).catch(() => {})
        
        // Update message status to failed
        await supabase
          .from('message_queue')
          .update({ 
            status: 'failed',
            error_message: 'Extracted matches are invalid'
          })
          .eq('id', messageId)
        
        // Send help message
        await sendHelpMessage(supabase, userId)
        
        return // Exit early, don't process as bet
      }
      
      // Use only valid matches
      bettingInfo.matches = validMatches
      // Track bet extraction success
      await trackEvent(
        'bet_extraction_success',
        {
          matches_count: bettingInfo.matches.length,
          bet_type: bettingInfo.bet_type,
          sport: bettingInfo.sport,
          odds_are_individual: bettingInfo.odds_are_individual,
          used_calculator_tool: bettingInfo.odds_are_individual !== undefined // Indicates if extraction was successful
        },
        userId,
        traceId
      ).catch(() => {})
      
      // Check if user has reached daily bet limit
      const limitReached = await hasReachedDailyLimit(supabase, userId)
      
      if (limitReached) {
        console.log(`User ${userId} has reached daily bet limit (${DAILY_BET_LIMIT} bets/day)`)
        
        // Track daily limit reached
        await trackEvent(
          'daily_limit_reached',
          {
            user_id: userId,
            daily_limit: DAILY_BET_LIMIT
          },
          userId,
          traceId
        ).catch(() => {})
        
        // Update message status to completed (but not saved)
        await supabase
          .from('message_queue')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString(),
            error_message: 'Daily bet limit reached'
          })
          .eq('id', messageId)
        
        // Send paywall message instead of confirmation
        await sendPaywallMessage(supabase, userId)
        
        return // Exit early, don't save the bet
      }
      
      // Validate and sanitize odds before calculation
      const MAX_INDIVIDUAL_ODD = 20.0 // Maximum reasonable odd for prop bets
      
      // CRITICAL: If there are multiple matches, this MUST be treated as a multiple bet
      // Force bet_type to 'multiple' if we have more than 1 match
      if (bettingInfo.matches.length > 1 && bettingInfo.bet_type !== 'multiple') {
        console.log(`⚠️ Multiple matches detected (${bettingInfo.matches.length}) but bet_type is '${bettingInfo.bet_type}'. Auto-correcting to 'multiple'.`)
        bettingInfo.bet_type = 'multiple'
      }
      
      // Validate individual odds and log warnings for suspicious values
      const validatedMatches = bettingInfo.matches.map((match, index) => {
        const odd = match.odds || 1
        if (odd > MAX_INDIVIDUAL_ODD) {
          console.warn(`⚠️ Suspicious individual odd detected for match ${index + 1}: ${odd}. This might be a combined odd extracted incorrectly.`)
          
          // Track validation warning
          trackEvent(
            'bet_validation_warning',
            {
              warning_type: 'high_individual_odd',
              odds_value: odd,
              match_index: index + 1,
              max_individual_odd: MAX_INDIVIDUAL_ODD
            },
            userId,
            traceId
          ).catch(() => {})
          
          // Cap the odd at MAX_INDIVIDUAL_ODD to prevent absurd calculations
          // But keep original for logging
          return { ...match, odds: Math.min(odd, MAX_INDIVIDUAL_ODD), original_odd: odd }
        }
        if (odd < 1.01) {
          console.warn(`⚠️ Odd too low detected for match ${index + 1}: ${odd}. Using minimum of 1.01.`)
          
          // Track validation warning
          trackEvent(
            'bet_validation_warning',
            {
              warning_type: 'low_odd',
              odds_value: odd,
              match_index: index + 1
            },
            userId,
            traceId
          ).catch(() => {})
          
          return { ...match, odds: 1.01 }
        }
        return match
      })
      
      // Calculate total odds based on odds type
      let totalOdds = 1
      
      if (bettingInfo.bet_type === 'multiple' && validatedMatches.length > 1) {
        console.log(`📊 Calculating multiple bet with ${validatedMatches.length} legs:`)
        validatedMatches.forEach((match, index) => {
          const oddType = match.is_combined_odd ? 'combined' : 'individual'
          console.log(`   Leg ${index + 1}: ${match.bet_description.substring(0, 60)}... - Odd: ${match.odds?.toFixed(2) || 'N/A'} (${oddType})`)
        })
        
        // Calculate total odds - ALWAYS multiply all legs together
        // Each leg's odd is already the final odd for that leg (whether individual or combined)
        // We just multiply all legs together regardless of whether odds_are_individual is true or false
        totalOdds = validatedMatches.reduce((acc, match, index) => {
          const odd = match.odds || 1
          const oddType = match.is_combined_odd ? 'combined' : 'individual'
          const product = acc * odd
          console.log(`  Step ${index + 1}: ${acc.toFixed(2)} × ${odd.toFixed(2)} (${oddType}) = ${product.toFixed(2)}`)
          return product
        }, 1)
        
        const combinedCount = validatedMatches.filter(m => m.is_combined_odd).length
        const individualCount = validatedMatches.length - combinedCount
        console.log(`✅ FINAL Calculated multiple bet odds: ${totalOdds.toFixed(2)}`)
        console.log(`   Total legs: ${validatedMatches.length} (${combinedCount} with combined odds, ${individualCount} with individual odds)`)
        
        console.log(`   All odds used: ${validatedMatches.map(m => m.odds?.toFixed(2) || 'N/A').join(', ')}`)
        
        // Warn if result seems unusual
        if (totalOdds > 1000 && validatedMatches.length <= 5) {
          console.warn(`⚠️ High combined odds calculated: ${totalOdds.toFixed(2)} for ${validatedMatches.length} legs.`)
          console.warn('Verify if all legs are correctly identified and odds are correct.')
        }
      } else if (validatedMatches.length === 1) {
        // Single bet - just use the first match's odds
        totalOdds = validatedMatches[0]?.odds || 1
        console.log(`✅ Single bet odds: ${totalOdds.toFixed(2)}`)
      } else {
        // Fallback: multiply all odds (shouldn't happen with proper schema validation)
        totalOdds = validatedMatches.reduce((acc, match) => acc * (match.odds || 1), 1)
        console.warn(`⚠️ Unexpected scenario: ${validatedMatches.length} matches but not multiple bet type. Calculated: ${totalOdds.toFixed(2)}`)
      }
      
      // Save main bet to database
      // Always use current date/time for bet_date (when the bet was placed)
      const currentDate = new Date().toISOString()
      
      // Ensure stake_amount has a value (default to 0 if not identified)
      const stakeAmount = bettingInfo.stake_amount || 0
      const calculatedOdds = bettingInfo.bet_type === 'multiple' ? totalOdds : (validatedMatches[0]?.odds || bettingInfo.matches[0]?.odds)
      
      // Update bettingInfo with validated matches for saving
      bettingInfo.matches = validatedMatches
      
      const { data: bet, error: betError} = await supabase
        .from('bets')
        .insert({
          user_id: userId,
          bet_type: bettingInfo.bet_type,
          sport: bettingInfo.sport || 'outros', // Default to 'outros' if sport is not identified
          league: bettingInfo.league || null,
          match_description: validatedMatches.length === 1 
            ? validatedMatches[0]?.description 
            : `Múltipla (${validatedMatches.length} seleções)`,
          bet_description: validatedMatches.length === 1 
            ? validatedMatches[0]?.bet_description 
            : validatedMatches.map((m, i) => `${m.description} - ${m.bet_description}`).join(' • '),
          odds: calculatedOdds,
          stake_amount: stakeAmount, // Default to 0 if not identified
          potential_return: stakeAmount * calculatedOdds,
          bet_date: currentDate, // Always use current timestamp
          match_date: validatedMatches[0]?.match_date || null,
          raw_input: content,
          processed_data: bettingInfo
        })
        .select()
        .single()

      if (betError) {
        console.error('Error saving bet:', betError)
        throw betError
      }

      console.log('Bet saved successfully:', bet.id)

      // Track bet creation
      await trackEvent(
        'bet_created',
        {
          bet_id: bet.id,
          bet_type: bettingInfo.bet_type,
          total_odds: calculatedOdds,
          stake_amount: stakeAmount,
          legs_count: validatedMatches.length
        },
        userId,
        traceId
      ).catch(() => {})

      // Save individual bet legs for multiple bets
      if (bettingInfo.bet_type === 'multiple' && validatedMatches.length > 1) {
        console.log(`💾 Saving ${validatedMatches.length} bet legs...`)
        const savedLegs: number[] = []
        const failedLegs: number[] = []
        
        for (let i = 0; i < validatedMatches.length; i++) {
          const match = validatedMatches[i]
          
          // Validate leg has required fields before saving
          if (!match.description || !match.bet_description || !match.odds) {
            console.error(`⚠️ Leg ${i + 1} missing required fields:`, {
              hasDescription: !!match.description,
              hasBetDescription: !!match.bet_description,
              hasOdds: !!match.odds
            })
            failedLegs.push(i + 1)
            continue
          }
          
          const { data: leg, error: legError } = await supabase
            .from('bet_legs')
            .insert({
              bet_id: bet.id,
              leg_number: i + 1,
              sport: bettingInfo.sport || 'outros',
              match_description: match.description,
              bet_description: match.bet_description,
              odds: match.odds,
              status: 'pending'
            })
            .select()
            .single()

          if (legError) {
            console.error(`❌ Error saving bet leg ${i + 1}:`, legError)
            failedLegs.push(i + 1)
          } else {
            savedLegs.push(i + 1)
            console.log(`✅ Leg ${i + 1} saved: ${match.bet_description.substring(0, 50)}...`)
          }
        }
        
        // Validate all legs were saved
        if (savedLegs.length !== validatedMatches.length) {
          console.warn(`⚠️ Leg mismatch: Expected ${validatedMatches.length} legs, saved ${savedLegs.length}`)
          console.warn(`   Saved legs: ${savedLegs.join(', ')}`)
          if (failedLegs.length > 0) {
            console.warn(`   Failed legs: ${failedLegs.join(', ')}`)
          }
        } else {
          console.log(`✅ All ${savedLegs.length} legs saved successfully`)
        }
        
        // Track bet legs saved
        await trackEvent(
          'bet_legs_saved',
          {
            bet_id: bet.id,
            legs_count: savedLegs.length,
            expected_legs: validatedMatches.length
          },
          userId,
          traceId
        ).catch(() => {})
      } else if (bettingInfo.bet_type === 'multiple' && validatedMatches.length === 1) {
        console.warn(`⚠️ Multiple bet type but only 1 match - this should be a single bet`)
      }

      // Update message status to completed
      await supabase
        .from('message_queue')
        .update({ 
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', messageId)

      // Send confirmation message back to user
      await sendConfirmationMessage(supabase, userId, bet.id)

    } else {
      // Track bet extraction failed
      await trackEvent(
        'bet_extraction_failed',
        {
          message_id: messageId,
          reason: 'no_matches_extracted'
        },
        userId,
        traceId
      ).catch(() => {})
      
      // Update message status to failed
      await supabase
        .from('message_queue')
        .update({ 
          status: 'failed',
          error_message: 'Could not extract betting information from message'
        })
        .eq('id', messageId)

      console.log('Could not extract betting information from message:', content)
      
      // Send helpful message to user
      await sendHelpMessage(supabase, userId)
    }

  } catch (error) {
    console.error('Error processing message:', error)
    
    // Track processing error
    await trackEvent(
      'processing_error',
      {
        error_type: 'message_processing_error',
        error_message: error.message?.substring(0, 500),
        message_id: messageId
      },
      userId,
      traceId
    ).catch(() => {})
    
    // Update message status to failed
    await supabase
      .from('message_queue')
      .update({ 
        status: 'failed',
        error_message: error.message
      })
      .eq('id', messageId)
  }
}

// Extract betting information using OpenAI with structured outputs and function calling
async function extractBettingInfo(content: string, userId: string, traceId: string): Promise<ProcessedBet | null> {
  try {
    console.log('Extracting betting info from:', content)
    
    // Simplified prompt focused on business logic only
    const prompt = `Analise a seguinte mensagem e determine se é uma aposta esportiva válida. Se NÃO for uma aposta, retorne null imediatamente.

MENSAGEM: "${content}"

IMPORTANTE - VALIDAÇÃO PRÉVIA:
- Se a mensagem for apenas um cumprimento (ex: "oi", "olá", "tudo bem"), retorne null
- Se a mensagem não mencionar nenhum time/jogador/esporte, retorne null
- Se a mensagem não mencionar odds ou valores relacionados a apostas, retorne null
- Se a mensagem for muito curta e não contiver informações de aposta, retorne null
- APENAS extraia informações se for claramente uma aposta esportiva com odds, times/jogadores e tipo de aposta

INSTRUÇÕES (APENAS SE FOR UMA APOSTA VÁLIDA):
1. Identifique se é uma aposta simples, múltipla ou sistema
   - "single" = 1 única aposta
   - "multiple" = 2 ou mais apostas combinadas
   - "system" = sistema de apostas
2. Extraia TODOS os jogos/eventos mencionados
   - Cada JOGO diferente = uma entrada no array matches
   - Se múltiplos jogadores estão no MESMO JOGO e há uma "ODD COMBINADA" no topo, combine-os em UMA única entrada
   - Se jogadores estão em jogos diferentes, cada jogo = uma entrada separada
3. Para cada match, identifique: times/jogo, atletas envolvidos (se múltiplos no mesmo jogo), tipo de aposta, e a odd
4. Identifique o valor apostado (stake)
5. Identifique datas quando mencionadas

IDENTIFICAÇÃO DE TIPO DE ODDS (CRÍTICO):

CENÁRIO A: Múltiplas seções com odds já combinadas
- Se a mensagem mencionar MÚLTIPLAS "SEÇÃO" ou "CRIAR APOSTA" com odds diferentes (ex: "SEÇÃO 1: Odd 1.86", "SEÇÃO 2: Odd 4.60")
- Cada seção é uma perna com sua odd já combinada
- Marque "odds_are_individual": false
- Marque "is_combined_odd": true para cada match que tiver odd combinada

CENÁRIO B: Uma única seção com múltiplas apostas individuais
- Se houver múltiplos jogadores/atletas listados, mas cada um tem sua própria odd individual claramente mostrada
- Cada jogador/atleta deve ser uma entrada separada no array matches
- Marque "odds_are_individual": true
- Marque "is_combined_odd": false para cada match (são odds individuais)

CENÁRIO C: Múltiplos jogadores COM odd combinada mostrada (CRÍTICO)
- Se houver "CRIAR APOSTA" ou "ODD COMBINADA" no topo (ex: "CRIAR APOSTA 3.20")
- Agrupe jogadores do MESMO JOGO em UMA única perna (match)
- Use a odd combinada mostrada no topo para jogadores do mesmo jogo
- Cada JOGO diferente deve ser uma perna separada
- Exemplo: Se mostrar "CRIAR APOSTA 3.20" e listar:
  * "Keyonte George (POR vs UTA), Jrue Holiday (POR vs UTA)" → 1 match com odd 3.20
  * "D'Angelo Russell (IND vs DAL) - Odd 2.80" → 1 match com odd 2.80
  * "Dennis Schroder (SAC vs CHI) - Odd 3.20" → 1 match com odd 3.20
  Resultado: 3 matches total (não 4!)
- Se alguns jogadores têm odds individuais mostradas e outros não, use as odds individuais quando disponíveis
- Marque "odds_are_individual": true se TODAS as pernas têm odds individuais mostradas
- Marque "odds_are_individual": false se alguma perna usa a odd combinada do topo
- Marque "is_combined_odd": true para matches que usam a odd combinada, false para matches com odds individuais

CAMPOS OBRIGATÓRIOS (deve sempre preencher):
- "bet_type": sempre "single", "multiple" ou "system"
- "sport": nome do esporte (ex: "basquete", "futebol")
- "league": nome da liga ou null se não especificado
- "matches": array com pelo menos 1 match, cada match DEVE ter:
  * "description": descrição do jogo/time (obrigatório)
  * "bet_description": descrição da aposta (obrigatório)
  * "odds": número decimal da odd (obrigatório, mínimo 1.01)
  * "match_date": data do jogo em ISO string ou null
  * "is_combined_odd": true se odd já combinada, false se individual (obrigatório)
- "stake_amount": valor apostado em número (obrigatório)
- "bet_date": data da aposta em ISO string (use hoje se não especificado)
- "odds_are_individual": true se odds são individuais e precisam multiplicar, false se já combinadas (obrigatório)

IMPORTANTE - AGRUPAMENTO DE JOGADORES:
- SEMPRE agrupe jogadores do MESMO JOGO em uma única perna
- A "ODD COMBINADA" no topo (ex: "CRIAR APOSTA 3.20") se aplica aos jogadores do mesmo jogo listados juntos
- Cada JOGO diferente = uma perna diferente no array matches
- No campo "bet_description" de uma perna agrupada, liste todos os jogadores: "Keyonte George + Jrue Holiday - 7+ Assistências"
- No campo "description", use o nome do jogo: "POR Trail Blazers vs UTA Jazz"
- Use a ferramenta calculate_multiple_odds se precisar verificar o cálculo total
- Converta odds para formato decimal (1.85, 2.50, etc.)
- Converta valores monetários para número (R$ 100,00 → 100)
- Se não conseguir identificar informações suficientes para extrair pelo menos 1 match, retorne null (o sistema tratará isso)

Se NÃO for uma aposta válida, o schema não permitirá retornar - nesse caso, o sistema tratará o erro apropriadamente.`

    const messages = [{ role: 'user' as const, content: prompt }]
    const startTime = Date.now()
    
    // Make initial API call with structured outputs and tools
    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        tools: [CALCULATE_ODDS_TOOL],
        tool_choice: 'auto', // Let the model decide when to use the tool
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'betting_info',
            strict: true,
            schema: BETTING_INFO_SCHEMA
          }
        },
        max_tokens: 2000,
        temperature: 0.1
      })
    })

    const initialLatency = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      
      // Track OpenAI API error
      await trackEvent(
        'openai_api_error',
        {
          error_type: 'extract_betting_error',
          error_message: errorText.substring(0, 500),
          model: 'gpt-4o',
          operation: 'extract_betting'
        },
        userId,
        traceId
      ).catch(() => {})
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    let result = await response.json()
    let message = result.choices[0].message
    let totalLatency = initialLatency
    let totalUsage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    
    // Track initial LLM call
    const usedToolCalling = !!(message.tool_calls && message.tool_calls.length > 0)
    
    // Handle function calling if LLM used calculator tool
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('LLM used calculator tool, processing tool calls...')
      
      const toolResults: Array<{
        tool_call_id: string
        role: string
        name: string
        content: string
      }> = []
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'calculate_multiple_odds') {
          const args = JSON.parse(toolCall.function.arguments)
          const calculatedResult = await calculateMultipleOdds(args.odds)
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: 'calculate_multiple_odds',
            content: JSON.stringify({ result: calculatedResult })
          })
          console.log(`Calculator result: ${calculatedResult} for odds: ${args.odds.join(', ')}`)
        }
      }
      
      // Make follow-up call with tool results
      const followUpStartTime = Date.now()
      const followUpResponse = await fetch(`${OPENAI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            ...messages,
            message,
            ...toolResults
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'betting_info',
              strict: true,
              schema: BETTING_INFO_SCHEMA
            }
          },
          max_tokens: 2000,
          temperature: 0.1
        })
      })
      
      const followUpLatency = Date.now() - followUpStartTime
      totalLatency += followUpLatency
      
      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text()
        
        // Track follow-up error
        await trackEvent(
          'openai_api_error',
          {
            error_type: 'extract_betting_followup_error',
            error_message: errorText.substring(0, 500),
            model: 'gpt-4o',
            operation: 'extract_betting_followup'
          },
          userId,
          traceId
        ).catch(() => {})
        
        throw new Error(`OpenAI API error (follow-up): ${followUpResponse.status} - ${errorText}`)
      }
      
      result = await followUpResponse.json()
      message = result.choices[0].message
      
      // Add follow-up usage to total
      if (result.usage) {
        totalUsage = {
          prompt_tokens: totalUsage.prompt_tokens + result.usage.prompt_tokens,
          completion_tokens: totalUsage.completion_tokens + result.usage.completion_tokens,
          total_tokens: totalUsage.total_tokens + result.usage.total_tokens
        }
      }
      
      // Track follow-up LLM call
      await trackLLMGeneration(
        'extract_betting_followup',
        'gpt-4o',
        [...messages, message, ...toolResults],
        result,
        result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        followUpLatency,
        userId,
        traceId,
        {
          used_tool_calling: true,
          tool_name: 'calculate_multiple_odds'
        }
      ).catch(() => {})
    }
    
    // Track main LLM call (initial extraction)
    await trackLLMGeneration(
      'extract_betting',
      'gpt-4o',
      messages,
      result,
      totalUsage,
      totalLatency,
      userId,
      traceId,
      {
        used_tool_calling: usedToolCalling,
        tool_calls_count: message.tool_calls?.length || 0
      }
    ).catch(() => {})
    
    // With structured outputs, the content is guaranteed to be valid JSON
    const bettingInfo = JSON.parse(message.content) as ProcessedBet
    
    // Validate that we have matches
    if (!bettingInfo.matches || bettingInfo.matches.length === 0) {
      console.log('No matches extracted, returning null')
      return null
    }
    
    console.log('Betting info extracted successfully:', {
      bet_type: bettingInfo.bet_type,
      sport: bettingInfo.sport,
      matches_count: bettingInfo.matches.length,
      odds_are_individual: bettingInfo.odds_are_individual,
      stake_amount: bettingInfo.stake_amount
    })
    
    return bettingInfo

  } catch (error) {
    console.error('Error extracting betting info:', error)
    
    // Handle schema validation errors
    if (error.message && error.message.includes('schema')) {
      console.error('Schema validation error - response may not match expected format')
      
      // Track schema validation error
      await trackEvent(
        'schema_validation_error',
        {
          error_type: 'schema_validation',
          error_message: error.message.substring(0, 500),
          operation: 'extract_betting'
        },
        userId,
        traceId
      ).catch(() => {})
    } else {
      // Track other errors
      await trackEvent(
        'processing_error',
        {
          error_type: 'extract_betting_error',
          error_message: error.message?.substring(0, 500),
          operation: 'extract_betting'
        },
        userId,
        traceId
      ).catch(() => {})
    }
    
    return null
  }
}

// Send confirmation message to user
async function sendConfirmationMessage(supabase: any, userId: string, betId: string) {
  try {
    console.log('Sending confirmation message for bet:', betId)
    
    // Get user's conversation_id
    const { data: user } = await supabase
      .from('users')
      .select('conversation_id, name')
      .eq('id', userId)
      .single()

    if (!user?.conversation_id) {
      console.log('No conversation_id found for user:', userId)
      return
    }

    // Get bet details for confirmation message
    const { data: betDetails } = await supabase
      .from('bets')
      .select('bet_type, sport, match_description, bet_description, odds, stake_amount, potential_return, league')
      .eq('id', betId)
      .single()

    if (betDetails) {
      // Send message via Chatwoot API
      const chatwootBaseUrl = Deno.env.get('CHATWOOT_BASE_URL')
      const chatwootApiToken = Deno.env.get('CHATWOOT_API_ACCESS_TOKEN')
      const chatwootAccountId = Deno.env.get('CHATWOOT_ACCOUNT_ID') || '1'

      const betTypeText = {
        'single': 'Simples',
        'multiple': 'Múltipla',
        'system': 'Sistema'
      }[betDetails.bet_type] || betDetails.bet_type

      // Hardcoded dashboard URL
      const dashboardUrl = 'https://www.smartbetting.app/bets'

      const confirmationMessage = `🎯 *Aposta Registrada com Sucesso!*

📊 *Detalhes da Aposta:*
• *Tipo:* ${betTypeText}
• *Esporte:* ${betDetails.sport}${betDetails.league ? ` (${betDetails.league})` : ''}
• *Jogo:* ${betDetails.match_description}
• *Aposta:* ${betDetails.bet_description}
• *Odds:* ${betDetails.odds}
• *Valor:* R$ ${betDetails.stake_amount.toFixed(2)}
• *Retorno Potencial:* R$ ${betDetails.potential_return.toFixed(2)}

✅ Sua aposta foi salva no dashboard e você pode acompanhar o resultado em tempo real!

🔗 Acesse seu dashboard: ${dashboardUrl}

⚠️ *IMPORTANTE:*
Se você enviou uma imagem de aposta e não recebeu esta mensagem de confirmação, envie a imagem novamente.`

      if (chatwootBaseUrl && chatwootApiToken) {

        try {
          const response = await fetch(`${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${user.conversation_id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api_access_token': chatwootApiToken
            },
            body: JSON.stringify({
              content: confirmationMessage,
              message_type: 'outgoing'
            })
          })

          if (response.ok) {
            const result = await response.json()
            console.log(`✅ Confirmation message sent successfully. Message ID: ${result.id}`)
          } else {
            const errorText = await response.text()
            console.error(`❌ Failed to send confirmation message: ${response.status} - ${errorText}`)
          }
        } catch (error) {
          console.error('❌ Error sending confirmation message via Chatwoot:', error)
        }
      } else {
        console.log('Chatwoot configuration missing, skipping message send')
        console.log(`Confirmation message for ${user.name}:`, confirmationMessage)
      }
    }

  } catch (error) {
    console.error('Error sending confirmation message:', error)
  }
}

// Send help message to user when bet extraction fails
async function sendHelpMessage(supabase: any, userId: string) {
  try {
    console.log('Sending help message for user:', userId)
    
    // Get user's conversation_id
    const { data: user } = await supabase
      .from('users')
      .select('conversation_id, name')
      .eq('id', userId)
      .single()

    if (!user?.conversation_id) {
      console.log('No conversation_id found for user:', userId)
      return
    }

    const helpMessage = `🏀 *COMO ENVIAR SUAS APOSTAS NBA:*

*📸 MELHOR FORMA - Screenshot da aposta:*
• Tire print da sua aposta no site (1 aposta por print)
• Envie a imagem aqui
• Se faltar alguma info (como valor), escreva na mesma mensagem
• Exemplo: *[IMAGEM]* + "100 reais"

*✍️ OU escreva algo como:*
\`Lakers vs Warriors - LeBron 25+ pontos - Odd 1.85 - R$ 50\`

⚠️ *IMPORTANTE:*
• *1 mensagem = 1 aposta*
• Envie TUDO junto (imagem + texto na mesma mensagem)
• Se você enviou uma imagem de aposta e não recebeu uma mensagem de confirmação, envie a imagem novamente

💡 *Exemplos válidos:*
• Screenshot + "apostei 50"
• "Bucks vs Nets - Giannis 30+ pts - odd 2.0 - 100 reais"`

    // Send message via Chatwoot API
    const chatwootBaseUrl = Deno.env.get('CHATWOOT_BASE_URL')
    const chatwootApiToken = Deno.env.get('CHATWOOT_API_ACCESS_TOKEN')
    const chatwootAccountId = Deno.env.get('CHATWOOT_ACCOUNT_ID') || '1'

    if (chatwootBaseUrl && chatwootApiToken) {
      try {
        const response = await fetch(`${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${user.conversation_id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': chatwootApiToken
          },
          body: JSON.stringify({
            content: helpMessage,
            message_type: 'outgoing'
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log(`✅ Help message sent successfully. Message ID: ${result.id}`)
        } else {
          const errorText = await response.text()
          console.error(`❌ Failed to send help message: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('❌ Error sending help message via Chatwoot:', error)
      }
    } else {
      console.log('Chatwoot configuration missing, skipping help message send')
      console.log(`Help message for ${user.name}:`, helpMessage)
    }

  } catch (error) {
    console.error('Error sending help message:', error)
  }
}

// Send welcome message to user when they sync WhatsApp for the first time
async function sendWelcomeMessage(supabase: any, userId: string) {
  try {
    console.log('Sending welcome message for user:', userId)
    
    // Get user's conversation_id
    const { data: user } = await supabase
      .from('users')
      .select('conversation_id, name')
      .eq('id', userId)
      .single()

    if (!user?.conversation_id) {
      console.log('No conversation_id found for user:', userId)
      return
    }

    const welcomeMessage = `👋 *Bem-vindo ao Smartbetting!*

Sua conta WhatsApp foi sincronizada com sucesso! 🎉

Agora você pode enviar suas apostas diretamente aqui e acompanhar tudo no seu dashboard.

*📸 MELHOR FORMA - Screenshot da aposta:*
• Tire print da sua aposta no site (1 aposta por print)
• Envie a imagem aqui
• Se faltar alguma info (como valor), escreva na mesma mensagem
• Exemplo: *[IMAGEM]* + "100 reais"

*✍️ OU escreva algo como:*
\`Lakers vs Warriors - LeBron 25+ pontos - Odd 1.85 - R$ 50\`

⚠️ *IMPORTANTE:*
• *1 mensagem = 1 aposta*
• Envie TUDO junto (imagem + texto na mesma mensagem)
• Se você enviou uma imagem de aposta e não recebeu uma mensagem de confirmação, envie a imagem novamente

💡 *Exemplos válidos:*
• Screenshot + "apostei 50"
• "Bucks vs Nets - Giannis 30+ pts - odd 2.0 - 100 reais"

Vamos começar! Envie sua primeira aposta! 🚀`

    // Send message via Chatwoot API
    const chatwootBaseUrl = Deno.env.get('CHATWOOT_BASE_URL')
    const chatwootApiToken = Deno.env.get('CHATWOOT_API_ACCESS_TOKEN')
    const chatwootAccountId = Deno.env.get('CHATWOOT_ACCOUNT_ID') || '1'

    if (chatwootBaseUrl && chatwootApiToken) {
      try {
        const response = await fetch(`${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${user.conversation_id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': chatwootApiToken
          },
          body: JSON.stringify({
            content: welcomeMessage,
            message_type: 'outgoing'
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log(`✅ Welcome message sent successfully. Message ID: ${result.id}`)
        } else {
          const errorText = await response.text()
          console.error(`❌ Failed to send welcome message: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('❌ Error sending welcome message via Chatwoot:', error)
      }
    } else {
      console.log('Chatwoot configuration missing, skipping welcome message send')
      console.log(`Welcome message for ${user.name}:`, welcomeMessage)
    }

  } catch (error) {
    console.error('Error sending welcome message:', error)
  }
}

// Send paywall message when daily limit is reached
async function sendPaywallMessage(supabase: any, userId: string) {
  try {
    console.log('Sending paywall message for user:', userId)
    
    // Get user's conversation_id
    const { data: user } = await supabase
      .from('users')
      .select('conversation_id, name')
      .eq('id', userId)
      .single()

    if (!user?.conversation_id) {
      console.log('No conversation_id found for user:', userId)
      return
    }

    // Hardcoded paywall URL
    const paywallUrl = 'https://smartbetting.app/paywall'

    const paywallMessage = `🚫 *Limite Diário Atingido!*

Você atingiu o limite de ${DAILY_BET_LIMIT} apostas grátis por dia.

Para continuar apostando, acesse:
${paywallUrl}`

    // Send message via Chatwoot API
    const chatwootBaseUrl = Deno.env.get('CHATWOOT_BASE_URL')
    const chatwootApiToken = Deno.env.get('CHATWOOT_API_ACCESS_TOKEN')
    const chatwootAccountId = Deno.env.get('CHATWOOT_ACCOUNT_ID') || '1'

    if (chatwootBaseUrl && chatwootApiToken) {
      try {
        const response = await fetch(`${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${user.conversation_id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': chatwootApiToken
          },
          body: JSON.stringify({
            content: paywallMessage,
            message_type: 'outgoing'
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log(`✅ Paywall message sent successfully. Message ID: ${result.id}`)
        } else {
          const errorText = await response.text()
          console.error(`❌ Failed to send paywall message: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('❌ Error sending paywall message via Chatwoot:', error)
      }
    } else {
      console.log('Chatwoot configuration missing, skipping paywall message send')
      console.log(`Paywall message for ${user.name}:`, paywallMessage)
    }

  } catch (error) {
    console.error('Error sending paywall message:', error)
  }
}

