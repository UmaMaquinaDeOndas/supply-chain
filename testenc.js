const {
  naclDecrypt,
  naclEncrypt,
  randomAsU8a
} = require('@polkadot/util-crypto');
const {
  stringToU8a,
  u8aToString
} = require('@polkadot/util');

async function main () {
  const secret = randomAsU8a();
  const messagePreEncryption = stringToU8a('super secret message');

    const secretv = randomAsU8a(32);
    const messagePreEncryptionv = stringToU8a('super secret message');
    console.log("secretv",secretv);
    const { x, y } = naclEncrypt(messagePreEncryptionv, secret);
    const { encrypted, nonce } = naclEncrypt(messagePreEncryptionv, secret);

    console.log(`Encrypted message: ${JSON.stringify(encrypted, null, 2)}`);
}

main().catch(console.error).finally(() => process.exit());