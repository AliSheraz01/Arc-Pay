# EASYPAY — ARC MAINNET DEPLOYMENT PLAN
## Safety, Verification & Operational Execution Document

### 1. Network Specification
- **Network Name:** Arc Mainnet
- **Chain ID:** `5042` (`0x13b2`)
- **RPC URL:** `https://rpc.mainnet.arc.io` (Backup: `https://rpc.arc.network`)
- **Block Explorer:** `https://explorer.arc.io`
- **Native Gas Token:** USDC (18 decimals for gas execution, 6 decimals for ERC20 token operations)
- **Official USDC Precompile/Token Address:** `0x3600000000000000000000000000000000000000`
- **Circle CCTP Arc Domain:** `26`
- **CCTP V2 TokenMessenger:** `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`
- **CCTP V2 MessageTransmitter:** `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`

---

### 2. Contracts to Deploy

#### 1. `ArcPayUsernameRegistry`
- **Purpose:** On-chain registry mapping unique, normalized usernames (`@username`) to EVM wallet addresses.
- **Registration Fee:** FREE (0 USDC protocol fee; user pays native Arc gas only).
- **Constructor Parameters:** `None`
- **Compiler Version:** Solidity `0.8.24` (via Hardhat with optimizer enabled, 200 runs).
- **Verification:** ArcScan block explorer API.
- **Key Functions:**
  - `registerUsername(string calldata _username)`
  - `resolveUsername(string calldata _username) external view returns (address)`
  - `usernameOf(address _user) external view returns (string memory)`
  - `isRegistered(string calldata _username) external view returns (bool)`
- **Key Events:**
  - `UsernameRegistered(address indexed owner, string username)`

#### 2. `ArcPayRouter`
- **Purpose:** Routes payments directly from sender to recipient with memos and emits indexable events.
- **Constructor Parameters:**
  - `address _usdcToken`: `0x3600000000000000000000000000000000000000`
- **Compiler Version:** Solidity `0.8.24`
- **Security Protections:** `ReentrancyGuard`, SafeERC20, zero address checks, zero amount checks, contract self-send prevention.
- **Key Functions:**
  - `sendPayment(address _to, uint256 _amount, string calldata _memo)`
- **Key Events:**
  - `PaymentSent(address indexed from, address indexed to, uint256 amount, string memo)`

#### 3. `BountyEscrow`
- **Purpose:** Holds bounty prize funds in escrow on-chain per bountyId. Manages winner selection, reward payout, and cancellation/refund state transitions.
- **Constructor Parameters:**
  - `address _usdcToken`: `0x3600000000000000000000000000000000000000`
- **Compiler Version:** Solidity `0.8.24`
- **Security Protections:** `ReentrancyGuard`, SafeERC20, double payout prevention, unauthorized release protection.
- **Key Functions:**
  - `depositBounty(bytes32 bountyId, uint256 amount, uint256 deadline)`
  - `releasePrize(bytes32 bountyId, address winner)`
  - `cancelBounty(bytes32 bountyId)`
  - `refundExpiredBounty(bytes32 bountyId)`
- **Key Events:**
  - `BountyCreated(bytes32 indexed bountyId, address indexed creator, uint256 amount, uint256 deadline)`
  - `BountyFunded(bytes32 indexed bountyId, address indexed creator, uint256 amount, uint256 deadline)`
  - `WinnerSelected(bytes32 indexed bountyId, address indexed winner, uint256 amount)`
  - `RewardReleased(bytes32 indexed bountyId, address indexed winner, uint256 amount)`
  - `BountyCancelled(bytes32 indexed bountyId, address indexed creator, uint256 refundAmount)`
  - `BountyRefunded(bytes32 indexed bountyId, address indexed creator, uint256 amount)`

---

### 3. Step-by-Step Deployment Protocol

1. **Verify Gas Balance:**
   Ensure deployer wallet has sufficient Arc Mainnet USDC for contract deployments:
   ```bash
   npx hardhat check-balance --network arc_mainnet
   ```
2. **Execute Deployment Script:**
   ```bash
   npx hardhat run scripts/deployMainnet.ts --network arc_mainnet
   ```
3. **Record Deployment Manifest in `contracts/deployments.mainnet.json`:**
   ```json
   {
     "network": "arc_mainnet",
     "chainId": 5042,
     "usdcAddress": "0x3600000000000000000000000000000000000000",
     "registryAddress": "0x...",
     "routerAddress": "0x...",
     "bountyEscrowAddress": "0x...",
     "deployedAt": "2026-09-22T...",
     "deployer": "0x..."
   }
   ```
4. **Contract Verification:**
   ```bash
   npx hardhat verify --network arc_mainnet <REGISTRY_ADDRESS>
   npx hardhat verify --network arc_mainnet <ROUTER_ADDRESS> "0x3600000000000000000000000000000000000000"
   npx hardhat verify --network arc_mainnet <BOUNTY_ESCROW_ADDRESS> "0x3600000000000000000000000000000000000000"
   ```
5. **Update Production Environment Variables:**
   ```env
   NEXT_PUBLIC_NETWORK=mainnet
   NEXT_PUBLIC_ARC_CHAIN_ID=5042
   NEXT_PUBLIC_ARC_RPC_URL=https://rpc.mainnet.arc.io
   NEXT_PUBLIC_ARC_EXPLORER_URL=https://explorer.arc.io
   NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
   NEXT_PUBLIC_USERNAME_REGISTRY=<NEW_REGISTRY_ADDRESS>
   NEXT_PUBLIC_PAYMENT_ROUTER=<NEW_ROUTER_ADDRESS>
   NEXT_PUBLIC_BOUNTY_ESCROW=<NEW_BOUNTY_ESCROW_ADDRESS>
   ```
