import { expect } from "chai";
import { ethers } from "hardhat";
import { 
  ArcPayUsernameRegistry, 
  ArcPayRouter, 
  BountyEscrow, 
  MockUSDC 
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArcPay Production Smart Contracts", function () {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let usdc: MockUSDC;
  let registry: ArcPayUsernameRegistry;
  let router: ArcPayRouter;
  let escrow: BountyEscrow;

  const INITIAL_BALANCE = ethers.parseUnits("1000", 6);

  beforeEach(async function () {
    [deployer, user1, user2, user3] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDCFactory.deploy()) as MockUSDC;
    await usdc.waitForDeployment();

    // Distribute USDC
    await usdc.mint(user1.address, INITIAL_BALANCE);
    await usdc.mint(user2.address, INITIAL_BALANCE);

    // Deploy ArcPayUsernameRegistry (FREE registration)
    const RegistryFactory = await ethers.getContractFactory("ArcPayUsernameRegistry");
    registry = (await RegistryFactory.deploy()) as ArcPayUsernameRegistry;
    await registry.waitForDeployment();

    // Deploy ArcPayRouter
    const RouterFactory = await ethers.getContractFactory("ArcPayRouter");
    router = (await RouterFactory.deploy(await usdc.getAddress())) as ArcPayRouter;
    await router.waitForDeployment();

    // Deploy BountyEscrow
    const EscrowFactory = await ethers.getContractFactory("BountyEscrow");
    escrow = (await EscrowFactory.deploy(await usdc.getAddress())) as BountyEscrow;
    await escrow.waitForDeployment();
  });

  describe("ArcPayUsernameRegistry", function () {
    it("should allow free username registration with valid characters", async function () {
      await expect(registry.connect(user1).registerUsername("ali_web3"))
        .to.emit(registry, "UsernameRegistered")
        .withArgs(user1.address, "ali_web3");

      expect(await registry.resolveUsername("ali_web3")).to.equal(user1.address);
      expect(await registry.usernameOf(user1.address)).to.equal("ali_web3");
      expect(await registry.connect(user1).getMyUsername()).to.equal("ali_web3");
      expect(await registry.isRegistered("ali_web3")).to.be.true;
    });

    it("should reject duplicate username", async function () {
      await registry.connect(user1).registerUsername("sheraz");
      await expect(
        registry.connect(user2).registerUsername("sheraz")
      ).to.be.revertedWith("Username already taken");
    });

    it("should reject address registering more than one username", async function () {
      await registry.connect(user1).registerUsername("ali");
      await expect(
        registry.connect(user1).registerUsername("ali2")
      ).to.be.revertedWith("Address already has a username");
    });

    it("should reject usernames with uppercase or invalid characters", async function () {
      await expect(
        registry.connect(user1).registerUsername("Ali_Web3")
      ).to.be.revertedWith("Username contains invalid characters (allowed: a-z, 0-9, _)");

      await expect(
        registry.connect(user1).registerUsername("ali@web3")
      ).to.be.revertedWith("Username contains invalid characters (allowed: a-z, 0-9, _)");

      await expect(
        registry.connect(user1).registerUsername("ali web3")
      ).to.be.revertedWith("Username contains invalid characters (allowed: a-z, 0-9, _)");
    });

    it("should reject usernames shorter than 3 or longer than 30 characters", async function () {
      await expect(
        registry.connect(user1).registerUsername("al")
      ).to.be.revertedWith("Username must be at least 3 characters");

      const longUsername = "a".repeat(31);
      await expect(
        registry.connect(user1).registerUsername(longUsername)
      ).to.be.revertedWith("Username too long (max 30)");
    });
  });

  describe("ArcPayRouter", function () {
    const paymentAmount = ethers.parseUnits("50", 6);
    const memo = "Payment for design bounty";

    it("should route payment and emit PaymentSent event", async function () {
      await usdc.connect(user1).approve(await router.getAddress(), paymentAmount);

      await expect(
        router.connect(user1).sendPayment(user2.address, paymentAmount, memo)
      )
        .to.emit(router, "PaymentSent")
        .withArgs(user1.address, user2.address, paymentAmount, memo);

      expect(await usdc.balanceOf(user2.address)).to.equal(INITIAL_BALANCE + paymentAmount);
    });

    it("should reject payments to zero address or self contract", async function () {
      await usdc.connect(user1).approve(await router.getAddress(), paymentAmount);

      await expect(
        router.connect(user1).sendPayment(ethers.ZeroAddress, paymentAmount, memo)
      ).to.be.revertedWith("Cannot send to zero address");

      await expect(
        router.connect(user1).sendPayment(await router.getAddress(), paymentAmount, memo)
      ).to.be.revertedWith("Cannot send to router contract");
    });

    it("should reject payments with zero amount", async function () {
      await expect(
        router.connect(user1).sendPayment(user2.address, 0, memo)
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("BountyEscrow", function () {
    const prizeAmount = ethers.parseUnits("120", 6);
    const bountyUuid = "bounty-test-1234-uuid";
    const bountyId = ethers.keccak256(ethers.toUtf8Bytes(bountyUuid));

    it("should fund bounty, store escrow balance, and release to winner", async function () {
      const futureDeadline = Math.floor(Date.now() / 1000) + 86400; // 1 day

      // Step 1: Fund Bounty
      await usdc.connect(user1).approve(await escrow.getAddress(), prizeAmount);
      await expect(escrow.connect(user1).depositBounty(bountyId, prizeAmount, futureDeadline))
        .to.emit(escrow, "BountyFunded")
        .withArgs(bountyId, user1.address, prizeAmount, futureDeadline);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(prizeAmount);

      // Verify state
      const b = await escrow.getBounty(bountyId);
      expect(b.creator).to.equal(user1.address);
      expect(b.amount).to.equal(prizeAmount);
      expect(b.status).to.equal(1); // Funded

      // Step 2: Release prize to winner
      const user2BalBefore = await usdc.balanceOf(user2.address);
      await expect(escrow.connect(user1).releasePrize(bountyId, user2.address))
        .to.emit(escrow, "RewardReleased")
        .withArgs(bountyId, user2.address, prizeAmount);

      expect(await usdc.balanceOf(user2.address)).to.equal(user2BalBefore + prizeAmount);

      // Verify double payout rejection
      await expect(
        escrow.connect(user1).releasePrize(bountyId, user2.address)
      ).to.be.revertedWith("Bounty is not in funded status");
    });

    it("should reject unauthorized winner release", async function () {
      await usdc.connect(user1).approve(await escrow.getAddress(), prizeAmount);
      await escrow.connect(user1).depositBounty(bountyId, prizeAmount, 0);

      // user2 is not creator
      await expect(
        escrow.connect(user2).releasePrize(bountyId, user2.address)
      ).to.be.revertedWith("Only bounty creator can release prize");
    });

    it("should allow creator to cancel and receive refund", async function () {
      await usdc.connect(user1).approve(await escrow.getAddress(), prizeAmount);
      await escrow.connect(user1).depositBounty(bountyId, prizeAmount, 0);

      const user1BalBefore = await usdc.balanceOf(user1.address);
      await expect(escrow.connect(user1).cancelBounty(bountyId))
        .to.emit(escrow, "BountyCancelled")
        .withArgs(bountyId, user1.address, prizeAmount);

      expect(await usdc.balanceOf(user1.address)).to.equal(user1BalBefore + prizeAmount);

      // Verify cannot release prize after cancellation
      await expect(
        escrow.connect(user1).releasePrize(bountyId, user2.address)
      ).to.be.revertedWith("Bounty is not in funded status");
    });
  });
});
