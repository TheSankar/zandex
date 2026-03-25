const { createPublicClient, http } = require('viem');

const client = createPublicClient({
  transport: http('https://dream-rpc.somnia.network')
});

const abi = [{"inputs":[],"name":"asset","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

async function main() {
  const asset = await client.readContract({
    address: '0xbD38693e6043A9Ca8b0f7Aa4b1E6411BAeb6a830',
    abi,
    functionName: 'asset'
  });
  console.log("UNDERLYING ASSET:", asset);
}
main();
