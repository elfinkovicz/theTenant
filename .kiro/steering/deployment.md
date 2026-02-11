---
inclusion: manual
---
# Deployment

## deploy.py (Hauptwerkzeug)

```powershell
python deploy.py              # Full Deployment
python deploy.py --frontend   # Nur React Build + S3 + CloudFront
python deploy.py --infrastructure  # Nur Terraform
python deploy.py --billing    # Nur Billing-System
python deploy.py --crosspost  # Nur Crosspost-Lambdas
```

### Was passiert
1. Lambda Layer bauen (shared deps)
2. Lambda ZIPs erstellen (ohne node_modules)
3. Terraform apply
4. Frontend Build (Vite)
5. S3 Upload + CloudFront Invalidation

## Typischer Workflow
```powershell
# Frontend-Änderungen
python deploy.py --frontend

# Lambda-Änderungen
python deploy.py --infrastructure

# Crosspost-Lambdas
python deploy.py --crosspost
python deploy.py --infrastructure
```

## Manuelles Terraform (falls nötig)
```powershell
cd viraltenant-infrastructure
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

## Umgebungen
- Production: `viraltenant.com`, `*.viraltenant.com`, API: `api.viraltenant.com`

## Voraussetzungen
- Python 3.x, AWS CLI (Profil `viraltenant`), Terraform >= 1.0, Node.js

## Secrets
- `terraform.tfvars` (nicht committen!) oder `TF_VAR_*` Environment Variables
