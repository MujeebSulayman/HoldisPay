import hre from 'hardhat';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('Exporting ABIs...\n');

  const contracts = [
    'HoldisPaymentsCore',
    'HoldisMilestones',
    'HoldisTeam',
    'HoldisDisputes',
    'PaymentLibrary',
    'IPaymentsCore',
    'Holdis',
    'HoldisProxy'
  ];

  const backendAbiDir = join(process.cwd(), '..', 'Backend', 'src', 'contracts');
  
  try {
    mkdirSync(backendAbiDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }

  for (const contractName of contracts) {
    try {
      let artifact;
      
      if (contractName === 'HoldisProxy') {
        artifact = await hre.artifacts.readArtifact('contracts/ERC1967Proxy.sol:HoldisProxy');
      } else if (contractName === 'PaymentLibrary') {
        artifact = await hre.artifacts.readArtifact('contracts/libraries/PaymentLibrary.sol:PaymentLibrary');
      } else if (contractName === 'IPaymentsCore') {
        artifact = await hre.artifacts.readArtifact('contracts/interfaces/IPaymentsCore.sol:IPaymentsCore');
      } else if (['HoldisMilestones', 'HoldisTeam', 'HoldisDisputes'].includes(contractName)) {
        artifact = await hre.artifacts.readArtifact(`contracts/modules/${contractName}.sol:${contractName}`);
      } else {
        artifact = await hre.artifacts.readArtifact(contractName);
      }

      const abiPath = join(backendAbiDir, `${contractName}ABI.json`);
      writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      
      console.log(`✅ Exported ${contractName} ABI to Backend`);
    } catch (error: any) {
      console.error(`❌ Failed to export ${contractName}:`, error.message);
    }
  }

  console.log(`\n✅ All ABIs exported to: ${backendAbiDir}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
