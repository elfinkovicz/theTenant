# AWS Kosten-Schätzung - Honigwabe Live Platform
## Stand: November 2025 | Region: eu-central-1 (Frankfurt)

---

## 📊 Zusammenfassung bei 0 Traffic

| Kategorie | Monatliche Kosten |
|-----------|-------------------|
| **Fixkosten** | **~$35-45** |
| **Variable Kosten (0 Traffic)** | **~$0-2** |
| **TOTAL** | **~$35-47/Monat** |

---

## 🔴 Fixkosten (unabhängig von Traffic)

### 1. Amazon IVS (Interactive Video Service)
**IVS STANDARD Channel**
- **Basis-Gebühr**: $35/Monat (auch wenn nicht gestreamt wird)
- **Beschreibung**: STANDARD Channel ist immer aktiv und kostet fix
- **Alternative**: BASIC Channel = $0 Fixkosten, aber niedrigere Qualität

💡 **Einsparpotential**: Wechsel zu BASIC Channel = **-$35/Monat**

### 2. Route53 Hosted Zone
- **Kosten**: $0.50/Monat
- **Beschreibung**: DNS-Zone für honigwabe.live
- **Unvermeidbar**: Ja, solange Domain verwendet wird

---

## 🟢 Variable Kosten bei 0 Traffic

### 3. S3 Storage
**Buckets:**
- Website Bucket (honigwabe-website-*)
- Thumbnails Bucket (honigwabe-thumbnails-*)
- Sponsor Assets Bucket
- Product Images Bucket

**Kosten bei 0 Traffic:**
- Leere Buckets: $0
- Mit Inhalten (geschätzt 1 GB): ~$0.02/Monat
- **Geschätzt**: $0.05-0.20/Monat

### 4. CloudFront CDN
**Distributions:**
- Website Distribution
- Thumbnails/Assets Distribution

**Kosten bei 0 Traffic:**
- Keine Requests: $0
- **Geschätzt**: $0/Monat

### 5. DynamoDB
**Tabellen (Pay-per-Request):**
- Events Table
- Team Members Table
- Videos Table
- Advertisements Table
- Sponsors Table
- Products Table

**Kosten bei 0 Traffic:**
- Keine Requests: $0
- Storage (geschätzt < 1 GB): $0.25/Monat
- **Geschätzt**: $0.25-0.50/Monat

### 6. Lambda Functions
**Funktionen:**
- Contact Form Lambda
- IVS Chat Token Lambda
- User Auth Lambda
- Video Management Lambda
- Team Management Lambda
- Event Management Lambda
- Advertisement Management Lambda
- Shop Lambda
- Sponsor Lambda

**Kosten bei 0 Traffic:**
- Keine Invocations: $0
- **Geschätzt**: $0/Monat

### 7. API Gateway
**Gateways:**
- Contact Form API
- User Auth API (mit Video, Team, Event, Ad Management)
- IVS Chat API
- Shop API
- Sponsor API

**Kosten bei 0 Traffic:**
- Keine Requests: $0
- **Geschätzt**: $0/Monat

### 8. Cognito User Pool
**Features:**
- User Pool
- App Client
- Hosted UI
- Admin Group

**Kosten bei 0 Traffic:**
- Erste 50,000 MAU (Monthly Active Users): Kostenlos
- 0 Users: $0
- **Geschätzt**: $0/Monat

### 9. SES (Simple Email Service)
**Verwendung:**
- Contact Form E-Mails
- Domain Verification

**Kosten bei 0 Traffic:**
- Keine E-Mails: $0
- **Geschätzt**: $0/Monat

### 10. IVS Chat
**Features:**
- Chat Room
- Message Delivery

**Kosten bei 0 Traffic:**
- Keine Messages: $0
- **Geschätzt**: $0/Monat

### 11. CloudWatch Logs
**Log Groups:**
- Lambda Logs (9 Funktionen)
- API Gateway Logs

**Kosten bei 0 Traffic:**
- Minimale Logs: ~$0.50/Monat
- **Geschätzt**: $0.50-1.00/Monat

### 12. IAM
**Ressourcen:**
- Roles
- Policies
- Users

**Kosten**: $0 (kostenlos)

---

## 📈 Kosten bei normalem Traffic

### Beispiel: 1,000 Besucher/Monat

| Service | Kosten |
|---------|--------|
| IVS STANDARD | $35.00 (fix) |
| Route53 | $0.50 (fix) |
| CloudFront | ~$1.00 |
| API Gateway | ~$0.50 |
| Lambda | ~$0.20 |
| DynamoDB | ~$0.50 |
| S3 | ~$0.20 |
| CloudWatch | ~$1.00 |
| **TOTAL** | **~$39/Monat** |

### Beispiel: 10,000 Besucher/Monat

| Service | Kosten |
|---------|--------|
| IVS STANDARD | $35.00 (fix) |
| Route53 | $0.50 (fix) |
| CloudFront | ~$5.00 |
| API Gateway | ~$3.50 |
| Lambda | ~$1.00 |
| DynamoDB | ~$2.00 |
| S3 | ~$1.00 |
| CloudWatch | ~$2.00 |
| **TOTAL** | **~$50/Monat** |

---

## 🎥 IVS Streaming Kosten (zusätzlich)

### Bei aktivem Streaming

**Input (Encoding):**
- STANDARD Quality: $2.00/Stunde
- BASIC Quality: $1.00/Stunde

