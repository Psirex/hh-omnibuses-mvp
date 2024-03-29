import hre from "hardhat";
import { TracingSample__factory } from "../../typechain-types";
import providers from "../providers";
import rpcs, { SpawnedRpcNode } from "../rpcs";
import { DebugTxTraceStrategy } from "./debug-trace-tx-strategy";
import { assert } from "chai";
import { HardhatVmTraceStrategy } from "./hardhat-vm-trace-strategy";

const RPC_NODES = [
  ["anvil", { port: 8544, stepsTracing: true }],
  ["hardhat", { port: 8545 }],
  ["ganache", { server: { port: 8546 } }],
];

describe("TxTracer strategies", () => {
  // run all nodes
  // run transaction on each of them
  // trace
  // traces must be the same
  let nodes: SpawnedRpcNode[] = [];

  after(async () => {
    await Promise.all(nodes.map((node) => node.stop()));
  });

  const GAS_LIMIT = 25_500_000;

  it(`test the trace result is the same for different strategies`, async () => {
    const { provider: hhProvider } = hre.ethers;
    const hhCheates = await providers.cheats(hhProvider);
    const [hhOwner] = await hhCheates.signers();
    const hhTracer = new HardhatVmTraceStrategy();
    await hhTracer.init(hhProvider);
    const hhSample = await new TracingSample__factory(hhOwner).deploy();
    await hhTracer.enableTracing();
    const hhReceipt = await (await hhSample.testSuccess({ gasLimit: GAS_LIMIT })).wait();
    const hardhatTraceItems = await hhTracer.trace(hhReceipt!);

    const anvilNode = await rpcs.spawn("anvil", {
      port: 8544,
      stepsTracing: true,
      mnemonic: "test test test test test test test test test test test junk",
      hardfork: "paris",
    });
    nodes.push(anvilNode);
    const { provider: anvilProvider } = anvilNode;
    const anvilCheates = await providers.cheats(anvilProvider);
    const [anvilOwner] = await anvilCheates.signers();
    const anvilSample = await new TracingSample__factory(anvilOwner).deploy();
    const ar = await anvilSample.deploymentTransaction()?.wait();
    const anvilReceipt = await (await anvilSample.testSuccess({ gasLimit: GAS_LIMIT })).wait();
    const anvilTraceItems = await new DebugTxTraceStrategy(anvilProvider).trace(anvilReceipt!);

    const ganacheNode = await rpcs.spawn("ganache", {
      server: { port: 8546 },
      wallet: { mnemonic: "test test test test test test test test test test test junk" },
      chain: { hardfork: "merge" },
    });
    nodes.push(ganacheNode);
    const { provider: ganacheProvider } = ganacheNode;
    const ganacheCheates = await providers.cheats(ganacheProvider);
    const [ganacheOwner] = await ganacheCheates.signers();
    const ganacheSample = await new TracingSample__factory(ganacheOwner).deploy();
    const ganacheReceipt = await (await ganacheSample.testSuccess({ gasLimit: GAS_LIMIT })).wait();
    const ganacheTraceItems = await new DebugTxTraceStrategy(ganacheProvider).trace(
      ganacheReceipt!,
    );

    assert.equal(hardhatTraceItems.length, ganacheTraceItems.length);
    assert.equal(ganacheTraceItems.length, anvilTraceItems.length);

    for (let i = 0; i < hardhatTraceItems.length; ++i) {
      assert.deepEqual(hardhatTraceItems[i], ganacheTraceItems[i]);
      assert.deepEqual(ganacheTraceItems[i], anvilTraceItems[i]);
    }
  });
});
