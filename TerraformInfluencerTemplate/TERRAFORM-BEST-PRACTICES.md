# Terraform Best Practices für dieses Projekt

## Problem: Unnötige Ressourcen-Neuerststellungen

Bei jedem `terraform apply` werden viele Ressourcen unnötig neu erstellt oder aktualisiert. Dies führt zu:
- Längeren Deployment-Zeiten
- Potenziellen Ausfallzeiten
- Datenverlust bei S3 Buckets
- Unnötigen Kosten

## Lösungen

### 1. S3 Buckets schützen

**Problem:** S3 Buckets werden neu erstellt, was alle Inhalte löscht.

**Lösung:** `lifecycle`-Blöcke mit `prevent_destroy` und `ignore_changes` hinzufügen:

```hcl
resource "aws_s3_bucket" "website" {
  bucket = "${var.project_name}-website-${data.aws_caller_identity.current.account_id}"
  
  lifecycle {
    prevent_destroy = true
    ignore_changes = [tags, tags_all, bucket]
  }
}
```

**Bereits geschützt:**
- ✅ `modules/s3-website/main.tf` - Website Bucket
- ✅ `modules/shop/main.tf` - Product Images Bucket  
- ✅ `modules/sponsor-system/main.tf` - Sponsor Assets Bucket

### 2. Lambda-Funktionen: Source Code Hash

**Problem:** Lambda-Funktionen werden bei jedem Apply aktualisiert, auch wenn sich der Code nicht geändert hat.

**Ursache:** 
- `archive_file` data source erstellt bei jedem Run einen neuen Hash
- Timestamps in ZIP-Dateien ändern sich
- Whitespace-Änderungen in inline Code

**Lösung 1:** `ignore_changes` für `source_code_hash`:

```hcl
resource "aws_lambda_function" "example" {
  # ... andere Konfiguration ...
  
  lifecycle {
    ignore_changes = [source_code_hash, last_modified]
  }
}
```

**Lösung 2:** Externe ZIP-Dateien mit festem Hash verwenden (besser für Production):

```hcl
resource "aws_lambda_function" "example" {
  filename         = "${path.module}/lambda/function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/function.zip")
  
  # Nur aktualisieren wenn ZIP sich ändert
}
```

### 3. DynamoDB Tables

**Problem:** Tables werden neu erstellt bei Konfigurationsänderungen.

**Lösung:** `prevent_destroy` hinzufügen:

```hcl
resource "aws_dynamodb_table" "example" {
  # ... Konfiguration ...
  
  lifecycle {
    prevent_destroy = true
    ignore_changes = [tags, tags_all]
  }
}
```

### 4. Cognito User Pools

**Problem:** User Pool wird neu erstellt, alle Benutzer gehen verloren.

**Lösung:** `prevent_destroy` und `ignore_changes`:

```hcl
resource "aws_cognito_user_pool" "main" {
  # ... Konfiguration ...
  
  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      tags,
      tags_all,
      schema,  # Schema kann nicht geändert werden
      email_configuration  # Oft nur Formatierung
    ]
  }
}
```

### 5. IVS Channels

**Problem:** IVS Channel wird neu erstellt, Stream Key ändert sich.

**Lösung:**

```hcl
resource "aws_ivs_channel" "main" {
  # ... Konfiguration ...
  
  lifecycle {
    prevent_destroy = true
    ignore_changes = [tags, tags_all]
  }
}
```

## Deployment-Workflow

### Vor jedem Apply:

1. **Plan erstellen und prüfen:**
   ```bash
   cd TerraformInfluencerTemplate
   terraform plan -var-file="clients/honigwabe/terraform.tfvars" -out=tfplan
   ```

2. **Plan analysieren:**
   - Suche nach `must be replaced` (🚨 KRITISCH!)
   - Suche nach `will be destroyed` (🚨 KRITISCH!)
   - Prüfe `will be created` (meist OK)
   - Prüfe `will be updated in-place` (meist OK)

3. **Kritische Ressourcen identifizieren:**
   ```bash
   # Zeige nur kritische Änderungen
   terraform plan -var-file="clients/honigwabe/terraform.tfvars" 2>&1 | findstr /C:"must be replaced" /C:"will be destroyed"
   ```

4. **Bei kritischen Änderungen:**
   - ❌ NICHT apply ausführen!
   - Prüfe warum die Ressource neu erstellt wird
   - Füge `lifecycle`-Blöcke hinzu
   - Erstelle neuen Plan

### Safe Apply:

```bash
# Nur wenn Plan sicher ist:
terraform apply tfplan
```

## Häufige Ursachen für Neuerststellungen

### 1. Bucket Name ändert sich
```hcl
# FALSCH:
bucket = "${var.project_name}-${random_id.bucket.hex}"

# RICHTIG:
bucket = "${var.project_name}-website-${data.aws_caller_identity.current.account_id}"

# Mit Schutz:
lifecycle {
  ignore_changes = [bucket]
}
```

### 2. Inline Lambda Code
```hcl
# PROBLEM: Bei jedem Apply neuer Hash
data "archive_file" "lambda" {
  type = "zip"
  source {
    content  = <<-EOT
      // Code hier
    EOT
    filename = "index.js"
  }
}

# LÖSUNG: Externe Datei oder ignore_changes
```

### 3. Tags ändern sich
```hcl
# Immer hinzufügen:
lifecycle {
  ignore_changes = [tags, tags_all]
}
```

### 4. Computed Values
```hcl
# PROBLEM: Wert ändert sich bei jedem Run
domain_name = aws_s3_bucket.website.bucket_regional_domain_name

# LÖSUNG: ignore_changes oder fester Wert
```

## Notfall: Ressource aus State entfernen

Wenn eine Ressource fälschlicherweise neu erstellt werden soll:

```bash
# 1. Aus State entfernen (Ressource bleibt in AWS!)
terraform state rm module.website.aws_s3_bucket.website

# 2. Neu importieren
terraform import module.website.aws_s3_bucket.website honigwabe-website-081033004511

# 3. Plan prüfen
terraform plan -var-file="clients/honigwabe/terraform.tfvars"
```

## Checkliste vor Production Deploy

- [ ] `terraform plan` zeigt keine `must be replaced`
- [ ] Alle S3 Buckets haben `prevent_destroy = true`
- [ ] Alle DynamoDB Tables haben `prevent_destroy = true`
- [ ] Cognito User Pool hat `prevent_destroy = true`
- [ ] IVS Channel hat `prevent_destroy = true`
- [ ] Lambda-Funktionen haben `ignore_changes = [source_code_hash]` oder externe ZIPs
- [ ] Backup der terraform.tfstate erstellt
- [ ] Backup der wichtigen S3 Buckets erstellt

## Monitoring nach Apply

```bash
# CloudWatch Logs prüfen
aws logs tail /aws/lambda/honigwabe-video-api --follow

# S3 Bucket Inhalt prüfen
aws s3 ls s3://honigwabe-website-081033004511/

# Lambda-Funktionen Status
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `honigwabe`)].FunctionName'
```

## Weitere Ressourcen

- [Terraform Lifecycle Meta-Argument](https://www.terraform.io/language/meta-arguments/lifecycle)
- [Terraform State Management](https://www.terraform.io/language/state)
- [AWS Provider Best Practices](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
