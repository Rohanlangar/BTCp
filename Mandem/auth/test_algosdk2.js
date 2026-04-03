const algosdk = require('algosdk');
try {
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    appIndex: BigInt(758205285),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: {fee: 1000, flatFee: true, firstRound: 1, lastRound: 10, genesisID: 'test', genesisHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='},
    foreignApps: [BigInt(758195734)],
    boxes: [{
      appIndex: 758195734, // Absolute ID, as a Number!
      name: new Uint8Array([1, 2, 3])
    }]
  });
  console.log("SUCCESS!");
  console.log(txn.boxes);
} catch (e) {
  console.error("ERROR 1:", e);
}

try {
  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    appIndex: BigInt(758205285),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: {fee: 1000, flatFee: true, firstRound: 1, lastRound: 10, genesisID: 'test', genesisHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='},
    foreignApps: [BigInt(758195734)],
    boxes: [{
      appIndex: 0, // Using 0 for current app
      name: new Uint8Array([1, 2, 3])
    }]
  });
  console.log("SUCCESS 2!");
  console.log(txn.boxes);
} catch (e) {
  console.error("ERROR 2:", e);
}
