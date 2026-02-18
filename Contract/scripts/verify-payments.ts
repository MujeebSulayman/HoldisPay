import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PaymentDeploymentData {
  network: string;
  chainId: number;
  library: string;
  core: { implementation: string; proxy: string };
  milestones: { implementation: string; proxy: string };
  team: { implementation: string; proxy: string };
  disputes: { implementation: string; proxy: string };
  adminAddress: string;
  feeCollector: string;
  deployer: string;
  timestamp: string;
  blockNumber: string;
}

async function verifyContract(
  name: string,
  address: string,
  networkName: string,
  constructorArgs: string[] = []
) {
  console.log(`\n🔍 Verifying ${name} on Etherscan...`);
  try {
    const argsString = constructorArgs.length > 0 ? ` ${constructorArgs.join(' ')}` : '';
    const cmd = `npx hardhat verify etherscan --network ${networkName} --build-profile default ${address}${argsString}`;

    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr && !stderr.includes('Already Verified')) {
      console.error(stderr);
    }
    
    if (stdout.includes('Already Verified') || stdout.includes('already been verified')) {
      console.log(`✅ ${name} already verified on BaseScan`);
    } else if (stdout.includes('Successfully verified')) {
      console.log(`✅ ${name} verified successfully on BaseScan`);
    } else {
      console.log(stdout);
    }
  } catch (error: any) {
    const output = error.stdout || error.message || '';
    if (output.includes('Already Verified') || output.includes('already been verified')) {
      console.log(`✅ ${name} already verified on BaseScan`);
    } else {
      console.error(`❌ ${name} verification failed:`, error.message);
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('   HoldisPayments Etherscan V2 Verification');
  console.log('═══════════════════════════════════════════════\n');

  try {
    const networkName = process.env.HARDHAT_NETWORK || 'sepoliaBase';
    const deploymentPath = join(process.cwd(), 'deployments', `${networkName}-payments.json`);

    let deploymentData: PaymentDeploymentData;
    try {
      const data = readFileSync(deploymentPath, 'utf8');
      deploymentData = JSON.parse(data);
    } catch (error) {
      console.error(`❌ No deployment file found for network: ${networkName}`);
      console.error(`Expected file: ${deploymentPath}`);
      console.error('\nDeploy contracts first using:');
      console.error(`npx hardhat run scripts/deploy-payments.ts --network ${networkName}`);
      process.exit(1);
    }

    console.log('📋 Deployment Info:');
    console.log('Network:', deploymentData.network);
    console.log('Chain ID:', deploymentData.chainId);
    console.log('Admin:', deploymentData.adminAddress);
    console.log('Fee Collector:', deploymentData.feeCollector);

    await verifyContract('PaymentLibrary', deploymentData.library, networkName);

    await verifyContract('HoldisPaymentsCore Implementation', deploymentData.core.implementation, networkName);

    await verifyContract(
      'HoldisPaymentsCore Proxy',
      deploymentData.core.proxy,
      networkName,
      [deploymentData.core.implementation, '0x']
    );

    await verifyContract('HoldisMilestones Implementation', deploymentData.milestones.implementation, networkName);

    await verifyContract(
      'HoldisMilestones Proxy',
      deploymentData.milestones.proxy,
      networkName,
      [deploymentData.milestones.implementation, '0x']
    );

    await verifyContract('HoldisTeam Implementation', deploymentData.team.implementation, networkName);

    await verifyContract(
      'HoldisTeam Proxy',
      deploymentData.team.proxy,
      networkName,
      [deploymentData.team.implementation, '0x']
    );

    await verifyContract('HoldisDisputes Implementation', deploymentData.disputes.implementation, networkName);

    await verifyContract(
      'HoldisDisputes Proxy',
      deploymentData.disputes.proxy,
      networkName,
      [deploymentData.disputes.implementation, '0x']
    );

    const explorerUrl = networkName === 'sepoliaBase' ? 'https://sepolia.basescan.org' : 'https://basescan.org';

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   VERIFICATION COMPLETE                ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('\n🔗 View Contracts on BaseScan:');
    console.log('\n🏦 Core Payment Contract:');
    console.log(`${explorerUrl}/address/${deploymentData.core.proxy}#code`);
    console.log('\n🎯 Milestones Module:');
    console.log(`${explorerUrl}/address/${deploymentData.milestones.proxy}#code`);
    console.log('\n👥 Team Module:');
    console.log(`${explorerUrl}/address/${deploymentData.team.proxy}#code`);
    console.log('\n⚖️  Disputes Module:');
    console.log(`${explorerUrl}/address/${deploymentData.disputes.proxy}#code`);

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message || error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
