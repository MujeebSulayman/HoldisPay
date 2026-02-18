import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { encodeFunctionData } from 'viem';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  console.log('Starting Contract Verification');

  try {
    // Get network name from command line argument
    const networkName = process.env.HARDHAT_NETWORK || 'sepoliaBase';
    const deploymentPath = join(process.cwd(), 'deployments', `${networkName}.json`);

    let deploymentData: DeploymentData;
    try {
      const data = readFileSync(deploymentPath, 'utf8');
      deploymentData = JSON.parse(data);
    } catch (error) {
      console.error(`\nNo deployment file found for network: ${networkName}`);
      console.error(`Expected file: ${deploymentPath}`);
      console.error('\nDeploy the contract first using:');
      console.error(`npm run deploy:${networkName === 'base' ? 'mainnet' : 'sepolia'}`);
      process.exit(1);
    }

    console.log('\nVerification Details:');
    console.log('Network:', networkName);
    console.log('Implementation:', deploymentData.implementation);
    console.log('Proxy:', deploymentData.proxy);
    console.log('Chain ID:', deploymentData.chainId);

    // Verify Implementation
    console.log('\nVerifying Holdis implementation...');
    try {
      const cmd = `npx hardhat verify --network ${networkName} ${deploymentData.implementation}`;
      const { stdout, stderr } = await execAsync(cmd);
      if (stderr && !stderr.includes('Already Verified')) {
        console.error(stderr);
      }
      if (stdout.includes('Already Verified') || stdout.includes('Successfully verified')) {
        console.log('Implementation verified');
      } else {
        console.log(stdout);
      }
    } catch (error: any) {
      if (error.message?.includes('Already Verified') || error.stdout?.includes('Already Verified')) {
        console.log('Implementation already verified');
      } else {
        console.error('Implementation verification failed:', error.message);
      }
    }

    // Verify Proxy - create constructor args file
    console.log('\nVerifying HoldisProxy...');
    try {
      const hre = await import('hardhat');
      const holdisArtifact = await hre.default.artifacts.readArtifact('Holdis');
      const initializeData = encodeFunctionData({
        abi: holdisArtifact.abi,
        functionName: 'initialize',
        args: [deploymentData.adminAddress as `0x${string}`],
      });

      // Write constructor arguments to a file (use .cjs for ES module project)
      const argsPath = join(process.cwd(), 'scripts', 'proxy-args.cjs');
      const argsContent = `module.exports = [\n  "${deploymentData.implementation}",\n  "${initializeData}"\n];\n`;
      writeFileSync(argsPath, argsContent);

      const cmd = `npx hardhat verify --network ${networkName} --constructor-args-path ${argsPath} ${deploymentData.proxy}`;
      const { stdout, stderr } = await execAsync(cmd);
      if (stderr && !stderr.includes('Already Verified')) {
        console.error(stderr);
      }
      if (stdout.includes('Already Verified') || stdout.includes('Successfully verified')) {
        console.log('Proxy verified');
      } else {
        console.log(stdout);
      }
    } catch (error: any) {
      if (error.message?.includes('Already Verified') || error.stdout?.includes('Already Verified')) {
        console.log('Proxy already verified');
      } else {
        console.error('Proxy verification failed:', error.message);
      }
    }

    const proxyUrl = networkName === 'sepoliaBase'
      ? `https://sepolia.basescan.org/address/${deploymentData.proxy}`
      : `https://basescan.org/address/${deploymentData.proxy}`;

    const implUrl = networkName === 'sepoliaBase'
      ? `https://sepolia.basescan.org/address/${deploymentData.implementation}`
      : `https://basescan.org/address/${deploymentData.implementation}`;

    console.log('\nVERIFICATION COMPLETE');
    console.log('\nView on BaseScan:');
    console.log('Proxy:', proxyUrl);
    console.log('Implementation:', implUrl);

  } catch (error: any) {
    console.error('\nVerification failed:', error.message || error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
