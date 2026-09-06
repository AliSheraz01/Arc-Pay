import hre, { ethers } from 'hardhat'
import * as fs from 'fs'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying BountyEscrow with account:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Balance:', ethers.formatEther(balance))

  const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

  const BountyEscrow = await ethers.getContractFactory('BountyEscrow')
  const escrow = await BountyEscrow.deploy(USDC_ADDRESS)
  await escrow.waitForDeployment()
  const escrowAddress = await escrow.getAddress()
  console.log('BountyEscrow deployed to:', escrowAddress)

  // Update deployments.json
  const deploymentsPath = 'deployments.json'
  let deployments: any = {}
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
  } catch {}
  deployments.bountyEscrowAddress = escrowAddress
  deployments.bountyEscrowDeployedAt = new Date().toISOString()
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2))
  console.log('\ndeployments.json updated.')
  console.log('\n--- Add to your frontend .env.local ---')
  console.log(`NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=${escrowAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
