# ══════════════════════════════════════════════════════════════
#  TicketFlow Makefile
#  Usage: make <target>
# ══════════════════════════════════════════════════════════════

.PHONY: help dev dev-infra dev-stop build push deploy k8s-apply k8s-delete \
        logs health seed clean lint test

# Load .env if it exists
-include .env
export

COMPOSE_DEV    := docker compose -f docker-compose.dev.yml
COMPOSE_PROD   := docker compose -f docker-compose.yml
REGISTRY       ?= $(DOCKER_REGISTRY)
IMAGE_TAG      ?= latest
K8S_NAMESPACE  ?= ticketflow

# ─────────────────────────────────────────────
# HELP
# ─────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "  ████████╗██╗ ██████╗██╗  ██╗███████╗████████╗███████╗██╗      ██████╗ ██╗    ██╗"
	@echo "  ╚══██╔══╝██║██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝██╔════╝██║     ██╔═══██╗██║    ██║"
	@echo "     ██║   ██║██║     █████╔╝ █████╗     ██║   █████╗  ██║     ██║   ██║██║ █╗ ██║"
	@echo "     ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   ██╔══╝  ██║     ██║   ██║██║███╗██║"
	@echo "     ██║   ██║╚██████╗██║  ██╗███████╗   ██║   ██║     ███████╗╚██████╔╝╚███╔███╔╝"
	@echo "     ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝"
	@echo ""
	@echo "  Polyglot Microservice Architecture"
	@echo "  Java SpringBoot | Bun Elysia | Python FastAPI | PostgreSQL | MongoDB | Kafka"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "  \033[36m%-20s\033[0m %s\n", "Target", "Description"} \
		  /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ─────────────────────────────────────────────
# DEVELOPMENT
# ─────────────────────────────────────────────
setup: ## Copy .env.example to .env (first-time setup)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "  .env created from .env.example — please review and update values"; \
	else \
		echo "  .env already exists, skipping"; \
	fi

dev: ## Start full dev environment (infra + all services)
	$(COMPOSE_DEV) up --build -d
	@echo ""
	@echo "  Services starting..."
	@echo "  Gateway:        http://localhost:3000"
	@echo "  Frontend:       http://localhost:5173"
	@echo "  Kafka UI:       http://localhost:8080"
	@echo "  Mongo Express:  http://localhost:8081"
	@echo "  Mailpit:        http://localhost:8025"
	@echo ""
	@echo "  Run 'make logs' to follow logs, 'make health' to check service status"

dev-infra: ## Start only infrastructure (Postgres, MongoDB, Redis, Kafka)
	$(COMPOSE_DEV) up -d postgres mongodb redis zookeeper kafka kafka-init kafka-ui mongo-express mailpit
	@echo "Infrastructure started. Run 'make dev' to also start application services."

dev-stop: ## Stop dev environment
	$(COMPOSE_DEV) down

dev-clean: ## Stop dev environment and remove all volumes (DATA LOSS!)
	@echo "WARNING: This will delete all local data!"
	@read -p "Continue? [y/N] " ans; [ "$$ans" = "y" ] || exit 1
	$(COMPOSE_DEV) down -v

restart: ## Restart a specific service: make restart s=user-service
	$(COMPOSE_DEV) restart $(s)

rebuild: ## Rebuild and restart a specific service: make rebuild s=booking-service
	$(COMPOSE_DEV) up -d --build $(s)

# ─────────────────────────────────────────────
# LOGS
# ─────────────────────────────────────────────
logs: ## Follow logs from all services
	$(COMPOSE_DEV) logs -f --tail=100

logs-gateway: ## Follow gateway logs
	$(COMPOSE_DEV) logs -f --tail=100 gateway

logs-user: ## Follow user-service logs
	$(COMPOSE_DEV) logs -f --tail=100 user-service

logs-event: ## Follow event-service logs
	$(COMPOSE_DEV) logs -f --tail=100 event-service

logs-booking: ## Follow booking-service logs
	$(COMPOSE_DEV) logs -f --tail=100 booking-service

