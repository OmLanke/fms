# Deployment Guide

## Table of Contents

- [Docker Compose (Production)](#docker-compose-production)
- [Kubernetes](#kubernetes)
- [KEDA Autoscaling](#keda-autoscaling)
- [Rolling Updates and Rollbacks](#rolling-updates-and-rollbacks)
- [Monitoring in Production](#monitoring-in-production)
- [Database Backup and Restore](#database-backup-and-restore)

---

## Docker Compose (Production)

Docker Compose production mode uses `docker-compose.prod.yml` which removes dev-only services (Mailpit, Mongo Express, Redpanda Console) and enables TLS through NGINX.

### 1. Prepare environment

```bash
cp .env.example .env
# Edit .env with production values:
#   - Strong JWT_SECRET (min 64 chars)
#   - Secure POSTGRES_PASSWORD, MONGO_INITDB_ROOT_PASSWORD, REDIS_PASSWORD
#   - Real STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
#   - Production SMTP settings (replace Mailpit with real SMTP)
#   - Set EMAIL_FROM to your domain
nano .env
```

### 2. Build images

```bash
make build
# Equivalent to: docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### 3. Start the stack

```bash
make prod-up
# Equivalent to: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4. Verify health

```bash
make health
```

### NGINX TLS Termination

Create `/etc/nginx/conf.d/ticketflow.conf`:

```nginx
upstream ticketflow_gateway {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name tickets.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tickets.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/tickets.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tickets.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://ticketflow_gateway;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Obtain a certificate with Certbot:

```bash
certbot --nginx -d tickets.yourdomain.com
```

---

## Kubernetes

Two sub-sections below: **Local (OrbStack / Docker Desktop)** for development on a single machine, and **Production cluster** for a real environment.

---

### Local Kubernetes (OrbStack / Docker Desktop)

This is the tested path for running the full stack on a single developer machine. All images are built locally; no registry is required.

#### Prerequisites

| Tool | Install |
|---|---|
| OrbStack or Docker Desktop | [orbstack.dev](https://orbstack.dev) — enable Kubernetes in settings |
| `kubectl` | bundled with OrbStack; or `brew install kubectl` |
| `make` | `brew install make` |
| `docker` | bundled with OrbStack / Docker Desktop |

> **Memory:** The full stack needs approximately 6–7 GB of RAM allocated to the VM. On an 8 GB machine this leaves very little headroom. See [Memory-constrained startup](#memory-constrained-startup) below.

#### 1. Build all images locally

```bash
make k8s-build
# Builds: gateway, user-service, event-service, booking-service,
#         inventory-service, payment-service, notification-service, frontend
```

All images are tagged `ticketflow/<service>:latest` and stored in the local Docker daemon that the cluster already uses — no push needed.

#### 2. Apply the namespace and secrets

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets/
```

#### 3. Deploy infrastructure (ordered)

Infra services must be healthy before app services start. Deploy and wait for each layer:

```bash
# Persistent stores and message broker
kubectl apply -f k8s/infra/ -n ticketflow --recursive

# Wait for the critical path: ZooKeeper → Kafka → Postgres → MongoDB → Redis
kubectl wait --for=condition=ready pod/zookeeper-0 -n ticketflow --timeout=120s
kubectl wait --for=condition=ready pod/kafka-0      -n ticketflow --timeout=120s
kubectl wait --for=condition=ready pod/postgres-0   -n ticketflow --timeout=120s
kubectl wait --for=condition=ready pod/mongodb-0    -n ticketflow --timeout=120s
kubectl wait --for=condition=ready pod/redis-0      -n ticketflow --timeout=120s
```

#### 4. Deploy application services

```bash
kubectl apply -f k8s/apps/ -n ticketflow --recursive
```

#### 5. Deploy monitoring (optional)

```bash
kubectl apply -f k8s/monitoring/ -n ticketflow --recursive
```

#### 6. Seed demo data

```bash
kubectl exec -n ticketflow deployment/event-service -- python -m app.seed
```

Demo credentials: `test@ticketflow.dev` / `Test1234!`

#### 7. Verify

```bash
make health
# All six services should report "up"
```

#### Accessing the stack

All user-facing services are exposed as **NodePort** — no port-forwarding needed.

**Application**

| Service | URL | NodePort |
|---|---|---|
| Frontend (React) | http://localhost:30080 | 30080 → pod:80 |
| API Gateway | http://localhost:30000 | 30000 → pod:3000 |

**Observability**

| Tool | URL | NodePort | Credentials |
|---|---|---|---|
| Grafana | http://localhost:30030 | 30030 → pod:3000 | admin / admin |
| Prometheus | http://localhost:30090 | 30090 → pod:9090 | — |
| Jaeger | http://localhost:30686 | 30686 → pod:16686 | — |

Loki is internal-only (scraped by Grafana automatically via the provisioned datasource — use **Explore → Loki** in Grafana to query logs).

#### Memory-constrained startup

On a machine with ≤ 8 GB RAM, deploying all services at once can OOM the cluster VM. To avoid this:

1. Deploy and wait for infra first (step 3 above).
2. Then deploy app services (step 4). If pods are `Pending` with `Insufficient memory`, the HPAs have scaled to 2 replicas. Patch them all down to 1:

```bash
for svc in booking-service user-service event-service gateway inventory-service; do
  kubectl patch hpa $svc -n ticketflow --type=merge -p '{"spec":{"minReplicas":1}}'
done
kubectl scale deployment \
  booking-service user-service event-service gateway \
  inventory-service payment-service notification-service frontend \
  -n ticketflow --replicas=1
```

#### Kafka cluster ID mismatch after hard restart

If the cluster VM is restarted (OOM kill, `orbctl stop`, etc.), Kafka will fail with:

```
Fatal error: Invalid cluster.id … Expected X, but read Y
```

ZooKeeper reinitialised with a new cluster ID but the Kafka PVC still has the old one. Fix:

```bash
kubectl scale statefulset kafka zookeeper -n ticketflow --replicas=0
kubectl delete pvc kafka-data-kafka-0 zookeeper-data-zookeeper-0 -n ticketflow
kubectl scale statefulset zookeeper -n ticketflow --replicas=1
kubectl wait --for=condition=ready pod/zookeeper-0 -n ticketflow --timeout=60s
kubectl scale statefulset kafka -n ticketflow --replicas=1
kubectl wait --for=condition=ready pod/kafka-0 -n ticketflow --timeout=90s
```

Then restart any app pods that started before Kafka was ready:

```bash
kubectl rollout restart deployment \
  booking-service event-service inventory-service payment-service \
  notification-service -n ticketflow
```

---

### Production cluster

#### Prerequisites

| Tool | Install |
|---|---|
| `kubectl` | [kubernetes.io/docs](https://kubernetes.io/docs/tasks/tools/) |
| `helm` | `brew install helm` |
| KEDA operator | Installed via Helm (see below) |
| Container registry | Docker Hub, GCR, ECR, or GHCR |

#### 1. Install KEDA

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm install keda kedacore/keda \
  --namespace keda \
  --create-namespace
```

Verify:

```bash
kubectl get pods -n keda
```

#### 2. Create the namespace and secrets

```bash
kubectl apply -f k8s/namespace.yaml
cp k8s/secrets/app-secrets.yaml.example k8s/secrets/app-secrets.yaml
# Edit k8s/secrets/app-secrets.yaml with production values (base64-encoded)
kubectl apply -f k8s/secrets/
```

Encode a value:

```bash
echo -n "your-secret-value" | base64
```

#### 3. Push images to a registry

```bash
# Tag and push (replace <registry> with your registry prefix)
for svc in gateway user-service event-service booking-service \
            inventory-service payment-service notification-service frontend; do
  docker tag ticketflow/$svc:latest <registry>/ticketflow-$svc:latest
  docker push <registry>/ticketflow-$svc:latest
done
```

Update image references in the manifests:

```bash
find k8s/ -name "deployment.yaml" \
  -exec sed -i 's|image: ticketflow/|image: <registry>/ticketflow-|g' {} +
```

#### 4. Deploy

```bash
make k8s-apply
```

#### 5. Expose via Ingress

Change the `frontend` and `gateway` services back to `ClusterIP` for production (NodePort is only appropriate locally), then apply an Ingress. Install cert-manager if not present:

```bash
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

Example Ingress (edit hostnames):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ticketflow
  namespace: ticketflow
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts: [tickets.yourdomain.com, api.yourdomain.com]
      secretName: ticketflow-tls
  rules:
    - host: tickets.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: frontend, port: { number: 80 } }
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: gateway, port: { number: 3000 } }
```

---

## KEDA Autoscaling

KEDA ScaledObjects are defined in `k8s/keda/scaledobjects.yaml`. Each application service that consumes Kafka has a ScaledObject:

```yaml
# Example: booking-service ScaledObject
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: booking-service-scaler
  namespace: ticketflow
spec:
  scaleTargetRef:
    name: booking-service
  minReplicaCount: 1
  maxReplicaCount: 10
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        consumerGroup: booking-service
        topic: ticketflow.seats.locked
        lagThreshold: "50"
        offsetResetPolicy: latest
```

### How it works

1. KEDA polls the Kafka consumer group lag every 30 seconds.
2. If lag on `ticketflow.seats.locked` exceeds 50 messages, KEDA adds replicas.
3. New replicas join the `booking-service` consumer group and Kafka redistributes partitions.
4. As lag drops, KEDA scales down to `minReplicaCount`.

### Viewing ScaledObjects

```bash
kubectl get scaledobjects -n ticketflow
kubectl describe scaledobject booking-service-scaler -n ticketflow
```

---

## Rolling Updates and Rollbacks

### Update a service

1. Build and push a new image:

```bash
docker build -t yourreg/ticketflow-booking-service:v1.2.0 services/booking-service/
docker push yourreg/ticketflow-booking-service:v1.2.0
```

2. Update the image in the deployment:

```bash
kubectl set image deployment/booking-service \
  booking-service=yourreg/ticketflow-booking-service:v1.2.0 \
  -n ticketflow
```

3. Monitor the rollout:

```bash
kubectl rollout status deployment/booking-service -n ticketflow
```

### Rollback

```bash
# Rollback to the previous version
kubectl rollout undo deployment/booking-service -n ticketflow

# Rollback to a specific revision
kubectl rollout history deployment/booking-service -n ticketflow
kubectl rollout undo deployment/booking-service --to-revision=3 -n ticketflow
```

### Zero-downtime strategy

All deployments use `RollingUpdate` strategy with:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

This ensures at least one healthy pod is running throughout the update.

---

## Monitoring in Production

### Prometheus

Prometheus scrapes metrics from all services via annotations:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"
```

Access: http://localhost:30090

### Grafana

Pre-built dashboards available at `infra/grafana/dashboards/`:

- `overview.json` — platform-wide health: request rate, error rate, saga throughput.
- `booking-saga.json` — saga step latencies, failure rates per step.
- `kafka.json` — consumer group lag per topic.
- `jvm.json` — JVM heap, GC, thread count (Java services).
- `python.json` — Python process memory, CPU, event loop lag.

Access: http://localhost:30030 (admin / admin)

Import dashboards: **Dashboards → Import → Upload JSON file**

### Jaeger

Trace a booking end-to-end:

```
http://localhost:30686
# Search by Service: "gateway", Operation: "POST /api/bookings"
# The trace shows spans across: gateway → booking-service → kafka → inventory-service → payment-service → notification-service
```

### Viewing logs

```bash
# Tail logs for a service
kubectl logs -f deployment/booking-service -n ticketflow

# Last 100 lines
kubectl logs --tail=100 deployment/payment-service -n ticketflow

# All pods in a deployment
kubectl logs -f -l app=booking-service -n ticketflow

# Query logs in Grafana Loki (no port-forward needed)
# Open http://localhost:30030 → Explore → Loki → {app="booking-service"} |= "ERROR"
```

---

## Database Backup and Restore

### PostgreSQL

```bash
# Backup
kubectl exec -n ticketflow deployment/postgres -- \
  pg_dumpall -U ticketflow > backup-$(date +%Y%m%d).sql

# Restore
kubectl exec -i -n ticketflow deployment/postgres -- \
  psql -U ticketflow < backup-20240101.sql
```

### MongoDB

```bash
# Backup
kubectl exec -n ticketflow deployment/mongodb -- \
  mongodump --uri="mongodb://ticketflow:$MONGO_PASSWORD@localhost:27017" \
  --archive > mongo-backup-$(date +%Y%m%d).archive

# Restore
kubectl exec -i -n ticketflow deployment/mongodb -- \
  mongorestore --uri="mongodb://ticketflow:$MONGO_PASSWORD@localhost:27017" \
  --archive < mongo-backup-20240101.archive
```

### Automated backup with CronJob

A Kubernetes CronJob for daily backups is provided in `k8s/infrastructure/backup-cronjob.yaml`. It runs at 02:00 UTC and uploads backups to an S3-compatible bucket.
