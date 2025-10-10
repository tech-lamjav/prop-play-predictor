// Test script for WhatsApp integration
const testMessage = {
  conversation_id: "test-conversation-123",
  message_type: "text",
  content: "Aposta: Manchester United vs Liverpool - Over 2.5 gols - Odds: 1.85 - Valor: R$ 50,00",
  timestamp: new Date().toISOString(),
  sender: {
    phone_number: "+5511952132563",
    name: "João Teste"
  }
};

console.log('Testing WhatsApp integration with message:');
console.log(JSON.stringify(testMessage, null, 2));

// You can test this by sending a POST request to your webhook URL
// Replace with your actual webhook URL from Supabase
const webhookUrl = 'https://your-project-ref.supabase.co/functions/v1/whatsapp-webhook';

console.log('\nTo test, send a POST request to:');
console.log(webhookUrl);
console.log('\nWith headers:');
console.log('Content-Type: application/json');
console.log('Authorization: Bearer YOUR_ANON_KEY');
console.log('\nAnd body:');
console.log(JSON.stringify(testMessage, null, 2));
