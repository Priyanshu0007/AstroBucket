# Project Guidelines: AstroBucket

## 🏗️ Architecture & Core Philosophy
- **Serverless & Local-First:** AstroBucket is a 100% client-side React application. There is NO backend server. All logic and API calls must be executed within the browser.
- **GitHub API Integration:** The app communicates directly with the GitHub REST API from the client to read/write commits and manage files, treating repositories as a virtual filesystem.
- **Edge CDN:** Uploaded assets are served instantly using the jsDelivr CDN (`cdn.jsdelivr.net/gh/...`).
- **Security & Privacy:** Authentication tokens (like GitHub PATs) must only be stored in `localStorage`. Never transmit credentials to any third-party servers.

## 💻 Technology Stack
- **Core:** React 19.2 + Vite 8.0.
- **Language:** TypeScript (~6.0). Use strict typing for all components and API responses.
- **Data Fetching:** Use `@tanstack/react-query` combined with `axios` or `fetch`.
- **Icons:** Use `lucide-react` for consistent vector icons.

## 🎨 Design System & Styling Rules
- **CSS Strategy:** Use **Vanilla CSS** for all styling. Do not use or configure Tailwind CSS unless explicitly asked.
- **Glassmorphism Aesthetic:** Designs must feel fluid and hardware-accelerated. Make heavy use of `backdrop-filter: blur()`, semi-transparent backgrounds with borders, and stark contrast text to create a frosted glass effect.
- **Theme Palette:** 
  - Backgrounds: Deep space dark mode (e.g., `#0f1115`).
  - Accents: Vibrant primary blues (e.g., `#3b82f6`).
  - Incorporate dynamic text gradients and subtle hover micro-animations.
- **Typography:**
  - Headings: `Outfit` (for modern, geometric display titles).
  - Body: `Inter` (for highly readable interfaces and tabular data displays).

## ✍️ Code Best Practices
- **Modularity:** Keep React components highly cohesive and focused.
- **Error Handling:** Ensure graceful fallbacks for GitHub API rate limits, network failures, or invalid authentication states.
- **Client-Side Processing:** Since there is no backend, all file processing (like parsing zips with `jszip` or parsing documents) must remain efficient to prevent blocking the main browser thread.
