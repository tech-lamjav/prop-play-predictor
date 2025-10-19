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

    // Extract conversation_id from Chatwoot payload
    const conversationId = payload.conversation?.id?.toString() || payload.conversation_id
    const phoneNumber = payload.sender?.phone_number
    const content = payload.content
    const contentType = payload.content_type || 'text'
    const messageType = payload.message_type || 'incoming'
    const attachments = payload.attachments || []
    
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
    
    if (hasImageAttachment && !content) {
      actualContentType = 'image'
      mediaUrl = attachments.find(att => att.file_type === 'image')?.data_url
    } else if (hasAudioAttachment && !content) {
      actualContentType = 'audio'
      mediaUrl = attachments.find(att => att.file_type === 'audio')?.data_url
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
    let processedMessageType = actualContentType

    if (actualContentType === 'audio' && mediaUrl) {
      // Transcribe audio using OpenAI Whisper
      processedContent = await transcribeAudio(mediaUrl)
      processedMessageType = 'text' // Treat as text after transcription
    } else if (actualContentType === 'image' && mediaUrl) {
      // Process image using OpenAI Vision
      processedContent = await processImage(mediaUrl)
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
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise esta imagem de aposta esportiva e extraia TODAS as informações possíveis em português. Identifique: times/atletas, tipo de aposta, odds, valor apostado, esporte, liga/campeonato. Retorne apenas o texto estruturado da aposta, sem explicações adicionais.'
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
    
    if (bettingInfo && bettingInfo.matches && bettingInfo.matches.length > 0) {
      // Calculate total odds for multiple bets
      const totalOdds = bettingInfo.matches.reduce((acc, match) => acc * (match.odds || 1), 1)
      
      // Save main bet to database
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: userId,
          bet_type: bettingInfo.bet_type,
          sport: bettingInfo.sport,
          league: bettingInfo.league || null,
          match_description: bettingInfo.matches.length === 1 
            ? bettingInfo.matches[0]?.description 
            : `${bettingInfo.matches.length} jogos múltiplos`,
          bet_description: bettingInfo.matches.length === 1 
            ? bettingInfo.matches[0]?.bet_description 
            : `Aposta múltipla com ${bettingInfo.matches.length} seleções`,
          odds: bettingInfo.bet_type === 'multiple' ? totalOdds : bettingInfo.matches[0]?.odds,
          stake_amount: bettingInfo.stake_amount,
          potential_return: bettingInfo.stake_amount * (bettingInfo.bet_type === 'multiple' ? totalOdds : bettingInfo.matches[0]?.odds),
          bet_date: bettingInfo.bet_date || new Date().toISOString(),
          match_date: bettingInfo.matches[0]?.match_date || null,
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

      // Save individual bet legs for multiple bets
      if (bettingInfo.bet_type === 'multiple' && bettingInfo.matches.length > 1) {
        for (let i = 0; i < bettingInfo.matches.length; i++) {
          const match = bettingInfo.matches[i]
          const { error: legError } = await supabase
            .from('bet_legs')
            .insert({
              bet_id: bet.id,
              leg_number: i + 1,
              sport: bettingInfo.sport,
              match_description: match.description,
              bet_description: match.bet_description,
              odds: match.odds,
              status: 'pending'
            })

          if (legError) {
            console.error('Error saving bet leg:', legError)
            // Don't throw here, just log the error
          }
        }
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
Analise a seguinte mensagem de aposta e extraia TODAS as informações possíveis em formato JSON.

MENSAGEM: "${content}"

INSTRUÇÕES IMPORTANTES:
1. Identifique se é uma aposta simples, múltipla ou sistema
2. Extraia TODOS os jogos/eventos mencionados
3. Para cada jogo, identifique: times/atletas, tipo de aposta, odds
4. Identifique o valor apostado (stake)
5. Identifique datas quando mencionadas
6. Seja flexível com formatos de odds (1.85, 2/1, +150, etc.)
7. Seja flexível com valores (R$ 100, 100 reais, $50, etc.)

FORMATO DE RESPOSTA (JSON APENAS):
{
  "bet_type": "single|multiple|system",
  "sport": "string (futebol, basquete, tênis, futebol americano, etc.)",
  "league": "string (Premier League, NBA, Champions League, etc.) ou null",
  "matches": [
    {
      "description": "string (ex: Manchester United vs Liverpool)",
      "bet_description": "string (ex: Over 2.5 gols, Vitória do Manchester, etc.)",
      "odds": number (converta para decimal: 1.85, 2.50, etc.),
      "match_date": "string ISO (2024-01-15T20:00:00Z) ou null"
    }
  ],
  "stake_amount": number (valor apostado em decimal),
  "bet_date": "string ISO (data da aposta, use hoje se não especificada)"
}

EXEMPLOS DE CONVERSÃO DE ODDS:
- 1.85 → 1.85
- 2/1 → 3.00
- +150 → 2.50
- 3.5 → 3.50

EXEMPLOS DE CONVERSÃO DE VALORES:
- "R$ 100" → 100
- "100 reais" → 100
- "$50" → 50
- "50 dólares" → 50

Se NÃO for uma aposta ou não conseguir extrair informações suficientes, retorne null.

IMPORTANTE: Retorne APENAS o JSON válido, sem texto adicional, explicações ou formatação markdown.
`

    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
    
    console.log('Raw OpenAI response:', extractedText)
    
    // Try to parse the JSON response
    if (extractedText === 'null' || extractedText === 'null.') {
      return null
    }

    // Try to extract JSON from the response if it's not pure JSON
    let jsonText = extractedText
    if (extractedText.includes('{') && extractedText.includes('}')) {
      const jsonStart = extractedText.indexOf('{')
      const jsonEnd = extractedText.lastIndexOf('}') + 1
      jsonText = extractedText.substring(jsonStart, jsonEnd)
    }

    console.log('Extracted JSON text:', jsonText)

    try {
      const bettingInfo = JSON.parse(jsonText)
      console.log('Betting info extracted successfully:', {
        bet_type: bettingInfo.bet_type,
        sport: bettingInfo.sport,
        matches_count: bettingInfo.matches?.length || 0,
        stake_amount: bettingInfo.stake_amount,
        total_odds: bettingInfo.matches?.reduce((acc, match) => acc * (match.odds || 1), 1) || 0
      })
      return bettingInfo
    } catch (parseError) {
      console.error('Error parsing JSON from OpenAI response:', parseError)
      console.error('Failed to parse text:', jsonText)
      return null
    }

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

      if (chatwootBaseUrl && chatwootApiToken) {
        const betTypeText = {
          'single': 'Simples',
          'multiple': 'Múltipla',
          'system': 'Sistema'
        }[betDetails.bet_type] || betDetails.bet_type

        const confirmationMessage = `🎯 *Aposta Registrada com Sucesso!*

📊 *Detalhes da Aposta:*
• *Tipo:* ${betTypeText}
• *Esporte:* ${betDetails.sport}${betDetails.league ? ` (${betDetails.league})` : ''}
• *Jogo:* ${betDetails.match_description}
• *Aposta:* ${betDetails.bet_description}
• *Odds:* ${betDetails.odds}
• *Valor:* R$ ${betDetails.stake_amount.toFixed(2)}
• *Retorno Potencial:* R$ ${betDetails.potential_return.toFixed(2)}

🆔 *ID:* \`${betId}\`

✅ Sua aposta foi salva no dashboard e você pode acompanhar o resultado em tempo real!`

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

    const helpMessage = `❓ *Não consegui identificar uma aposta na sua mensagem.*

📝 *Para registrar uma aposta, envie uma mensagem no formato:*

*🎯 Aposta Simples:*
\`Manchester United vs Liverpool - Over 2.5 gols - Odds 1.85 - R$ 100\`

*🎯 Aposta Múltipla:*
\`Manchester vs Liverpool - Over 2.5 gols - 1.85
Barcelona vs Real Madrid - Vitória do Barcelona - 2.10
R$ 50\`

*📱 Você também pode enviar:*
• 📸 Fotos de apostas
• 🎤 Mensagens de voz
• 📱 Screenshots de sites de apostas

💡 *Dica:* Seja específico com times, odds e valores!

*🔍 Exemplo de mensagem válida:*
\`Apostei R$ 50 no Real Madrid ganhar contra o Barcelona, odds 2.10\``

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
