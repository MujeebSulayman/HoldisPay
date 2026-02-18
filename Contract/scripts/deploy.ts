import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { formatEther, encodeFunctionData } from 'viem';
import hre from 'hardhat';

interface DeploymentData {
  network: string;
  chainId: number;
  implementation: string;
  proxy: string;
  adminAddress: string;
  deployer: string;
  timestamp: string;
  blockNumber: string;
}

async function main() {
  console.log('Starting Holdis Proxy Deployment');

  try {
    const { viem } = await hre.network.connect();
    
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();
    
    // Map chain ID to network name
    const networkMap: Record<number, string> = {
      31337: 'hardhat',
      84532: 'sepoliaBase',
      8453: 'base',
    };
    const networkName = networkMap[chainId] || `unknown-${chainId}`;
    
    // Safety check: if connected to wrong network
    if (chainId === 31337) {
      console.log('\nWARNING: Connected to local Hardhat network!');
      console.log('If you intended to deploy to a testnet/mainnet:');
      console.log('1. Check your .env file has correct RPC_URL and PRIVATE_KEY');
      console.log('2. Verify your RPC endpoint is working');
      console.log('3. Ensure your private key is valid');
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
    const deploymentPath = join(deploymentsDir, `${networkName}.json`);

    if (!existsSync(deploymentsDir)) {
      mkdirSync(deploymentsDir, { recursive: true });
    }

    // Step 1: Deploy implementation
    console.log('\nDeploying Holdis implementation...');
    const implementation = await viem.deployContract('Holdis', []);
    console.log('Implementation deployed to:', implementation.address);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 2: Deploy ERC1967Proxy with initialization data
    console.log('\nDeploying ERC1967 Proxy...');
    
    // Get the Holdis ABI to encode initialize call
    const holdisArtifact = await hre.artifacts.readArtifact('Holdis');
    const initializeData = encodeFunctionData({
      abi: holdisArtifact.abi,
      functionName: 'initialize',
      args: [deployer.account.address],
    });

    // Deploy HoldisProxy (ERC1967Proxy wrapper)
    const proxy = await viem.deployContract('HoldisProxy', [
      implementation.address,
      initializeData,
    ]);

    console.log('Proxy deployed to:', proxy.address);
    console.log('Admin:', deployer.account.address);

    const block = await publicClient.getBlock();

    const deploymentData: DeploymentData = {
      network: networkName,
      chainId: Number(chainId),
      implementation: implementation.address,
      proxy: proxy.address,
      adminAddress: deployer.account.address,
      deployer: deployer.account.address,
      timestamp: new Date().toISOString(),
      blockNumber: block.number.toString(),
    };

    writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    console.log('Deployment data saved to:', deploymentPath);

    console.log('\nDEPLOYMENT COMPLETE');
    console.log('\nContract Details:');
    console.log('Network:', deploymentData.network);
    console.log('Chain ID:', deploymentData.chainId);
    console.log('Implementation:', deploymentData.implementation);
    console.log('Proxy (Main Contract):', deploymentData.proxy);
    console.log('Admin:', deploymentData.adminAddress);
    console.log('Block:', deploymentData.blockNumber);
    console.log('Timestamp:', deploymentData.timestamp);

    const explorerUrl = networkName === 'sepoliaBase'
      ? `https://sepolia.basescan.org/address/${proxy.address}`
      : `https://basescan.org/address/${proxy.address}`;

    console.log('\nExplorer:', explorerUrl);
    console.log('Proxy Address:', proxy.address);
    console.log(`Verify with: npm run verify:${networkName === 'base' ? 'mainnet' : 'sepolia'}`);

    return deploymentData;
  } catch (error) {
    console.error('\nDeployment failed:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
