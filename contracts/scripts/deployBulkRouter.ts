import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying ArcPayBulkRouter...");

  // Get the USDC address. For Arc testnet we use the dummy USDC address
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

  const ArcPayBulkRouter = await ethers.getContractFactory("ArcPayBulkRouter");
  const router = await ArcPayBulkRouter.deploy(USDC_ADDRESS);

  await router.waitForDeployment();
  const address = await router.getAddress();

  console.log(`ArcPayBulkRouter deployed to: ${address}`);

  // We could save it to deployments.json or print it.
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  let deployments: any = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  }
  
  deployments.ArcPayBulkRouter = address;
  
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Updated deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
