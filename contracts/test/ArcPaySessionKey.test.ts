import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
  ArcPaySessionKeyModule, 
  ArcPaySmartAccount, 
  ArcPayAccountFactory,
  MockUSDC 
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArcPay ERC-4337 Smart Account & Session Key Module", function () {
  let sessionKeyModule: ArcPaySessionKeyModule;
  let factory: ArcPayAccountFactory;
  let mockUsdc: MockUSDC;
  let smartAccount: ArcPaySmartAccount;

  let owner: SignerWithAddress;
  let sessionSigner: SignerWithAddress;
  let recipient: SignerWithAddress;
  let entryPointMock: SignerWithAddress; // Acting as EntryPoint for testing

  const INITIAL_USDC_SUPPLY = ethers.parseUnits("1000", 6);
  const SPENDING_LIMIT = ethers.parseUnits("50", 6); // 50 USDC limit

  beforeEach(async function () {
    [owner, sessionSigner, recipient, entryPointMock] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDCFactory.deploy();
    await mockUsdc.waitForDeployment();

    // 2. Deploy Session Key Module
    const SessionKeyModuleFactory = await ethers.getContractFactory("ArcPaySessionKeyModule");
    sessionKeyModule = await SessionKeyModuleFactory.deploy();
    await sessionKeyModule.waitForDeployment();

    // 3. Deploy Account Factory
    const AccountFactory = await ethers.getContractFactory("ArcPayAccountFactory");
    factory = await AccountFactory.deploy(entryPointMock.address, await sessionKeyModule.getAddress());
    await factory.waitForDeployment();

    // 4. Create Smart Account for owner
    const salt = 12345n;
    const computedAddr = await factory.computeAccountAddress(owner.address, salt);
    await factory.createAccount(owner.address, salt);
    
    smartAccount = await ethers.getContractAt("ArcPaySmartAccount", computedAddr);

    // Fund the smart account with USDC
    await mockUsdc.mint(await smartAccount.getAddress(), INITIAL_USDC_SUPPLY);
  });

  it("should deploy smart account with correct owner and entrypoint", async function () {
    expect(await smartAccount.owner()).to.equal(owner.address);
    expect(await smartAccount.entryPoint()).to.equal(entryPointMock.address);
    expect(await smartAccount.sessionKeyModule()).to.equal(await sessionKeyModule.getAddress());
  });

  it("should allow owner to execute direct USDC transfers", async function () {
    const transferAmount = ethers.parseUnits("10", 6);
    const transferData = mockUsdc.interface.encodeFunctionData("transfer", [recipient.address, transferAmount]);

    await smartAccount.connect(owner).execute(await mockUsdc.getAddress(), 0, transferData);

    expect(await mockUsdc.balanceOf(recipient.address)).to.equal(transferAmount);
  });

  it("should authorize a session key with strict spending limits and expiry", async function () {
    const currentTime = await time.latest();
    const validAfter = currentTime;
    const validUntil = currentTime + 86400; // 24 hours

    // Authorize session key
    await smartAccount.connect(owner).enableSessionKey(
      sessionSigner.address,
      await mockUsdc.getAddress(),
      await mockUsdc.getAddress(), // target restricted to USDC
      SPENDING_LIMIT,
      validAfter,
      validUntil
    );

    const session = await sessionKeyModule.getSession(await smartAccount.getAddress(), sessionSigner.address);
    expect(session.isActive).to.be.true;
    expect(session.spendingLimit).to.equal(SPENDING_LIMIT);
    expect(session.spentAmount).to.equal(0n);
    expect(session.token).to.equal(await mockUsdc.getAddress());
  });

  it("should validate and execute UserOp via Session Key delegation", async function () {
    const currentTime = await time.latest();
    const validAfter = currentTime;
    const validUntil = currentTime + 86400;

    await smartAccount.connect(owner).enableSessionKey(
      sessionSigner.address,
      await mockUsdc.getAddress(),
      await mockUsdc.getAddress(),
      SPENDING_LIMIT,
      validAfter,
      validUntil
    );

    // Build UserOp for 5 USDC transfer
    const transferAmount = ethers.parseUnits("5", 6);
    const innerData = mockUsdc.interface.encodeFunctionData("transfer", [recipient.address, transferAmount]);
    const callData = smartAccount.interface.encodeFunctionData("execute", [
      await mockUsdc.getAddress(),
      0,
      innerData
    ]);

    const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("mock-user-op-hash-1"));
    const sessionSignature = await sessionSigner.signMessage(ethers.getBytes(userOpHash));

    // Session signature formatted with 0x01 prefix + abi.encode(sessionKey, signature)
    const encodedSessionSig = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes"],
      [sessionSigner.address, sessionSignature]
    );
    const fullSignature = ethers.concat(["0x01", encodedSessionSig]);

    const userOp = {
      sender: await smartAccount.getAddress(),
      nonce: 0,
      initCode: "0x",
      callData: callData,
      callGasLimit: 100000,
      verificationGasLimit: 100000,
      preVerificationGas: 21000,
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      paymasterAndData: "0x",
      signature: fullSignature,
    };

    // EntryPoint validates UserOp
    const validationData = await smartAccount.connect(entryPointMock).validateUserOp.staticCall(
      userOp,
      userOpHash,
      0
    );

    // High 160 bits contain validUntil/validAfter, lowest byte should be 0 (success)
    expect(validationData & 1n).to.equal(0n);

    // Now execute actual call through entrypoint
    await smartAccount.connect(entryPointMock).validateUserOp(userOp, userOpHash, 0);
    await smartAccount.connect(entryPointMock).execute(await mockUsdc.getAddress(), 0, innerData);

    expect(await mockUsdc.balanceOf(recipient.address)).to.equal(transferAmount);

    // Check spent amount updated
    const session = await sessionKeyModule.getSession(await smartAccount.getAddress(), sessionSigner.address);
    expect(session.spentAmount).to.equal(transferAmount);
    expect(await sessionKeyModule.getRemainingAllowance(await smartAccount.getAddress(), sessionSigner.address)).to.equal(
      SPENDING_LIMIT - transferAmount
    );
  });

  it("should reject UserOp if spending limit is exceeded", async function () {
    const currentTime = await time.latest();
    await smartAccount.connect(owner).enableSessionKey(
      sessionSigner.address,
      await mockUsdc.getAddress(),
      await mockUsdc.getAddress(),
      SPENDING_LIMIT, // 50 USDC
      currentTime,
      currentTime + 86400
    );

    // Try to transfer 60 USDC (over 50 limit)
    const excessiveAmount = ethers.parseUnits("60", 6);
    const innerData = mockUsdc.interface.encodeFunctionData("transfer", [recipient.address, excessiveAmount]);
    const callData = smartAccount.interface.encodeFunctionData("execute", [
      await mockUsdc.getAddress(),
      0,
      innerData
    ]);

    const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("mock-user-op-hash-exceed"));
    const sessionSignature = await sessionSigner.signMessage(ethers.getBytes(userOpHash));
    const encodedSessionSig = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes"],
      [sessionSigner.address, sessionSignature]
    );
    const fullSignature = ethers.concat(["0x01", encodedSessionSig]);

    const userOp = {
      sender: await smartAccount.getAddress(),
      nonce: 0,
      initCode: "0x",
      callData: callData,
      callGasLimit: 100000,
      verificationGasLimit: 100000,
      preVerificationGas: 21000,
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      paymasterAndData: "0x",
      signature: fullSignature,
    };

    // Validation should return SIG_VALIDATION_FAILED (1)
    const validationData = await smartAccount.connect(entryPointMock).validateUserOp.staticCall(
      userOp,
      userOpHash,
      0
    );
    expect(validationData).to.equal(1n); // SIG_VALIDATION_FAILED
  });

  it("should reject UserOp after session expiration", async function () {
    const currentTime = await time.latest();
    const expiry = currentTime + 3600; // 1 hour

    await smartAccount.connect(owner).enableSessionKey(
      sessionSigner.address,
      await mockUsdc.getAddress(),
      await mockUsdc.getAddress(),
      SPENDING_LIMIT,
      currentTime,
      expiry
    );

    // Fast forward past expiry
    await time.increase(3601);

    const transferAmount = ethers.parseUnits("5", 6);
    const innerData = mockUsdc.interface.encodeFunctionData("transfer", [recipient.address, transferAmount]);
    const callData = smartAccount.interface.encodeFunctionData("execute", [
      await mockUsdc.getAddress(),
      0,
      innerData
    ]);

    const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("mock-user-op-hash-expired"));
    const sessionSignature = await sessionSigner.signMessage(ethers.getBytes(userOpHash));
    const encodedSessionSig = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes"],
      [sessionSigner.address, sessionSignature]
    );
    const fullSignature = ethers.concat(["0x01", encodedSessionSig]);

    const userOp = {
      sender: await smartAccount.getAddress(),
      nonce: 0,
      initCode: "0x",
      callData: callData,
      callGasLimit: 100000,
      verificationGasLimit: 100000,
      preVerificationGas: 21000,
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      paymasterAndData: "0x",
      signature: fullSignature,
    };

    const validationData = await smartAccount.connect(entryPointMock).validateUserOp.staticCall(
      userOp,
      userOpHash,
      0
    );
    expect(validationData).to.equal(1n); // SIG_VALIDATION_FAILED
  });

  it("should immediately revoke session key when requested by owner", async function () {
    const currentTime = await time.latest();
    await smartAccount.connect(owner).enableSessionKey(
      sessionSigner.address,
      await mockUsdc.getAddress(),
      await mockUsdc.getAddress(),
      SPENDING_LIMIT,
      currentTime,
      currentTime + 86400
    );

    expect((await sessionKeyModule.getSession(await smartAccount.getAddress(), sessionSigner.address)).isActive).to.be.true;

    // Owner revokes session
    await smartAccount.connect(owner).revokeSessionKey(sessionSigner.address);

    expect((await sessionKeyModule.getSession(await smartAccount.getAddress(), sessionSigner.address)).isActive).to.be.false;
  });
});
