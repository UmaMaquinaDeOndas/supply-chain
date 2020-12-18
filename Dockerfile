FROM node as builder

RUN mkdir build
COPY . /build
WORKDIR /build

RUN make build-prod

FROM wivt/supply-chain-erc721:latest as contract

FROM joseluisq/static-web-server:1.11-alpine

COPY --from=builder /build/build /public
RUN mkdir /public/setup
COPY --from=contract /opt/erc721.contract /public/setup/erc721.contract

WORKDIR /
ENTRYPOINT ["/usr/local/bin/static-web-server"]
CMD ["--name", "'WiV Technologies Supply Chain UI'"]
