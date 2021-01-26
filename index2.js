const { ApiPromise } = require('@polkadot/api');

async function main() {
    const api = await ApiPromise.create();

// 1. Retrieve all blocks since the very beginning
// 2. Get events by their hashes
// 3. Look for "Contracts::Instantiated" event
// 4. Grab the contract's address from it
//
// Similar to the code from this issue:
// https://github.com/polkadot-js/api/issues/578
//
// Just subscribe to new events is not enough, because UI most probably will
// start after the contract is instantiated (because it is being instantiated
// immediately with the Node startup)

    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header) => {
        // Get last block number, scan all before it
        console.log(`Block #${header.number}`);
        unsubscribe();
    }); 
}

main().catch(console.error);
