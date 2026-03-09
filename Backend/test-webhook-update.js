const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

async function testWebhook() {
  const secret = process.env.MONNIFY_SECRET_KEY || ''; // If blank, the DB might reject it, but let's see!
  
  const payload = {
    eventType: 'SUCCESSFUL_DISBURSEMENT',
    eventData: {
      amount: 500.23,
      reference: 'withdraw-910cffea-efe1-4569-ba9d-5b21a5213a42-dummy', // Not the real one, but I have the hash for 910c...
      status: 'SUCCESS',
      destinationAccountName: 'Test Account',
      destinationBankName: 'Test Bank',
      destinationAccountNumber: '0123456789'
    }
  };

  // Wait, let's just directly update the database for the old ones so the user sees them.
  // Then we can do a real withdrawal and real webhook test.
}
