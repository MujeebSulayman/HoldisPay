import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { formatEther, encodeFunctionData } from 'viem';
import hre from 'hardhat';

interface PaymentDeploymentData {
  network: string;
  chainId: number;
  invoice: {
    implementation: string;
    proxy: string;
  };
  library: string;
  core: {
    implementation: string;
    proxy: string;
  };
  milestones: {
    implementation: string;
    proxy: string;
  };
  team: {
    implementation: string;
    proxy: string;
  };
  disputes: {
    implementation: string;
    proxy: string;
  };
  adminAddress: string;
  feeCollector: string;
  deployer: string;
  timestamp: string;
  blockNumber: string;
}

async function main() {
  console.log('Starting Holdis Complete Platform Deployment (Invoice + Payment Contracts)');

  try {
    const { viem } = await hre.network.connect();
    
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();
    
    const networkMap: Record<number, string> = {
      31337: 'hardhat',
      84532: 'sepoliaBase',
      8453: 'base',
    };
    const networkName = networkMap[chainId] || `unknown-${chainId}`;
    
    if (chainId === 31337) {
      console.log('\nWARNING: Connected to local Hardhat network!');
    }

    console.log('\nDeployment Configuration:');
    console.log('Deployer:', deployer.account.address);
    console.log('Network:', networkName);
    console.log('Chain ID:', chainId);

    const balance = await publicClient.getBalance({
      address: deployer.account.address,
    });
    console.log('Balance:', formatEther(balance), 'ETH');

    const deploymentsDir = join(process.cwd(), 'deployments');
    const deploymentPath = join(deploymentsDir, `${networkName}-payments.json`);

    if (!existsSync(deploymentsDir)) {
      mkdirSync(deploymentsDir, { recursive: true });
    }

    const feeCollector = deployer.account.address;

    console.log('\n=== Step 1: Deploy Holdis Invoice Contract ===');
    const holdisImpl = await viem.deployContract('Holdis', []);
    console.log('Holdis Implementation:', holdisImpl.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const holdisArtifact = await hre.artifacts.readArtifact('Holdis');
    const holdisInitData = encodeFunctionData({
      abi: holdisArtifact.abi,
      functionName: 'initialize',
      args: [deployer.account.address],
    });

    const holdisProxy = await viem.deployContract('HoldisProxy', [
      holdisImpl.address,
      holdisInitData,
    ]);
    console.log('Holdis Proxy:', holdisProxy.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n=== Step 2: Deploy PaymentLibrary ===');
    const library = await viem.deployContract('PaymentLibrary', []);
    console.log('PaymentLibrary deployed to:', library.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n=== Step 3: Deploy HoldisPaymentsCore ===');
    const coreImpl = await viem.deployContract('HoldisPaymentsCore', []);
    console.log('Core Implementation:', coreImpl.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const coreArtifact = await hre.artifacts.readArtifact('HoldisPaymentsCore');
    const coreInitData = encodeFunctionData({
      abi: coreArtifact.abi,
      functionName: 'initialize',
      args: [deployer.account.address, feeCollector],
    });

    const coreProxy = await viem.deployContract('HoldisProxy', [
      coreImpl.address,
      coreInitData,
    ]);
    console.log('Core Proxy:', coreProxy.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n=== Step 4: Deploy HoldisMilestones ===');
    const milestonesImpl = await viem.deployContract('HoldisMilestones', []);
    console.log('Milestones Implementation:', milestonesImpl.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const milestonesArtifact = await hre.artifacts.readArtifact('HoldisMilestones');
    const milestonesInitData = encodeFunctionData({
      abi: milestonesArtifact.abi,
      functionName: 'initialize',
      args: [deployer.account.address, coreProxy.address],
    });

    const milestonesProxy = await viem.deployContract('HoldisProxy', [
      milestonesImpl.address,
      milestonesInitData,
    ]);
    console.log('Milestones Proxy:', milestonesProxy.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n=== Step 5: Deploy HoldisTeam ===');
    const teamImpl = await viem.deployContract('HoldisTeam', []);
    console.log('Team Implementation:', teamImpl.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const teamArtifact = await hre.artifacts.readArtifact('HoldisTeam');
    const teamInitData = encodeFunctionData({
      abi: teamArtifact.abi,
      functionName: 'initialize',
      args: [deployer.account.address, coreProxy.address],
    });

    const teamProxy = await viem.deployContract('HoldisProxy', [
      teamImpl.address,
      teamInitData,
    ]);
    console.log('Team Proxy:', teamProxy.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n=== Step 6: Deploy HoldisDisputes ===');
    const disputesImpl = await viem.deployContract('HoldisDisputes', []);
    console.log('Disputes Implementation:', disputesImpl.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const disputesArtifact = await hre.artifacts.readArtifact('HoldisDisputes');
    const disputesInitData = encodeFunctionData({
      abi: disputesArtifact.abi,
      functionName: 'initialize',
      args: [deployer.account.address, coreProxy.address],
    });

    const disputesProxy = await viem.deployContract('HoldisProxy', [
      disputesImpl.address,
      disputesInitData,
    ]);
    console.log('Disputes Proxy:', disputesProxy.address);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\n=== Step 7: Link Modules to Core ===');
    const coreContract = await viem.getContractAt(
      'HoldisPaymentsCore',
      coreProxy.address
    );

    const setModulesTx = await coreContract.write.setModules([
      milestonesProxy.address,
      teamProxy.address,
      disputesProxy.address,
    ]);
    console.log('Modules linked! Tx:', setModulesTx);
    await publicClient.waitForTransactionReceipt({ hash: setModulesTx });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const block = await publicClient.getBlock();

    const deploymentData: PaymentDeploymentData = {
      network: networkName,
      chainId: Number(chainId),
      invoice: {
        implementation: holdisImpl.address,
        proxy: holdisProxy.address,
      },
      library: library.address,
      core: {
        implementation: coreImpl.address,
        proxy: coreProxy.address,
      },
      milestones: {
        implementation: milestonesImpl.address,
        proxy: milestonesProxy.address,
      },
      team: {
        implementation: teamImpl.address,
        proxy: teamProxy.address,
      },
      disputes: {
        implementation: disputesImpl.address,
        proxy: disputesProxy.address,
      },
      adminAddress: deployer.account.address,
      feeCollector: feeCollector,
      deployer: deployer.account.address,
      timestamp: new Date().toISOString(),
      blockNumber: block.number.toString(),
    };

    writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    console.log('\n✅ Deployment data saved to:', deploymentPath);

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   DEPLOYMENT COMPLETE                  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('\n📋 Contract Details:');
    console.log('Network:', deploymentData.network);
    console.log('Chain ID:', deploymentData.chainId);
    console.log('\n📄 Invoice Contract:');
    console.log('Proxy:', deploymentData.invoice.proxy);
    console.log('Implementation:', deploymentData.invoice.implementation);
    console.log('\n📚 Library:');
    console.log('PaymentLibrary:', deploymentData.library);
    console.log('\n🏦 Core Payment Contract:');
    console.log('Proxy:', deploymentData.core.proxy);
    console.log('Implementation:', deploymentData.core.implementation);
    console.log('\n🎯 Milestones Module:');
    console.log('Proxy:', deploymentData.milestones.proxy);
    console.log('Implementation:', deploymentData.milestones.implementation);
    console.log('\n👥 Team Module:');
    console.log('Proxy:', deploymentData.team.proxy);
    console.log('Implementation:', deploymentData.team.implementation);
    console.log('\n⚖️  Disputes Module:');
    console.log('Proxy:', deploymentData.disputes.proxy);
    console.log('Implementation:', deploymentData.disputes.implementation);
    console.log('\n👤 Admin:', deploymentData.adminAddress);
    console.log('💰 Fee Collector:', deploymentData.feeCollector);
    console.log('📦 Block:', deploymentData.blockNumber);
    console.log('⏰ Timestamp:', deploymentData.timestamp);

    const explorerUrl = networkName === 'sepoliaBase'
      ? `https://sepolia.basescan.org/address/${coreProxy.address}`
      : networkName === 'base'
      ? `https://basescan.org/address/${coreProxy.address}`
      : '';

    if (explorerUrl) {
      console.log('\n🔍 Explorer:', explorerUrl);
    }
    console.log('\n💡 Main Contract Address (use this):', coreProxy.address);

    return deploymentData;
  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
