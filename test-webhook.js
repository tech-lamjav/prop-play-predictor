// Script para testar a Edge Function do WhatsApp webhook
// Execute com: node test-webhook.js

const testMessages = [
  {
    // Teste de sincronização
    conversation_id: "test-conversation-123",
    message_type: "text",
    content: "Oi, gostaria de sincronizar minha conta Smart In Bet",
    sender: {
      phone_number: "5511999999999",
      name: "João"
    }
  },
  {
    // Teste de aposta simples
    conversation_id: "test-conversation-123",
    message_type: "text",
    content: "Apostei R$ 100 no Manchester United vs Liverpool, Over 2.5 gols, odds 1.85"
  },
  {
    // Teste de aposta múltipla
    conversation_id: "test-conversation-123",
    message_type: "text",
    content: "Aposta múltipla: R$ 50 - Real Madrid ganhar (1.50) + Barcelona ganhar (1.80) + PSG ganhar (1.60)"
  },
  {
    // Teste de áudio (simulado)
    conversation_id: "test-conversation-123",
    message_type: "audio",
    media_url: "https://example.com/audio.mp3"
  },
  {
    // Teste de imagem (simulado)
    conversation_id: "test-conversation-123",
    message_type: "image",
    media_url: "https://example.com/bet-screenshot.jpg"
  }
];

async function testWebhook() {
  const webhookUrl = 'http://localhost:54321/functions/v1/whatsapp-webhook';
  
  console.log('🧪 Testando WhatsApp Webhook...\n');
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`📨 Teste ${i + 1}: ${message.message_type} - ${message.content || 'Mídia'}`);
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Sucesso:`, result);
      } else {
        console.log(`❌ Erro:`, result);
      }
      
    } catch (error) {
      console.log(`💥 Exceção:`, error.message);
    }
    
    console.log('---\n');
    
    // Aguardar 1 segundo entre testes
    await new Promise(resolve => setTimeout(resolve, 1000)));
  }
  
  console.log('🏁 Testes concluídos!');
}

// Executar testes
testWebhook().catch(console.error);
