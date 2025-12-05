# Shop Implementation - Frontend

## ✅ Fertiggestellt

### Komponenten
- **Cart Page** (`/cart`) - Warenkorb mit Produktverwaltung
- **Order Confirmation** (`/order-confirmation`) - Bestellbestätigung nach Kauf
- **Shop Settings Modal** - Admin-Einstellungen für PayPal Credentials
- **PayPal Checkout** - PayPal Integration (UI fertig, Backend TODO)

### Store
- **Cart Store** (`cartStore.ts`) - Zustand-Management für Warenkorb
  - LocalStorage Persistierung
  - Add/Remove/Update Items
  - Preis-Berechnung

### Services
- **Cart Service** (`cart.service.ts`) - API Calls für Backend (vorbereitet)
  - Create Order
  - Verify Payment
  - Shop Settings CRUD

### Features
- ✅ Produkte zum Warenkorb hinzufügen
- ✅ Warenkorb-Badge mit Anzahl
- ✅ Mengen ändern (+ / -)
- ✅ Produkte entfernen
- ✅ Warenkorb leeren
- ✅ Gesamtpreis-Berechnung
- ✅ Stock-Anzeige (Ausverkauft)
- ✅ PayPal Checkout Button (UI)
- ✅ Admin Shop-Einstellungen Modal

## 🔄 TODO - Backend Integration

### 1. Environment Variables
```env
VITE_SHOP_API_URL=https://xxx.execute-api.eu-central-1.amazonaws.com
```

### 2. Backend Endpoints benötigt
```
POST   /orders              - Create PayPal Order
POST   /orders/verify       - Verify Payment
GET    /orders/:orderId     - Get Order Details
GET    /settings            - Get Shop Settings (Admin)
PUT    /settings            - Update Shop Settings (Admin)
```

### 3. PayPal Integration Flow
```
1. User klickt "Zur Kasse" → PayPalCheckout Component
2. Frontend: cartService.createOrder() → Backend erstellt PayPal Order
3. Backend gibt approvalUrl zurück
4. Frontend: Redirect zu PayPal
5. User zahlt bei PayPal
6. PayPal redirected zurück mit ?token=xxx
7. Frontend: cartService.verifyPayment()
8. Backend: Verifiziert Payment, reduziert Stock, sendet E-Mails
9. Frontend: clearCart() + navigate('/order-confirmation')
```

### 4. Nächste Schritte
1. Terraform Backend Module erstellen
2. Lambda Functions implementieren
3. API Gateway Routes konfigurieren
4. DynamoDB Tabellen erstellen
5. SES E-Mail Templates
6. Frontend mit Backend verbinden

## 📁 Dateistruktur

```
honigwabe-react/src/
├── pages/
│   ├── Shop.tsx              ✅ Aktualisiert (Cart Integration)
│   ├── Cart.tsx              ✅ NEU
│   └── OrderConfirmation.tsx ✅ NEU
├── components/
│   ├── ShopSettingsModal.tsx ✅ NEU
│   └── PayPalCheckout.tsx    ✅ NEU
├── store/
│   └── cartStore.ts          ✅ NEU
├── services/
│   └── cart.service.ts       ✅ NEU
└── App.tsx                   ✅ Aktualisiert (Routes)
```

## 🎨 UI Features

### Warenkorb Badge
- Zeigt Anzahl der Artikel
- Animiert bei Änderungen
- Klickbar → navigiert zu /cart

### Cart Page
- Responsive Grid Layout
- Produkt-Thumbnails
- Mengen-Steuerung
- Preis-Übersicht
- PayPal Checkout Integration

### Order Confirmation
- Success Animation
- Bestellnummer
- Artikel-Liste
- E-Mail Bestätigung Info

### Shop Settings (Admin)
- PayPal Mode (Sandbox/Live)
- Client ID & Secret
- Seller E-Mail
- Shop Name
- Passwort-Feld mit Show/Hide

## 🔐 Security Notes

- PayPal Credentials werden nur im Backend gespeichert
- Frontend sendet nur Order-Daten
- Payment Verification erfolgt Backend-seitig
- Admin-Endpoints benötigen JWT Token

## 🚀 Testing

### Manuell testen (ohne Backend)
1. Gehe zu `/shop`
2. Füge Produkte zum Warenkorb hinzu
3. Klicke auf Warenkorb-Badge
4. Ändere Mengen
5. Klicke "Zur Kasse"
6. Siehe PayPal Button (noch nicht funktional)

### Mit Backend (später)
1. Admin: Shop-Einstellungen konfigurieren
2. PayPal Sandbox Credentials eintragen
3. Produkte kaufen
4. PayPal Sandbox Account verwenden
5. Bestellbestätigung prüfen
6. E-Mails prüfen (SES)
