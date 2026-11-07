# The staging environment on the team server. Reached from the root as `make staging/<target>`.
#
# Not a project in the root Makefile's PROJECTS: `make up`, `make run-guardrails` and the rest
# never touch it. deploy-staging.yml calls `deploy`; the others are for a person on the server.
#
# Deliberately no `%:` catch-all (unlike backend/, frontend/, acceptance-tests/): a typo'd target
# here should fail, not silently succeed.

.DEFAULT_GOAL := help

.PHONY: help deploy ps logs down

STAGING_ENV_FILE ?= /home/github-runner/cablan-staging.env
COMPOSE = docker compose -f compose.yml --env-file $(STAGING_ENV_FILE)

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

# `up --wait` runs before any cleanup, so a stack that fails to become healthy within 5 minutes
# fails this target (and the workflow) with the old images still on disk. Cleanup then removes this
# stack's other tags, so each promotion doesn't leave two more images behind; the image names come
# from Compose itself, never from sourcing the env file as shell.
deploy: ## Pull and start the images tagged IMAGE_TAG (required), then remove older tags
	@test -n "$(IMAGE_TAG)" || { echo "IMAGE_TAG is required, e.g. make deploy IMAGE_TAG=abc1234" >&2; exit 1; }
	IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE) pull
	IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE) up -d --wait --wait-timeout 300 --remove-orphans
	@for repo in $$(IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE) config --images | grep -v '^postgres:' | sed 's/:[^:]*$$//'); do \
		docker image ls "$$repo" --format '{{.Repository}}:{{.Tag}}' \
			| grep -v ":$(IMAGE_TAG)$$" | xargs -r docker image rm || true; \
	done
	@# Dangling images only, but server-wide — harmless to the other projects on this host.
	docker image prune -f

ps: ## Show the staging containers
	IMAGE_TAG=unused $(COMPOSE) ps

logs: ## Tail the staging containers' logs
	IMAGE_TAG=unused $(COMPOSE) logs -f --tail=200

# Never `down -v`: the volume is staging's persistent data.
down: ## Stop staging (keeps its database)
	IMAGE_TAG=unused $(COMPOSE) down
