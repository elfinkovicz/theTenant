# 🎨 Creator Platform Template - Whitelabel Solution

Modern React application with TypeScript, Vite, TailwindCSS and Framer Motion.
Ready-to-deploy whitelabel template for content creators and influencers.

## 🎯 Quick Links

- **[WHITELABEL-README.md](./WHITELABEL-README.md)** - Start here for whitelabel setup
- **[WHITELABEL-CONFIG.md](./WHITELABEL-CONFIG.md)** - Detailed customization guide
- **[WHITELABEL-FEATURES.md](./WHITELABEL-FEATURES.md)** - Complete feature overview
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup instructions

## 🎨 Design System

- **Dark Mode**: Purple/White theme (fully customizable)
- **Animations**: Framer Motion for smooth transitions
- **Responsive**: Mobile-first design
- **Modular Architecture**: Loose coupling principles

## 🚀 Tech Stack

- **React 18** mit TypeScript
- **Vite** - Schneller Build-Tool
- **TailwindCSS** - Utility-First CSS
- **Framer Motion** - Animationen
- **Zustand** - State Management
- **React Router** - Navigation
- **Lucide React** - Icons

## 📦 Installation

```bash
npm install
```

## 🛠️ Development

```bash
npm run dev
```

## 🏗️ Build

```bash
npm run build
```

## 📁 Projekt-Struktur

```
src/
├── components/
│   └── layout/
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── Layout.tsx
├── pages/
│   ├── Home.tsx
│   ├── Live.tsx
│   ├── Shop.tsx
│   ├── Events.tsx
│   ├── Channels.tsx
│   ├── Team.tsx
│   ├── Contact.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   └── Exclusive.tsx
├── store/
│   ├── authStore.ts
│   └── themeStore.ts
├── App.tsx
├── main.tsx
└── index.css
```

## 🔗 Integration mit Terraform Backend

Die Terraform-Konfiguration aus `TerraformInfluencerTemplate` kann direkt übernommen werden:

- AWS Cognito für Authentication
- AWS IVS für Live-Streaming
- DynamoDB für Datenbank
- S3 + CloudFront für Hosting
- Lambda für Backend-APIs

## 🎯 Features

- ✅ **Live Streaming** with chat and full-width ad banners
- ✅ **Video Library** - Self-hosted video management with upload & categories
- ✅ **Social Media Hub** - 14 platforms with brand colors and follower counts
- ✅ **E-Commerce Shop** with shopping cart
- ✅ **Event Management** with ticket sales
- ✅ **Team Profiles** showcase
- ✅ **Authentication** (AWS Cognito ready)
- ✅ **Exclusive Content** for premium members
- ✅ **Contact Forms** and information
- ✅ **Responsive Design** for all devices
- ✅ **Dark Mode** with customizable colors
- ✅ **Smooth Animations** with Framer Motion

## 🆕 Latest Updates (v2.0.0)

### Whitelabel Conversion
- ✅ All brand-specific references removed
- ✅ Generic placeholders for easy customization
- ✅ Centralized configuration system
- ✅ Comprehensive documentation

### New Features
- ✅ **Video Library Page** - Self-hosted video management system
- ✅ Upload, organize, and manage videos
- ✅ Category filtering and search
- ✅ Video analytics (views, duration, dates)
- ✅ **Social Media Hub** - Complete redesign of Channels page
- ✅ 14 major platforms (YouTube, Twitch, Instagram, TikTok, etc.)
- ✅ Brand colors, icons, and follower counts
- ✅ **Updated Logo** - Film camera icon (🎬)

### Live Stream Ad Banners
- ✅ Full-width top banner (1920x120px)
- ✅ Full-width bottom banner (1920x120px)
- ✅ Responsive design
- ✅ Easy sponsor integration

See [CHANGELOG-WHITELABEL.md](./CHANGELOG-WHITELABEL.md) for details.

## 🚀 Getting Started

### For Whitelabel Users
1. Read [WHITELABEL-README.md](./WHITELABEL-README.md)
2. Follow [WHITELABEL-CONFIG.md](./WHITELABEL-CONFIG.md)
3. Customize `src/config/brand.config.ts`
4. Update assets in `public/`
5. Run `npm run dev` to test
6. Build with `npm run build`

### For Video Hosting
See [VIDEO-HOSTING-GUIDE.md](./VIDEO-HOSTING-GUIDE.md) for:
- S3 integration
- Video upload implementation
- Player integration
- Analytics tracking

### For Developers
See technical documentation below.

Whitelabel Template - Customize for your brand
