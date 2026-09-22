import hre, { ethers } from 'hardhat'
import * as fs from 'fs'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('=== EASYPAY ARC MAINNET CONTRACT DEPLOYMENT ===')
  console.log('Deployer Address:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Deployer Balance (USDC Native Gas):', ethers.formatEther(balance))

  // Arc Mainnet Native USDC precompile address
  const USDC_ADDRESS = process.env.ARC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000'

  // 1. Deploy Production ArcPayUsernameRegistry (FREE registration)
  console.log('\nDeploying ArcPayUsernameRegistry...')
  const Registry = await ethers.getContractFactory('ArcPayUsernameRegistry')
  const registry = await Registry.deploy()
  await registry.waitForDeployment()
  const registryAddress = await registry.getAddress()
  console.log('✓ ArcPayUsernameRegistry deployed to:', registryAddress)

  // 2. Deploy Production ArcPayRouter
  console.log('\nDeploying ArcPayRouter...')
  const Router = await ethers.getContractFactory('ArcPayRouter')
  const router = await Router.deploy(USDC_ADDRESS)
  await router.waitForDeployment()
  const routerAddress = await router.getAddress()
  console.log('✓ ArcPayRouter deployed to:', routerAddress)

  // 3. Deploy Production BountyEscrow
  console.log('\nDeploying BountyEscrow...')
  const Escrow = await ethers.getContractFactory('BountyEscrow')
  const escrow = await Escrow.deploy(USDC_ADDRESS)
  await escrow.waitForDeployment()
  const escrowAddress = await escrow.getAddress()
  console.log('✓ BountyEscrow deployed to:', escrowAddress)

  // Save deployment info
  const deployment = {
    network: 'arc_mainnet',
    chainId: 5042,
    usdcAddress: USDC_ADDRESS,
    registryAddress,
    routerAddress,
    bountyEscrowAddress: escrowAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  }

  fs.writeFileSync('deployments.mainnet.json', JSON.stringify(deployment, null, 2))
  console.log('\nDeployment manifest saved to contracts/deployments.mainnet.json')
  console.log('\n=== COPY THESE VALUES TO YOUR FRONTEND .env.local ===')
  console.log(`NEXT_PUBLIC_USERNAME_REGISTRY=${registryAddress}`)
  console.log(`NEXT_PUBLIC_PAYMENT_ROUTER=${routerAddress}`)
  console.log(`NEXT_PUBLIC_BOUNTY_ESCROW=${escrowAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
