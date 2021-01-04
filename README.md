# WiV Supply Chain - Client

A web user interface for Substrate-based WiV Supply Chain

The WiV Supply Chain Pallet allows users to securely collect and store information about each unique asset’s provenance and transaction history, whilst holding and insuring the unique asset in a professionally managed storage facility.
In the current version a normal user can make:
- Signup (settings 24 words secret seed)
- Login (using a password set in the signup)
- Logout (to remove any trace from the browser)
- Add Assets (write a new assets in the blockchain, subject to approval from "Admin")
- Transfer Assets (once it has been approved from Admin as valid asset)

## Running the UI

### Run project with Docker

The simplest way to try it out:

```sh
docker run --rm -it --net host wivt/supply-chain-ui:latest
```

Make sure that you have launched the node itself:

```sh
docker run --rm -it --net host wivt/supply-chain:latest
```

If you want to persist keys and logs, then bind `wivkeys` and `wivlogs` directories:
```sh
docker run --rm -it --net host \
    -v /tmp/wivlogs:/wivlogs:Z \
    -v /tmp/wivkeys:/wivkeys:Z \
    wivt/supply-chain-ui:latest
```

Here, `:Z` suffix is necessary only for systems enabling SELinux.

### Run project from sources

You don't need to perform these steps if you have launched the project with Docker.
But if you want to hack on base of it, then you are welcome.

Install [Node.js](https://nodejs.org/en/download/).
Install [Yarn](https://yarnpkg.com/lang/en/docs/install/).
Install [Ipfs](https://ipfs.io).
Install [Mysql Server](https://www.mysql.org) and configure an user: root password: Aszxqw1234 enabled to create database. 
The app will create the required database and tables.

Install dependencies from the project's folder with the following command:

```sh
yarn install
```

#### Usage
Run the local web server:

```sh
node index.js
```

Once the front-end server is running direct your browser to this URL:
http://localhost:3000

The Node generate a few accounts with active deposit that are required to make and blockchain writing.
You can use the following "well-know" accounts for testing:

username: Alice
secret seed: bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice
account: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

username: Bob
secret seed: bottom drive obey lake curtain smoke basket hold race lonely fit walk//Bob
account: 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty

username: Admin
secret seed: bottom drive obey lake curtain smoke basket hold race lonely fit walk//Admin
account: 
Admin is the super user enabled to approve the new assets. An asset cannot be transferred when the approval is pending.

**** Please use exactly the secret seeds above, in the signup form ***
