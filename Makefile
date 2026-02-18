.PHONY: help build up down restart logs logs-backend logs-frontend db-shell redis-shell backend-shell frontend-shell migrate seed clean status

# ============================================================================
# RQ.OS — Makefile
# ============================================================================

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# === Docker ===
build: ## Build all containers
	docker-compose build

up: ## Start all services
	docker-compose up -d

up-build: ## Build and start all services
	docker-compose up -d --build

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose down && docker-compose up -d

status: ## Show running containers
	docker-compose ps

# === Logs ===
logs: ## Follow all logs
	docker-compose logs -f

logs-backend: ## Follow backend logs
	docker-compose logs -f backend

logs-frontend: ## Follow frontend logs
	docker-compose logs -f frontend

logs-db: ## Follow database logs
	docker-compose logs -f db

# === Shell Access ===
backend-shell: ## Open shell in backend container
	docker-compose exec backend bash

frontend-shell: ## Open shell in frontend container
	docker-compose exec frontend sh

db-shell: ## Open PostgreSQL shell
	docker-compose exec db psql -U rqos -d rqos

redis-shell: ## Open Redis CLI
	docker-compose exec redis redis-cli

# === Database ===
migrate: ## Run Alembic migrations
	docker-compose exec backend alembic upgrade head

migrate-create: ## Create new migration (usage: make migrate-create msg="description")
	docker-compose exec backend alembic revision --autogenerate -m "$(msg)"

migrate-rollback: ## Rollback last migration
	docker-compose exec backend alembic downgrade -1

# === Development ===
install-frontend: ## Install frontend dependencies
	cd frontend && npm install

dev-frontend: ## Run frontend locally (without Docker)
	cd frontend && npm run dev

dev-backend: ## Run backend locally (without Docker)
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# === Cleanup ===
clean: ## Stop containers and remove volumes
	docker-compose down -v

clean-all: ## Full cleanup (containers, volumes, images)
	docker-compose down -v --rmi local

# === Quick Start ===
init: build up ## First time setup: build and start everything
	@echo ""
	@echo "========================================="
	@echo "  RQ.OS is running!"
	@echo "========================================="
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8000"
	@echo "  API Docs:  http://localhost:8000/docs"
	@echo "  Login:     admin@rqos.com / admin123"
	@echo "========================================="