logs-inventory: ## Follow inventory-service logs
	$(COMPOSE_DEV) logs -f --tail=100 inventory-service

logs-payment: ## Follow payment-service logs
	$(COMPOSE_DEV) logs -f --tail=100 payment-service

logs-notification: ## Follow notification-service logs
	$(COMPOSE_DEV) logs -f --tail=100 notification-service

# ─────────────────────────────────────────────
# HEALTH CHECKS
# ─────────────────────────────────────────────
health: ## Check health of all services via gateway
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health/all | python3 -m json.tool 2>/dev/null || \
	 curl -s http://localhost:3000/health/all

health-individual: ## Check each service health individually
	@echo "Gateway:          " && curl -sf http://localhost:3000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"
	@echo "User Service:     " && curl -sf http://localhost:3001/api/users/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"
	@echo "Event Service:    " && curl -sf http://localhost:3002/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"
	@echo "Booking Service:  " && curl -sf http://localhost:3003/api/bookings/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"
	@echo "Inventory Service:" && curl -sf http://localhost:3004/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"
	@echo "Payment Service:  " && curl -sf http://localhost:3005/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"
	@echo "Notification:     " && curl -sf http://localhost:3006/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "DOWN"

# ─────────────────────────────────────────────
# DATABASE & SEED
# ─────────────────────────────────────────────
seed: ## Seed event-service with sample data (venues + events)
	$(COMPOSE_DEV) exec event-service python -m app.seed

psql-users: ## Open psql shell for users DB
	$(COMPOSE_DEV) exec postgres psql -U postgres ticketflow_users

psql-bookings: ## Open psql shell for bookings DB
	$(COMPOSE_DEV) exec postgres psql -U postgres ticketflow_bookings

psql-inventory: ## Open psql shell for inventory DB
	$(COMPOSE_DEV) exec postgres psql -U postgres ticketflow_inventory

mongo-shell: ## Open MongoDB shell
	$(COMPOSE_DEV) exec mongodb mongosh -u $(MONGO_USERNAME) -p $(MONGO_PASSWORD)

redis-cli: ## Open Redis CLI
	$(COMPOSE_DEV) exec redis redis-cli

# ─────────────────────────────────────────────
# KAFKA
# ─────────────────────────────────────────────
kafka-topics: ## List all Kafka topics
	$(COMPOSE_DEV) exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

kafka-topic-describe: ## Describe a topic: make kafka-topic-describe t=ticketflow.booking.initiated
	$(COMPOSE_DEV) exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic $(t)

kafka-consume: ## Consume messages from a topic: make kafka-consume t=ticketflow.booking.confirmed
	$(COMPOSE_DEV) exec kafka kafka-console-consumer.sh \
		--bootstrap-server localhost:9092 \
		--topic $(t) \
		--from-beginning \
		--property print.key=true \
		--property print.timestamp=true

kafka-groups: ## List Kafka consumer groups
	$(COMPOSE_DEV) exec kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

kafka-lag: ## Check consumer group lag: make kafka-lag g=booking-service
	$(COMPOSE_DEV) exec kafka kafka-consumer-groups.sh \
		--bootstrap-server localhost:9092 \
		--group $(g) \
		--describe

# ─────────────────────────────────────────────
# PRODUCTION BUILD
# ─────────────────────────────────────────────
build: ## Build all Docker images
	$(COMPOSE_PROD) build

build-push: ## Build and push all images to registry
	$(COMPOSE_PROD) build
	$(COMPOSE_PROD) push

prod-up: ## Start production environment
	$(COMPOSE_PROD) up -d

prod-down: ## Stop production environment
	$(COMPOSE_PROD) down

# ─────────────────────────────────────────────
# KUBERNETES
# ─────────────────────────────────────────────
k8s-namespace: ## Create Kubernetes namespace
	kubectl apply -f k8s/namespace.yaml

k8s-infra: ## Deploy infrastructure to Kubernetes
	kubectl apply -f k8s/infra/ -n $(K8S_NAMESPACE)

