# Lambda Layers Migration Guide

## Übersicht

Dieses Projekt wurde auf Lambda Layers umgestellt, um:
- **Deployment-Zeiten zu reduzieren** (von ~2-3 Minuten auf ~10-20 Sekunden pro Lambda)
- **Package-Größen zu verkleinern** (von ~50MB auf ~5KB pro Lambda)
- **Konsistenz zu gewährleisten** (alle Lambdas nutzen dieselben Dependency-Versionen)
- **Kosten zu senken** (weniger Storage, schnellere Cold Starts)

## Architektur

### Lambda Layers

**Layer 1: AWS SDK Core** (`aws-sdk-core-layer`)
- @aws-sdk/client-dynamodb ^3.490.0
- @aws-sdk/lib-dynamodb ^3.490.0
- @aws-sdk/client-s3 ^3.490.0
- @aws-sdk/s3-request-presigner ^3.490.0
- Verwendet von: 13 Lambda-Funktionen

**Layer 2: AWS SDK Extended** (`aws-sdk-extended-layer`)
- @aws-sdk/client-ses ^3.490.0
- @aws-sdk/client-kms ^3.490.0
- @aws-sdk/client-ivschat ^3.490.0
- Verwendet von: 2 Lambda-Funktionen

**Layer 3: Utilities** (`utilities-layer`)
- uuid ^9.0.1
- Verwendet von: 2 Lambda-Funktionen

### Vorher vs. Nachher

**Vorher:**
```
lambda/
├── index.js (5 KB)
├── package.json
└── node_modules/ (45 MB)
    └── @aws-sdk/... (viele Pakete)
```

**Nachher:**
```
lambda/
└── index.js (5 KB)  ← Nur noch der Code!
```

Dependencies kommen aus den Lambda Layers (einmal deployed, von allen genutzt).

## Migration durchführen

### Automatische Migration (Empfohlen)

```powershell
# Führe das Migrations-Skript aus
.\TerraformInfluencerTemplate\scripts\migrate-to-lambda-layers.ps1
```

Das Skript:
1. Passt alle `main.tf` Dateien an (source_dir → source_file, layers hinzufügen)
2. Fügt Layer-ARN-Variablen zu `variables.tf` hinzu
3. Löscht `package.json` aus Lambda-Ordnern

### Manuelle Migration (für einzelne Module)

#### 1. Module main.tf anpassen

**Vorher:**
```hcl
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "api" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${var.project_name}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30
}
```

**Nachher:**
```hcl
data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"  # ← Nur die JS-Datei
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "api" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${var.project_name}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30
  
  # ← Lambda Layers hinzufügen
  layers = [
    var.aws_sdk_core_layer_arn
  ]
}
```

#### 2. Module variables.tf anpassen

Füge Layer-ARN-Variablen hinzu:

```hcl
variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer"
  type        = string
}

variable "aws_sdk_extended_layer_arn" {
  description = "ARN of the AWS SDK Extended Lambda Layer"
  type        = string
}

variable "utilities_layer_arn" {
  description = "ARN of the Utilities Lambda Layer"
  type        = string
}
```

#### 3. main.tf (Root) anpassen

Übergebe Layer-ARNs an Module:

```hcl
module "hero_management" {
  source = "./modules/hero-management"
  
  # ... andere Variablen ...
  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn
  
  depends_on = [module.lambda_layers]
}
```

#### 4. package.json löschen

```powershell
Remove-Item TerraformInfluencerTemplate/modules/*/lambda/package.json
```

## Deployment

### Erstmaliges Deployment

```bash
cd TerraformInfluencerTemplate

# 1. Terraform initialisieren
terraform init

# 2. Plan prüfen
terraform plan -var-file="project.tfvars"

# 3. Layers und Lambdas deployen
terraform apply -var-file="project.tfvars"
```

### Lambda-Code-Updates (nach Migration)

Wenn du nur Lambda-Code änderst (z.B. `index.js`):

```bash
# Nur das betroffene Modul deployen
terraform apply -target=module.hero_management -var-file="project.tfvars"
```

**Deployment-Zeit:** ~10-20 Sekunden (statt 2-3 Minuten!)

### Dependency-Updates

Wenn du Dependencies aktualisieren möchtest:

```bash
# 1. package.json im Layer bearbeiten
nano TerraformInfluencerTemplate/modules/lambda-layers/layers/aws-sdk-core/package.json

# 2. Nur die Layers neu deployen
terraform apply -target=module.lambda_layers -var-file="project.tfvars"
```

Alle Lambdas nutzen automatisch die neuen Versionen beim nächsten Cold Start.

## Module-Mapping

| Modul | Benötigte Layers |
|-------|------------------|
| ad-management | aws_sdk_core |
| channel-management | aws_sdk_core |
| contact-info-management | aws_sdk_core |
| event-management | aws_sdk_core |
| hero-management | aws_sdk_core |
| ivs-chat | aws_sdk_extended |
| legal-management | aws_sdk_core |
| newsfeed-management | aws_sdk_core |
| product-management | aws_sdk_core |
| shop | aws_sdk_core, aws_sdk_extended, utilities |
| team-management | aws_sdk_core |
| telegram-integration | aws_sdk_core |
| video-management | aws_sdk_core, utilities |

## Troubleshooting

### "Cannot find module '@aws-sdk/...'"

**Problem:** Lambda kann Dependencies nicht finden.

**Lösung:** Stelle sicher, dass:
1. Die Layer-ARN korrekt übergeben wird
2. Der Layer erfolgreich deployed wurde: `terraform apply -target=module.lambda_layers`

### "Layer version does not exist"

**Problem:** Layer wurde gelöscht oder nicht deployed.

**Lösung:**
```bash
terraform apply -target=module.lambda_layers -var-file="project.tfvars"
```

### Deployment dauert immer noch lange

**Problem:** `source_dir` statt `source_file` verwendet.

**Lösung:** Prüfe `main.tf`:
```hcl
# Falsch:
source_dir = "${path.module}/lambda"

# Richtig:
source_file = "${path.module}/lambda/index.js"
```

## Performance-Vergleich

### Vorher (mit node_modules)
- Package-Größe: ~50 MB
- Deployment-Zeit: 2-3 Minuten
- Cold Start: ~800ms
- Storage-Kosten: Hoch

### Nachher (mit Lambda Layers)
- Package-Größe: ~5 KB
- Deployment-Zeit: 10-20 Sekunden
- Cold Start: ~600ms
- Storage-Kosten: Minimal

**Einsparung:** ~95% weniger Deployment-Zeit, ~99% kleinere Packages!

## Best Practices

1. **Nur Code in Lambda-Ordnern:** Keine `package.json`, keine `node_modules`
2. **Layer-Updates separat:** Ändere Layers nur wenn nötig
3. **Versionierung:** Layers sind versioniert, alte Versionen bleiben verfügbar
4. **Konsistenz:** Alle Lambdas nutzen dieselben Dependency-Versionen

## Weitere Informationen

- [AWS Lambda Layers Dokumentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [Lambda Layer Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
