const { createPublicClient, http } = require('viem');

const client = createPublicClient({  transport: http('https://dream-rpc.somnia.network') });
const abi = [{ inputs: [], name: 'currentAPY', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }];

async function main() {
  const result = await client.readContract({
    address: '0x0d0597b6002D2f41374808F4Aeb956473871BbA9',
    abi, functionName: 'currentAPY'
  });
  console.log("Current APY:", result.toString());
}
main();
