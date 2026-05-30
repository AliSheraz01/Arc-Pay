import hre, { ethers } from 'hardhat'
import * as fs from 'fs'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with account:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Balance:', ethers.formatEther(balance))

  // USDC is already deployed at this address on Arc Testnet
  const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

  // Deploy Username Registry
  const Registry = await ethers.getContractFactory('ArcPayUsernameRegistry')
  const registry = await Registry.deploy()
  await registry.waitForDeployment()
  const registryAddress = await registry.getAddress()
  console.log('ArcPayUsernameRegistry deployed to:', registryAddress)

  // Deploy Payment Router
  const Router = await ethers.getContractFactory('ArcPayRouter')
  const router = await Router.deploy(USDC_ADDRESS)
  await router.waitForDeployment()
  const routerAddress = await router.getAddress()
  console.log('ArcPayRouter deployed to:', routerAddress)

  // Save deployment info
  const deployment = {
    network: 'arc_testnet',
    chainId: 5042002,
    usdcAddress: USDC_ADDRESS,
    registryAddress,
    routerAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  }

  fs.writeFileSync(
    'deployments.json',
    JSON.stringify(deployment, null, 2)
  )
  console.log('\nDeployment saved to deployments.json')
  console.log('\n--- Update your frontend .env.local ---')
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`)
  console.log(`NEXT_PUBLIC_ROUTER_ADDRESS=${routerAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
