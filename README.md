# WiV Supply Chain - Client

A web user interface for Substrate-based WiV Supply Chain

The WiV Supply Chain Pallet allows users to securely collect and store information about each unique asset’s provenance and transaction history, whilst holding and insuring the unique asset in a professionally managed storage facility.

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
