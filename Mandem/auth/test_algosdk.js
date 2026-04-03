const algosdk = require('algosdk');
const txn = algosdk.makeApplicationCallTxnFromObject({
  sender: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
  appIndex: 758205285, // Escrow App
  onComplete: algosdk.OnApplicationComplete.NoOpOC,
  suggestedParams: {fee: 1000, flatFee: true, firstRound: 1, lastRound: 10, genesisID: 'test', genesisHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='},
  foreignApps: [758195734], // Registry App
  boxes: [{
    appIndex: 758195734, // What does algosdk do with this?
    name: algosdk.encodeUint64(3)
  }]
});
console.log("Txn Boxes:");
console.log(txn.boxes);
