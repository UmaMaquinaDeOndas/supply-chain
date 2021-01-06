# WiV Supply Chain - Client

A web user interface for Substrate-based WiV Supply Chain

The WiV Supply Chain Pallet allows users to securely collect and store information about each unique asset’s provenance and transaction history, whilst holding and insuring the unique asset in a professionally managed storage facility.
In the current version a normal user can make:
- Signup (settings 24 words secret seed)
- Login (using a password set in the signup)
- Logout (to remove any trace from the browser)
- Add Assets (write a new assets in the blockchain, subject to approval from "Admin")
- Transfer Assets (once it has been approved from Admin as valid asset)

## Testing Users

Accounts balances initialization is coming in next milestones. For now, you can use "well-known" accounts
for trying the application out. **Please, use one of the seeds bellow when you register a new user in the sign-up form**.
These accounts have active deposit which is necessary for submitting transactions.

username: Alice\
secret seed: bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice\
account: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY

username: Bob\
secret seed: bottom drive obey lake curtain smoke basket hold race lonely fit walk//Bob\
account: 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty

username: Admin\
secret seed: bottom drive obey lake curtain smoke basket hold race lonely fit walk//Admin\
account: 5Cqg641taJcn16MmReBn3uA8ENfY6ZgXKqwEaLACRXC9Z8Ne

*Admin is the super user enabled to approve the new assets.*\
An asset cannot be transferred when the approval is pending.

## Running the UI

### Run project with Docker

The simplest way to try it out is to install `Docker` with `docker-compose` and run:

```sh
make init && make start
```

Application data is persisted in a temporary folder `/tmp/wiv` and will be erased after reboot.

You can also use this file with `docker stack` instead of `docker-compose`.

In order to stop the application run:

```sh
make stop
```

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
