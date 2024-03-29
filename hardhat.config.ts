import path from "path";
import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";

import "./tasks/omnibuses";
import "./src/hardhat-keystore";

import rpcs from "./src/rpcs";
import traces from "./src/traces";
import networks from "./src/networks";

traces.hardhat.setup();
rpcs.setLogsDir(path.join(__dirname, "rpc-node-logs"));

const config: HardhatUserConfig = {
  solidity: "0.8.23",
  networks: {
    hardhat: {
      hardfork: "merge",
      chainId: 1,
      forking: {
        url: networks.rpcUrl("eth", "mainnet"),
      },
    },
  },
  typechain: {
    externalArtifacts: ["interfaces/*.json"],
  },
  mocha: {
    timeout: 5 * 60 * 1000,
  },
  keystore: {
    path: "keystores",
  },
};

export default config;
