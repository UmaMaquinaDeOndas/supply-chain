IMAGE ?= supply-chain-ui
IMAGE_DEV ?= $(IMAGE)-dev

DOCKER ?= docker #you can use "podman" as well

.PHONY: init
init:
	yarn install

.PHONY: run
run:
	yarn start

.PHONY: build
build:
	yarn build

.PHONY: build-necessary
build-prod:
	yarn install --production --ignore-optional
	yarn build-essential

.PHONY: release
release:
	@$(DOCKER) build --no-cache --squash -t $(IMAGE) .

.PHONY: dev-docker-build
dev-docker-build:
	@$(DOCKER) build -t $(IMAGE_DEV) .

.PHONY: dev-docker-run
dev-docker-run:
	@$(DOCKER) run --net=host -it --rm $(IMAGE_DEV)

.PHONY: dev-docker-inspect
dev-docker-inspect:
	@$(DOCKER) run --net=host -it --rm --entrypoint /bin/ash $(IMAGE_DEV)
