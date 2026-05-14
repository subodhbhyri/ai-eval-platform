# Kubernetes deployment — AI Eval Platform

The frontend is deployed to Vercel and needs no Kubernetes manifests.
These manifests cover the backend, Redis, and Prometheus.

## Prerequisites

### kubectl
```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Windows (winget)
winget install Kubernetes.kubectl
```

### Local cluster (pick one)

**kind** (recommended for CI):
```bash
brew install kind          # macOS
kind create cluster --name ai-eval
```

**minikube** (recommended for local dev with metrics-server):
```bash
brew install minikube      # macOS
minikube start
minikube addons enable metrics-server   # required for HPA
```

## Apply all manifests

```bash
kubectl apply -f k8s/
```

Manifests are applied in alphabetical order. `namespace.yaml` sorts first, so
the `ai-eval` namespace exists before any namespaced resources are created.

## Set real secret values

**Do not commit real credentials to `k8s/secrets.yaml`.**

Create the secret directly with kubectl instead:

```bash
kubectl create secret generic ai-eval-secrets \
  --from-literal=database-url="postgresql+asyncpg://user:pass@host:5432/eval_dashboard" \
  --from-literal=redis-url="redis://redis:6379/0" \
  --from-literal=anthropic-api-key="sk-ant-..." \
  --from-literal=openai-api-key="sk-..." \
  --from-literal=google-api-key="AIza..." \
  --from-literal=kafka-bootstrap-servers="pkc-xxx.region.provider.confluent.cloud:9092" \
  --from-literal=kafka-sasl-username="<api-key>" \
  --from-literal=kafka-sasl-password="<api-secret>" \
  --namespace=ai-eval \
  --dry-run=client -o yaml | kubectl apply -f -
```

The `--dry-run=client -o yaml | kubectl apply -f -` pattern lets you re-run
the command to update the secret without hitting the "already exists" error.

## Port-forward for local testing

Backend API:
```bash
kubectl port-forward svc/ai-eval-backend 8000:80 -n ai-eval
# API now available at http://localhost:8000
```

Prometheus:
```bash
kubectl port-forward svc/prometheus 9090:9090 -n ai-eval
# UI at http://localhost:9090
```

## Deploy a new image

```bash
kubectl set image deployment/ai-eval-backend \
  backend=ghcr.io/subodhbhyri/ai-eval-platform/backend:<new-tag> \
  -n ai-eval
kubectl rollout status deployment/ai-eval-backend -n ai-eval
```

## Check HPA status

The HPA requires metrics-server to be running (enabled automatically on
minikube with the addon above; installed separately on most managed clusters).

```bash
kubectl get hpa -n ai-eval
kubectl describe hpa ai-eval-backend -n ai-eval
```

## Tear down

```bash
kubectl delete namespace ai-eval   # removes everything in the namespace
```
