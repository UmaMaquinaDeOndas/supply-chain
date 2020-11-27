FROM node as builder

RUN mkdir build
COPY . /build
WORKDIR /build

RUN make build-prod

FROM joseluisq/static-web-server:1.11-alpine
COPY --from=builder /build/build /public

WORKDIR /
ENTRYPOINT ["/usr/local/bin/static-web-server"]
CMD ["--name", "'WiV Technologies Supply Chain UI'"]
