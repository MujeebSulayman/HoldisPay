import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('Syncing contract addresses to Backend .env...\n');

  const networkName = process.env.HARDHAT_NETWORK || 'sepoliaBase';
  const deploymentPath = join(process.cwd(), 'deployments', `${networkName}-payments.json`);
  const backendEnvPath = join(process.cwd(), '..', 'Backend', '.env');

  try {
    // Read deployment data
    const deploymentData = JSON.parse(readFileSync(deploymentPath, 'utf8'));
    
    console.log('📋 Deployment Data:');
    console.log(`Network: ${deploymentData.network}`);
    console.log(`Chain ID: ${deploymentData.chainId}`);
    console.log(`Invoice Proxy: ${deploymentData.invoice.proxy}`);
    console.log(`Core Proxy: ${deploymentData.core.proxy}`);
    console.log(`Milestones Proxy: ${deploymentData.milestones.proxy}`);
    console.log(`Team Proxy: ${deploymentData.team.proxy}`);
    console.log(`Disputes Proxy: ${deploymentData.disputes.proxy}\n`);

    // Read current .env file
    let envContent = '';
    try {
      envContent = readFileSync(backendEnvPath, 'utf8');
    } catch (error) {
      console.log('⚠️  .env file not found in Backend, creating from .env.example...');
      try {
        envContent = readFileSync(join(process.cwd(), '..', 'Backend', '.env.example'), 'utf8');
      } catch (err) {
        console.error('❌ Neither .env nor .env.example found in Backend folder');
        process.exit(1);
      }
    }

    // Update contract addresses
    const updates = [
      { key: 'HOLDIS_CONTRACT_ADDRESS', value: deploymentData.invoice.proxy },
      { key: 'HOLDIS_PAYMENTS_CORE_ADDRESS', value: deploymentData.core.proxy },
      { key: 'HOLDIS_MILESTONES_ADDRESS', value: deploymentData.milestones.proxy },
      { key: 'HOLDIS_TEAM_ADDRESS', value: deploymentData.team.proxy },
      { key: 'HOLDIS_DISPUTES_ADDRESS', value: deploymentData.disputes.proxy },
      { key: 'CHAIN_ID', value: deploymentData.chainId.toString() },
    ];

    for (const { key, value } of updates) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
        console.log(`✅ Updated ${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
        console.log(`✅ Added ${key}=${value}`);
      }
    }

    // Write updated .env file
    writeFileSync(backendEnvPath, envContent);

    console.log('\n✅ Contract addresses synced successfully to Backend/.env');
    console.log(`\nℹ️  Make sure to restart your backend server to load the new addresses.`);
    
  } catch (error: any) {
    console.error('\n❌ Failed to sync addresses:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