**Output (Delivery):**
- Erste 10,000 Stunden: $0.015/Stunde pro Zuschauer
- Beispiel: 100 Zuschauer für 2 Stunden = 200 Stunden = $3.00

**Beispiel: 2 Stunden Stream mit 100 Zuschauern**
- Input: 2h × $2.00 = $4.00
- Output: 200h × $0.015 = $3.00
- **Total**: $7.00 pro Stream

**Monatlich (4 Streams à 2h mit 100 Zuschauern):**
- ~$28/Monat zusätzlich

---

## 💰 Kostenoptimierung

### Sofortige Einsparungen

1. **IVS Channel Typ ändern**
   - Von STANDARD zu BASIC
   - **Einsparung**: $35/Monat
   - **Nachteil**: Niedrigere Streaming-Qualität

2. **CloudWatch Logs Retention**
   - Logs nach 7 Tagen löschen statt 30 Tage
   - **Einsparung**: ~$0.30/Monat

3. **Ungenutzte Ressourcen löschen**
   - Alte S3 Objects
   - Alte DynamoDB Items
   - **Einsparung**: ~$0.20/Monat

### Mittelfristige Optimierungen

4. **Lambda Memory optimieren**
   - Kleinere Memory-Größen wo möglich
   - **Einsparung**: ~$0.10/Monat bei Traffic

5. **CloudFront Caching optimieren**
   - Längere Cache-Zeiten
   - **Einsparung**: ~$0.50/Monat bei Traffic

6. **DynamoDB On-Demand vs Provisioned**
   - Bei konstantem Traffic: Provisioned günstiger
   - **Einsparung**: Variabel

---

## 🎯 Empfohlene Konfiguration

### Für Entwicklung/Testing
```python
# deployment_config.py
self.IVS_CHANNEL_TYPE = "BASIC"  # Statt STANDARD
```
**Kosten**: ~$2-5/Monat (ohne Streaming)

### Für Production mit wenig Traffic
```python
self.IVS_CHANNEL_TYPE = "BASIC"
```
**Kosten**: ~$2-10/Monat (ohne Streaming)
**Kosten mit Streaming**: +$5-15/Monat (je nach Nutzung)

### Für Production mit viel Traffic
```python
self.IVS_CHANNEL_TYPE = "STANDARD"
```
**Kosten**: ~$35-50/Monat (ohne Streaming)
**Kosten mit Streaming**: +$20-100/Monat (je nach Nutzung)

---

## 📊 Detaillierte Kostenaufschlüsselung

### Aktuelle Konfiguration (STANDARD Channel)

| Service | Typ | Kosten/Monat (0 Traffic) |
|---------|-----|--------------------------|
| IVS STANDARD Channel | Fix | $35.00 |
| Route53 Hosted Zone | Fix | $0.50 |
| S3 Storage | Variabel | $0.10 |
| CloudFront | Variabel | $0.00 |
| DynamoDB | Variabel | $0.30 |
| Lambda | Variabel | $0.00 |
| API Gateway | Variabel | $0.00 |
| Cognito | Variabel | $0.00 |
| SES | Variabel | $0.00 |
| IVS Chat | Variabel | $0.00 |
| CloudWatch Logs | Variabel | $0.75 |
| IAM | Kostenlos | $0.00 |
| **TOTAL** | | **$36.65** |

### Optimierte Konfiguration (BASIC Channel)

| Service | Typ | Kosten/Monat (0 Traffic) |
|---------|-----|--------------------------|
| IVS BASIC Channel | Fix | $0.00 |
| Route53 Hosted Zone | Fix | $0.50 |
| S3 Storage | Variabel | $0.10 |
| CloudFront | Variabel | $0.00 |
| DynamoDB | Variabel | $0.30 |
| Lambda | Variabel | $0.00 |
| API Gateway | Variabel | $0.00 |
| Cognito | Variabel | $0.00 |
| SES | Variabel | $0.00 |
| IVS Chat | Variabel | $0.00 |
| CloudWatch Logs | Variabel | $0.75 |
| IAM | Kostenlos | $0.00 |
| **TOTAL** | | **$1.65** |

---

## 🔍 Monitoring & Alerts

### Cost Explorer einrichten
1. AWS Console → Cost Explorer
2. Budget erstellen: $50/Monat
3. Alert bei 80% ($40)

### CloudWatch Billing Alarms
```bash
# Alert bei $40
aws cloudwatch put-metric-alarm \
  --alarm-name billing-alarm-40 \
  --alarm-description "Alert at $40" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 40 \
  --comparison-operator GreaterThanThreshold
```

---

## 📝 Fazit

### Aktuelle Kosten (STANDARD Channel)
- **Ohne Traffic**: ~$37/Monat
- **Mit 1,000 Besuchern**: ~$39/Monat
- **Mit 10,000 Besuchern**: ~$50/Monat
- **Mit Streaming (4×2h, 100 Zuschauer)**: +$28/Monat

### Optimierte Kosten (BASIC Channel)
- **Ohne Traffic**: ~$2/Monat
- **Mit 1,000 Besuchern**: ~$4/Monat
- **Mit 10,000 Besuchern**: ~$15/Monat
- **Mit Streaming (4×2h, 100 Zuschauer)**: +$20/Monat

### Empfehlung
Für den Start: **BASIC Channel verwenden** und bei Bedarf auf STANDARD upgraden.

**Einsparung**: ~$35/Monat = ~$420/Jahr
