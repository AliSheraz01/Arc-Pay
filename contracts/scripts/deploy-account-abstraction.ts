import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`[Deploy] Deploying ERC-4337 Smart Accounts & Session Key Module...`);
  console.log(`[Deploy] Deployer Address: ${deployer.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`[Deploy] Network: Chain ID ${network.chainId}`);

  // Official ERC-4337 EntryPoint v0.6 address on EVM networks
  // Or standard canonical entrypoint 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 / v0.7 0x0000000071727De22E5E9d8BAf0edAc6f37da032
  const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  // 1. Deploy ArcPaySessionKeyModule
  console.log("[Deploy] Deploying ArcPaySessionKeyModule...");
  const SessionKeyModule = await ethers.getContractFactory("ArcPaySessionKeyModule");
  const sessionKeyModule = await SessionKeyModule.deploy();
  await sessionKeyModule.waitForDeployment();
  const sessionKeyModuleAddress = await sessionKeyModule.getAddress();
  console.log(`[Deploy] ArcPaySessionKeyModule deployed at: ${sessionKeyModuleAddress}`);

  // 2. Deploy ArcPayAccountFactory
  console.log("[Deploy] Deploying ArcPayAccountFactory...");
  const AccountFactory = await ethers.getContractFactory("ArcPayAccountFactory");
  const factory = await AccountFactory.deploy(ENTRY_POINT_ADDRESS, sessionKeyModuleAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`[Deploy] ArcPayAccountFactory deployed at: ${factoryAddress}`);

  const deploymentData = {
    network: network.chainId === 5042n ? "arc_mainnet" : "arc_testnet",
    chainId: Number(network.chainId),
    entryPointAddress: ENTRY_POINT_ADDRESS,
    sessionKeyModuleAddress,
    accountFactoryAddress: factoryAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const outputPath = path.join(__dirname, "../deployments.aa.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`[Deploy] Deployment artifact saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
