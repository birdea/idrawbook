# iDrawBook 🎨

iDrawBook is a premium, web-based drawing application inspired by modern Apple design aesthetics. It offers a smooth drawing experience with integrated Google services, allowing you to save your creations directly to Google Drive.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

## ✨ Features

### 🖌️ Creative Tools
- **Diverse Brushes**: Choose between Pencil, Brush, and Pen tools for different textures.
- **Precision Shapes**: Draw perfect Lines, Rectangles, and Circles.
- **Advanced Canvas**: World/Viewport architecture supporting smooth panning (Hand tool) and zooming.

### ☁️ Google Integration
- **Google Login**: Secure authentication with your Google account.
- **Save to Drive**: Export your artwork as high-quality PNGs directly to your Google Drive.
- **Google Picker**: Native folder selector for organizing your files seamlessly in the cloud.

### 💎 Premium UI/UX
- **Apple-inspired Design**: Clean, glassmorphic layout using modern CSS techniques.
- **Dynamic Properties**: Real-time control over stroke size, opacity, and color.
- **Responsive & Accessible**: Designed to feel like a native application in the browser.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (latest LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/birdea/idrawbook.git
   cd idrawbook
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:5173`.

### 🔑 Google API Configuration
To enable Google Drive export, you'll need to set up your own Google Cloud project:
1. Obtain a **Client ID** and **API Key** from the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API** and **Google Picker API**.
3. Update the credentials in `src/google.ts`:
   ```typescript
   private clientId = 'YOUR_CLIENT_ID';
   private apiKey = 'YOUR_API_KEY';
   ```

## 🛠️ Built With
- **TypeScript** - Core logic and type safety.
- **Vite** - Lightning-fast build tool and dev server.
- **Vanilla CSS** - Premium styling with glassmorphism effects.
- **Google Identity Services** - Seamless OAuth 2.0 integration.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ by [birdea](https://github.com/birdea)
