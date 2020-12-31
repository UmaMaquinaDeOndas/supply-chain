IMAGE ?= supply-chain-ui
IMAGE_DEV ?= $(IMAGE)-dev

DOCKER ?= docker #you can use "podman" as well

.PHONY: init
init:
	yarn install

.PHONY: run
run:
	node index.js

.PHONY: release
release:
	@$(DOCKER) build --no-cache --squash -t $(IMAGE) .

.PHONY: dev-docker-build
dev-docker-build:
	@$(DOCKER) build -t $(IMAGE_DEV) .

.PHONY: dev-docker-run
dev-docker-run:
	@$(DOCKER) run -v /tmp/wivkeys:/wivkeys:Z \
        -v /tmp/wivlogs:/wivlogs:Z \
        --net=host -it --rm \
        $(IMAGE_DEV)

.PHONY: dev-docker-inspect
dev-docker-inspect:
	@$(DOCKER) run --net=host -it --rm --entrypoint /bin/ash $(IMAGE_DEV)
