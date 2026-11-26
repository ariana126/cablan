.DEFAULT_GOAL := help

.PHONY: help setup up down restart build logs ps sh run render-living-documentation open-living-documentation npm lint fix-lint format fix-format typecheck

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-28s\033[0m %s\n", $$1, $$2}'

setup: ## Create .env from .env.example if it doesn't exist yet
	@[ -f .env ] || cp .env.example .env

up: setup ## Build (if needed) and start the container in the background
	@if [ -n "$(CABLAN_HEAVY_CHECKS_IN_CI)" ]; then echo "Skipping the acceptance suite container: it runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set)."; exit 0; fi; echo "docker compose up --build -d"; docker compose up --build -d

down: ## Stop and remove the container
	docker compose down

restart: down up ## Restart the stack

build: setup ## Rebuild the image (only the light-check image when CABLAN_HEAVY_CHECKS_IN_CI is set)
	@if [ -n "$(CABLAN_HEAVY_CHECKS_IN_CI)" ]; then echo "docker compose --profile check build check"; docker compose --profile check build check; else echo "docker compose build"; docker compose build; fi

logs: ## Tail logs from the container
	docker compose logs -f

ps: ## Show container status
	docker compose ps

sh: ## Open a shell in the container
	docker compose exec app bash

run: ## Run the BDD acceptance suite (requires the backend and frontend test stacks to be running)
	@if [ -n "$(CABLAN_HEAVY_CHECKS_IN_CI)" ]; then echo "make $@ runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set). Dispatch CI on your wip branch: gh workflow run ci.yml --ref wip/<slug>. To run it here anyway: CABLAN_HEAVY_CHECKS_IN_CI= make $@" >&2; exit 1; fi
	docker compose exec app npm test

render-living-documentation: ## Render the living documentation from the last run into target/site/serenity
	@if [ -n "$(CABLAN_HEAVY_CHECKS_IN_CI)" ]; then echo "make $@ runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set). Dispatch CI on your wip branch: gh workflow run ci.yml --ref wip/<slug>. To run it here anyway: CABLAN_HEAVY_CHECKS_IN_CI= make $@" >&2; exit 1; fi
	docker compose exec app npm run report

# The only target that runs on the host rather than in a container: a browser can't be
# launched from inside one. target/ is bind-mounted, so the rendered site is right there.
# A recipe line, not a prerequisite, so rendering always finishes before opening (-j would
# be free to run prerequisites in parallel).
open-living-documentation: ## Render the living documentation and open it in the browser
	@if [ -n "$(CABLAN_HEAVY_CHECKS_IN_CI)" ]; then echo "make $@ runs in GitHub Actions on this machine (CABLAN_HEAVY_CHECKS_IN_CI is set). Dispatch CI on your wip branch: gh workflow run ci.yml --ref wip/<slug>. To run it here anyway: CABLAN_HEAVY_CHECKS_IN_CI= make $@" >&2; exit 1; fi
	@$(MAKE) render-living-documentation
	@(xdg-open target/site/serenity/index.html || open target/site/serenity/index.html) >/dev/null 2>&1

npm: ## Run any package.json script in the container. Usage: make npm test
	docker compose exec app npm run $(filter-out $@,$(MAKECMDGOALS))

lint: setup ## ESLint check (read-only, no changes)
	docker compose run --rm check npm run lint

fix-lint: setup ## ESLint + auto-fix
	docker compose run --rm check npm run lint:fix

format: setup ## Prettier check (read-only, no changes)
	docker compose run --rm check npm run format

fix-format: setup ## Prettier auto-format
	docker compose run --rm check npm run format:fix

typecheck: setup ## TypeScript check (read-only)
	docker compose run --rm check npx tsc --noEmit

%:
	@:
