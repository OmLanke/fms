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

### Prerequisites

| Tool | Install |
|---|---|
| `kubectl` | [kubernetes.io/docs](https://kubernetes.io/docs/tasks/tools/) |
| `helm` | `brew install helm` |
| KEDA operator | Installed via Helm (see below) |
| Container registry | Docker Hub, GCR, ECR, or GHCR |

### 1. Install KEDA

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

### 2. Create the namespace

```bash
kubectl apply -f k8s/namespace.yaml
# Creates: ticketflow namespace
```

### 3. Configure secrets

Copy the secrets template and populate with production values:

```bash
cp k8s/secrets/app-secrets.yaml.example k8s/secrets/app-secrets.yaml
nano k8s/secrets/app-secrets.yaml
```

The file uses base64-encoded values:

```bash
# Encode a value:
echo -n "your-secret-value" | base64
```

Apply:

```bash
kubectl apply -f k8s/secrets/app-secrets.yaml
```

### 4. Update image registry

Edit the image field in each deployment manifest to point to your registry:

```bash
# Example: update all manifests to use your Docker Hub username
find k8s/ -name "deployment.yaml" \
  -exec sed -i 's|image: ticketflow/|image: yourdockerhubuser/ticketflow-|g' {} +
```

### 5. Deploy infrastructure

```bash
# Deploy Kafka, PostgreSQL, MongoDB, Redis
kubectl apply -f k8s/infrastructure/

# Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod \
  -l app=kafka \
  -n ticketflow \
  --timeout=120s
```

### 6. Deploy application services

```bash
make k8s-apply
# Equivalent to: kubectl apply -f k8s/ --recursive
```

Or deploy services individually:

```bash
kubectl apply -f k8s/gateway/
kubectl apply -f k8s/services/user-service/
kubectl apply -f k8s/services/event-service/
kubectl apply -f k8s/services/booking-service/
kubectl apply -f k8s/services/inventory-service/
kubectl apply -f k8s/services/payment-service/
kubectl apply -f k8s/services/notification-service/
```

### 7. Verify deployment

```bash
make k8s-status
# Equivalent to: kubectl get pods,services,deployments -n ticketflow
```

Expected output:

```
NAME                                    READY   STATUS    RESTARTS   AGE
pod/gateway-6b7d9c6d9f-xkj2p           1/1     Running   0          2m
pod/user-service-5c8d7b9c8f-pqr3s      1/1     Running   0          2m
pod/event-service-7f9c6d8b7f-lmn4t     1/1     Running   0          2m
pod/booking-service-8d6c7b5a9f-uvw5k   1/1     Running   0          2m
pod/inventory-service-4b9d8c7f6d-xyz6  1/1     Running   0          2m
pod/payment-service-3a8b7c6d5e-abc7    1/1     Running   0          2m
pod/notification-service-2b7c6d5f-def8 1/1     Running   0          2m
```

### 8. Accessing services in Kubernetes

#### Port-forward for local testing

```bash
# API Gateway
kubectl port-forward -n ticketflow svc/gateway 3000:3000

# Grafana
kubectl port-forward -n ticketflow svc/grafana 3010:3000

# Jaeger
kubectl port-forward -n ticketflow svc/jaeger 16686:16686
```

#### Production Ingress

Apply the Ingress resource (edit the hostname first):

```bash
kubectl apply -f k8s/ingress.yaml
```

The Ingress uses `cert-manager` for automatic TLS. Install cert-manager if not present:

```bash
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
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

Access:

```bash
kubectl port-forward -n ticketflow svc/prometheus 9090:9090
```

### Grafana

Pre-built dashboards available at `infra/grafana/dashboards/`:

- `overview.json` — platform-wide health: request rate, error rate, saga throughput.
- `booking-saga.json` — saga step latencies, failure rates per step.
- `kafka.json` — consumer group lag per topic.
- `jvm.json` — JVM heap, GC, thread count (Java services).
- `python.json` — Python process memory, CPU, event loop lag.

Import dashboards:

```bash
kubectl port-forward -n ticketflow svc/grafana 3010:3000
# Open http://localhost:3010
# Dashboards → Import → Upload JSON file
```

### Jaeger

Trace a booking end-to-end:

```bash
kubectl port-forward -n ticketflow svc/jaeger 16686:16686
# Open http://localhost:16686
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

# Query logs in Grafana Loki
kubectl port-forward -n ticketflow svc/grafana 3010:3000
# Explore → Loki → {app="booking-service"} |= "ERROR"
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
