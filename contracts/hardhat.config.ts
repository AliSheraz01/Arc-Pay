import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arc_testnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    arc_mainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
      chainId: 5042,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      arc_testnet: "empty",
      arc_mainnet: "empty"
    },
    customChains: [
      {
        network: "arc_testnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app"
        }
      },
      {
        network: "arc_mainnet",
        chainId: 5042,
        urls: {
          apiURL: "https://explorer.arc.io/api",
          browserURL: "https://explorer.arc.io"
        }
      }
    ]
  }
};

export default config;
