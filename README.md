# ✦ AstroBucket — Serverless GitHub-backed CDN Console

**An open-source, serverless S3-style console that allows you to manage assets inside your GitHub repositories and generate edge-cached jsDelivr CDN links instantly. A free, lightweight content delivery network backend.**

[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![jsDelivr](https://img.shields.io/badge/CDN-jsDelivr-E84D3D?style=for-the-badge&logo=jsdelivr&logoColor=white)](https://www.jsdelivr.com/)

---

[![Home Page](https://cdn.jsdelivr.net/gh/Priyanshu0007/CDN@main/astrobucket/astrobucket-landing.png)](#)

*Landing Page — fluid glassmorphism design with a WebGPU-inspired aesthetic.*

---

## 📋 Table of Contents

- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Getting Started](#-getting-started)
- [Design System](#-design-system)

---

## 📸 Screenshots

### 🚀 Storage Console
[![Storage Console Page](https://cdn.jsdelivr.net/gh/Priyanshu0007/CDN@main/astrobucket/astrobucket-bucket-page.png)](#)

*S3-style File Explorer — browse, manage, and upload assets directly to your GitHub repository.*

### 🔐 Secure Connection
[![Login Modal Page](https://cdn.jsdelivr.net/gh/Priyanshu0007/CDN@main/astrobucket/astrobucket-login.png)](#)

*OAuth Connection — securely connect your GitHub account entirely on the client side.*

### 📊 Real-time Stats
[![Stats Page](https://cdn.jsdelivr.net/gh/Priyanshu0007/CDN@main/astrobucket/astrobucket-stats-page.png)](#)

*File Analytics — analyze your storage usage with visual metrics and charts.*

---

## 🛠️ Tech Stack

### Core Framework

| Technology | Version | Role |
|------------|---------|------|
| [React](https://react.dev/) | `19.2` | Core UI Library |
| [Vite](https://vitejs.dev/) | `8.0` | Next-generation frontend tooling |
| TypeScript | `~6.0` | Strict typing and code integrity |

### Styling & Integrations

| Technology | Role |
|------------|------|
| Vanilla CSS | Custom Glassmorphism design system |
| GitHub API | Direct client-to-API communication for asset storage |
| jsDelivr | Infinite bandwidth global edge-caching for assets |
| Lucide React | Clean, consistent vector icons |

---

## 🏗️ Architecture Overview

```
                        ┌────────────────────────────────────────┐
                        │             React Client               │
                        │        (Browser Local Storage)         │
                        └───────────────────┬────────────────────┘
                                            │
                                100% Client-Side API Calls
                                            ▼
                        ┌────────────────────────────────────────┐
                        │            GitHub REST API             │
                        │    (Reads/Writes Commits to Repos)     │
                        └───────────┬────────────────┬───────────┘
                                    │                │
            Uploads Assets          │                │ Serves Cached Links
                                    ▼                ▼
                        ┌───────────┴────┐   ┌───────┴───────────┐
                        │   GitHub Repo  │──▶│    jsDelivr CDN   │
                        │(Storage Layer) │   │ (Edge Networking) │
                        └────────────────┘   └───────────────────┘
```

### Key Architectural Decisions

- **Serverless & Local-First**: AstroBucket has no backend middleman. Your OAuth tokens are stored in `localStorage` and all API requests are made directly from your browser to GitHub.
- **Git as a Database**: Re-purposes GitHub repositories to act as storage buckets, leveraging Git's versioning and tree structure to create a virtual filesystem.
- **Edge Distribution**: Instantly converts GitHub raw file paths into `cdn.jsdelivr.net/gh/...` links, giving your assets enterprise-grade edge caching for free.

---

## 🚀 Key Features

- **On-Device Privacy**: Your credentials and personal access tokens never leave your browser.
- **Instant Global CDN**: Uploaded assets are immediately served using jsDelivr edge networks. Benefit from automated CDN caching, file minification, and gzip compression.
- **S3-Style Console**: Create subdirectories, preview assets, delete files, and drag-and-drop uploads inside an intuitive visual workspace mimicking AWS S3.
- **Fluid Glassmorphism UI**: Beautiful, hardware-accelerated aesthetic with frosted glass panels, subtle gradients, and reactive micro-animations.

---

## 💻 Getting Started

### Prerequisites

- Node.js `>= 20.0`
- [npm](https://www.npmjs.com/) or [Bun](https://bun.sh)
- A GitHub account (a secondary/burner account is recommended to keep your primary commit graph clean)

### Installation

```bash
# Clone the repository
git clone https://github.com/Priyanshu0007/AstroBucket.git
cd AstroBucket

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

---

## 🎨 Design System

- **Glassmorphism**: Built from the ground up using custom vanilla CSS. Heavy use of `backdrop-filter: blur()`, semi-transparent backgrounds, and stark contrast text.
- **Typography Guidelines**:
  - Headings: `Outfit` for modern, geometric display titles.
  - Body: `Inter` for highly readable interfaces and data displays.
- **Theme**: Deep space dark mode (`#0f1115`) accented with vibrant primary blues (`#3b82f6`) and dynamic text gradients.

---

**Built with ♥ by [Priyanshu Gupta](https://priyanshu0007.vercel.app)**

[![GitHub](https://img.shields.io/badge/GitHub-Priyanshu0007-181717?style=flat-square&logo=github)](https://github.com/Priyanshu0007)
[![Portfolio](https://img.shields.io/badge/Portfolio-Live-22c55e?style=flat-square&logo=vercel)](https://priyanshu0007.vercel.app)
