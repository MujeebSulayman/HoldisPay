const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

async function testWebhook() {
  const secret = process.env.MONNIFY_SECRET_KEY || 'dummy_secret';
  
  const payload = {
    eventType: 'SUCCESSFUL_DISBURSEMENT',
    eventData: {
      amount: 500.23,
      reference: 'withdraw-ab15969c-4b10-4aa8-842c-8a02af945e26-1741534066060', // get a real one next
      status: 'SUCCESS',
      destinationAccountName: 'Test Account',
      destinationBankName: 'Test Bank',
      destinationAccountNumber: '0123456789'
    }
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto.createHmac('sha512', secret).update(payloadString).digest('hex');

  try {
    const res = await axios.post('http://localhost:3001/api/webhooks/monnify', payload, {
      headers: {
        'monnify-signature': signature,
        'Content-Type': 'application/json'
      }
    });
    console.log('Webhook Response:', res.status, res.data);
  } catch (error) {
    console.error('Webhook Error:', error.response?.data || error.message);
  }
}

testWebhook();
