/**
 * Check that Holdis Payments Core contract is deployed and callable.
 * Run from Backend: npx tsx scripts/check-contract.ts
 */
/// <reference types="node" />
import 'dotenv/config';
import { createPublicClient, http, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const RPC_URL = process.env.RPC_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532', 10);
const CORE_ADDRESS = process.env.HOLDIS_PAYMENTS_CORE_ADDRESS as Address;

// Minimal ABI for the checks we run
const CORE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'employer', type: 'address' }],
    name: 'getEmployerContracts',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'contractor', type: 'address' }],
    name: 'getContractorContracts',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

async function main() {
  console.log('Holdis Payments Core – deployment check\n');

  if (!RPC_URL) {
    console.error('Missing RPC_URL in .env');
    process.exit(1);
  }
  if (!CORE_ADDRESS) {
    console.error('Missing HOLDIS_PAYMENTS_CORE_ADDRESS in .env');
    process.exit(1);
  }

  const chain = CHAIN_ID === 8453 ? base : baseSepolia;
  const client = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });

  console.log('Config:');
  console.log('  RPC_URL:', RPC_URL);
  console.log('  CHAIN_ID:', CHAIN_ID, `(${chain.name})`);
  console.log('  Contract:', CORE_ADDRESS);
  console.log('');

  // 1. Bytecode at address
  let bytecode: string | undefined;
  try {
    bytecode = await client.getCode({ address: CORE_ADDRESS });
  } catch (e) {
    console.error('Failed to get bytecode:', (e as Error).message);
    process.exit(1);
  }

  const deployed = !!bytecode && bytecode.length > 2;
  console.log('1. Bytecode at address:', deployed ? 'YES (contract deployed)' : 'NO (no code)');
  if (!deployed) {
    console.error('\nContract is not deployed at this address on this chain.');
    console.error('Check:');
    console.error('  - RPC_URL must match CHAIN_ID (e.g. Base Sepolia → https://sepolia.base.org)');
    console.error('  - You have CHAIN_ID=', CHAIN_ID, '→', chain.name, '→ use that chain\'s RPC in .env');
    process.exit(1);
  }

  // 2. getEmployerContracts(zero)
  try {
    const employerIds = await client.readContract({
      address: CORE_ADDRESS,
      abi: CORE_ABI,
      functionName: 'getEmployerContracts',
      args: [ZERO_ADDRESS],
    });
    console.log('2. getEmployerContracts(0x0...):', 'OK', `(length: ${employerIds?.length ?? 0})`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('2. getEmployerContracts(0x0...):', 'FAIL');
    console.error('   ', msg);
    if (msg.includes('returned no data') || msg.includes('0x')) {
      console.error('   Likely: wrong chain, or contract ABI/address mismatch.');
    }
  }

  // 3. getContractorContracts(zero)
  try {
    const contractorIds = await client.readContract({
      address: CORE_ADDRESS,
      abi: CORE_ABI,
      functionName: 'getContractorContracts',
      args: [ZERO_ADDRESS],
    });
    console.log('3. getContractorContracts(0x0...):', 'OK', `(length: ${contractorIds?.length ?? 0})`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('3. getContractorContracts(0x0...):', 'FAIL');
    console.error('   ', msg);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
