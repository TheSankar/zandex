const { keccak256, toBytes } = require('viem');
const methods = [
  'deposit()',
  'withdraw(uint256)',
  'withdraw()',
  'withdraw(uint256,address)',
  'withdraw(uint256,address,address)',
  'balanceOf(address)'
];
methods.forEach(m => {
  console.log(m, keccak256(toBytes(m)).slice(0, 10));
});