k8s-monitoring: ## Deploy monitoring stack to Kubernetes
	kubectl apply -f k8s/monitoring/ -n $(K8S_NAMESPACE) --recursive

k8s-services: ## Deploy all application services to Kubernetes
	kubectl apply -f k8s/configmaps/ -n $(K8S_NAMESPACE)
	kubectl apply -f k8s/secrets/ -n $(K8S_NAMESPACE)
	kubectl apply -f k8s/apps/ -n $(K8S_NAMESPACE) --recursive

k8s-keda: ## Deploy KEDA ScaledObjects
	kubectl apply -f k8s/keda/ -n $(K8S_NAMESPACE) --recursive

k8s-ingress: ## Deploy ingress
	kubectl apply -f k8s/ingress/ -n $(K8S_NAMESPACE) --recursive

k8s-apply: k8s-namespace k8s-infra k8s-monitoring k8s-services k8s-keda k8s-ingress ## Deploy everything to Kubernetes

k8s-delete: ## Delete all Kubernetes resources
	kubectl delete namespace $(K8S_NAMESPACE) --ignore-not-found

k8s-pods: ## List all pods in namespace
	kubectl get pods -n $(K8S_NAMESPACE)

k8s-logs: ## Follow pod logs: make k8s-logs pod=booking-service-xxx
	kubectl logs -f $(pod) -n $(K8S_NAMESPACE)

k8s-scale: ## Scale a deployment: make k8s-scale deploy=payment-service replicas=3
	kubectl scale deployment $(deploy) --replicas=$(replicas) -n $(K8S_NAMESPACE)

k8s-status: ## Show full cluster status for ticketflow namespace
	@echo "=== Deployments ==="
	kubectl get deployments -n $(K8S_NAMESPACE)
	@echo ""
	@echo "=== Pods ==="
	kubectl get pods -n $(K8S_NAMESPACE)
	@echo ""
	@echo "=== Services ==="
	kubectl get services -n $(K8S_NAMESPACE)
	@echo ""
	@echo "=== HPA ==="
	kubectl get hpa -n $(K8S_NAMESPACE)
	@echo ""
	@echo "=== ScaledObjects (KEDA) ==="
	kubectl get scaledobjects -n $(K8S_NAMESPACE) 2>/dev/null || echo "KEDA not installed"

# ─────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────
clean: ## Remove all build artifacts and node_modules
	@find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null; echo "Removed node_modules"
	@find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null; echo "Removed dist"
	@find . -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null; echo "Removed __pycache__"
	@find . -name "*.pyc" -delete 2>/dev/null; echo "Removed .pyc files"
	@find . -name "target" -type d -prune -exec rm -rf {} + 2>/dev/null; echo "Removed Maven target"

lint: ## Lint all services
	@echo "Linting Bun/TypeScript services..."
	@cd gateway && bun x tsc --noEmit 2>/dev/null && echo "  gateway: OK" || echo "  gateway: ERRORS"
	@cd services/inventory-service && bun x tsc --noEmit 2>/dev/null && echo "  inventory-service: OK" || echo "  inventory-service: ERRORS"
	@echo "Linting Python services..."
	@cd services/event-service && python -m py_compile app/main.py app/config.py 2>/dev/null && echo "  event-service: OK" || echo "  event-service: ERRORS"
	@cd services/payment-service && python -m py_compile app/main.py app/config.py 2>/dev/null && echo "  payment-service: OK" || echo "  payment-service: ERRORS"
	@cd services/notification-service && python -m py_compile app/main.py app/config.py 2>/dev/null && echo "  notification-service: OK" || echo "  notification-service: ERRORS"

test: ## Run all tests
	@echo "Running Java service tests..."
	@cd services/user-service && mvn test -q 2>/dev/null && echo "  user-service: OK" || echo "  user-service: FAILED"
	@cd services/booking-service && mvn test -q 2>/dev/null && echo "  booking-service: OK" || echo "  booking-service: FAILED"

# Quick demo: register user, create event, make booking
demo: ## Run a quick end-to-end demo via curl
	@bash scripts/demo.sh

.DEFAULT_GOAL := help
