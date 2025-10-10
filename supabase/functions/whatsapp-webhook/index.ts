import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OpenAI API configuration
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1'

interface WhatsAppMessage {
  conversation_id?: string
  message_type?: 'text' | 'audio' | 'image'
  content?: string
  media_url?: string
  timestamp?: string
  sender?: {
    phone_number: string
    name?: string
  }
  // Chatroot specific fields
  conversation?: {
    id: number
  }
  sender?: {
    phone_number: string
    name?: string
  }
  content?: string
  content_type?: string
  message_type?: string
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
  }>
  stake_amount: number
  bet_date: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('WhatsApp webhook received:', new Date().toISOString())
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the incoming message
    const payload = await req.json()
    console.log('Received payload:', JSON.stringify(payload, null, 2))

    // Extract conversation_id from Chatroot payload
    const conversationId = payload.conversation?.id?.toString() || payload.conversation_id
    const phoneNumber = payload.sender?.phone_number
    const content = payload.content
    const contentType = payload.content_type || 'text'

    console.log('Extracted data:', {
      conversationId,
      phoneNumber,
      content,
      contentType
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
        const cleanPhone = phoneNumber.replace(/\D/g, '')
        console.log('Looking for user with phone:', cleanPhone)
        
        const { data: syncUser, error: syncError } = await supabase
          .from('users')
          .select('id, whatsapp_number, name')
          .eq('whatsapp_number', cleanPhone)
          .single()

        if (syncUser && !syncError) {
          console.log('Found user by phone, syncing conversation_id')
          
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
          console.log('No user found with phone number:', cleanPhone)
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

    // Handle different message types
    let processedContent = ''
    let messageType = contentType

    if (contentType === 'audio' && payload.media_url) {
      // Transcribe audio using OpenAI Whisper
      processedContent = await transcribeAudio(payload.media_url)
      messageType = 'text' // Treat as text after transcription
    } else if (contentType === 'image' && payload.media_url) {
      // Process image using OpenAI Vision
      processedContent = await processImage(payload.media_url)
      messageType = 'text' // Treat as text after processing
    } else if (contentType === 'text' && content) {
      processedContent = content
    }

    // Add message to queue for processing
    const { data: queueMessage, error: queueError } = await supabase
      .from('message_queue')
      .insert({
        user_id: user.id,
        message_type: messageType,
        content: processedContent,
        media_url: payload.media_url,
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
    await processMessage(supabase, queueMessage.id, processedContent, user.id)

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
async function transcribeAudio(audioUrl: string): Promise<string> {
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

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Audio transcribed successfully')
    return result.text
  } catch (error) {
    console.error('Error transcribing audio:', error)
    throw new Error(`Failed to transcribe audio: ${error.message}`)
  }
}

// Process image using OpenAI Vision
async function processImage(imageUrl: string): Promise<string> {
  try {
    console.log('Processing image:', imageUrl)
    
    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise esta imagem de aposta e extraia as informações em português. Retorne apenas o texto da aposta, sem explicações adicionais.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }],
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Image processed successfully')
    return result.choices[0].message.content
  } catch (error) {
    console.error('Error processing image:', error)
    throw new Error(`Failed to process image: ${error.message}`)
  }
}

// Process message and extract betting information
async function processMessage(supabase: any, messageId: string, content: string, userId: string) {
  try {
    console.log('Processing message:', messageId)
    
    // Update message status to processing
    await supabase
      .from('message_queue')
      .update({ status: 'processing' })
      .eq('id', messageId)

    // Use OpenAI to extract betting information
    const bettingInfo = await extractBettingInfo(content)
    
    if (bettingInfo) {
      // Save bet to database
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: userId,
          bet_type: bettingInfo.bet_type,
          sport: bettingInfo.sport,
          league: bettingInfo.league,
          match_description: bettingInfo.matches[0]?.description,
          bet_description: bettingInfo.matches[0]?.bet_description,
          odds: bettingInfo.matches[0]?.odds,
          stake_amount: bettingInfo.stake_amount,
          potential_return: bettingInfo.stake_amount * bettingInfo.matches[0]?.odds,
          bet_date: bettingInfo.bet_date,
          match_date: bettingInfo.matches[0]?.match_date,
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
      // Update message status to failed
      await supabase
        .from('message_queue')
        .update({ 
          status: 'failed',
          error_message: 'Could not extract betting information'
        })
        .eq('id', messageId)
    }

  } catch (error) {
    console.error('Error processing message:', error)
    
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

// Extract betting information using OpenAI
async function extractBettingInfo(content: string): Promise<ProcessedBet | null> {
  try {
    console.log('Extracting betting info from:', content)
    
    const prompt = `
Analise a seguinte mensagem de aposta e extraia as informações em formato JSON:

"${content}"

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "bet_type": "single|multiple|system",
  "sport": "string (ex: futebol, basquete, tênis)",
  "league": "string (opcional, ex: Premier League, NBA)",
  "matches": [
    {
      "description": "string (ex: Manchester United vs Liverpool)",
      "bet_description": "string (ex: Over 2.5 gols)",
      "odds": number (ex: 1.85),
      "match_date": "string ISO (opcional)"
    }
  ],
  "stake_amount": number (valor apostado),
  "bet_date": "string ISO (data da aposta)"
}

Se não conseguir extrair informações de aposta, retorne null.
`

    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    const extractedText = result.choices[0].message.content.trim()
    
    // Try to parse the JSON response
    if (extractedText === 'null' || extractedText === 'null.') {
      return null
    }

    const bettingInfo = JSON.parse(extractedText)
    console.log('Betting info extracted:', bettingInfo)
    return bettingInfo

  } catch (error) {
    console.error('Error extracting betting info:', error)
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

    // In a real implementation, you would send this via Chatroot API
    // For now, we'll just log it
    console.log(`Confirmation message for ${user.name}: Aposta registrada com sucesso! ID: ${betId}`)
    
    // TODO: Implement actual message sending via Chatroot API
    // const chatrootResponse = await fetch('https://api.chatroot.com/send-message', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${CHATROOT_API_KEY}` },
    //   body: JSON.stringify({
    //     conversation_id: user.conversation_id,
    //     message: `Aposta registrada com sucesso! ID: ${betId}`
    //   })
    // })

  } catch (error) {
    console.error('Error sending confirmation message:', error)
  }
}
