const { keccak256, toBytes } = require('viem');

const targetSelectors = ['dd905854', '6d874f8e', '04a7cff3', 'a5aca079', '535ea816'];

const verbs = ['withdraw', 'Withdraw', 'remove', 'Remove', 'claim', 'Claim', 'unstake', 'Unstake', 'redeem', 'Redeem'];
const nouns = ['', 'Deposit', 'Tokens', 'Funds', 'All', 'STT'];
const args = ['()', '(uint256)', '(uint256,address)', '(address,uint256)', '(uint256 amount)', '(address)'];

for (const v of verbs) {
  for (const n of nouns) {
    for (const a of args) {
      const sig = `${v}${n}${a}`.replace(' amount', '');
      const hash = keccak256(toBytes(sig)).slice(2, 10);
      if (targetSelectors.includes(hash)) {
        console.log(`FOUND: ${sig} -> ${hash}`);
      }
    }
  }
}
