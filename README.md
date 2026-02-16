# iDrawBook 🎨

iDrawBook is a premium web-based drawing application inspired by Apple's design philosophy. Built with TypeScript and Vite, it offers a high-performance multi-page canvas environment, professional creative tools, Google Drive integration, and a sophisticated glassmorphism UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

---

## ✨ Features

### 🛠 Creative Tools
- **Freehand Drawing**: Support for Pencil, Brush, and Pen tools with adjustable pressure sensitivity, opacity, and hardness.
- **Shape Tools**: Line, Rectangle, and Circle tools with real-time preview during creation.
- **Smart Fill**: Flood fill any area with your selected color with a single click.
- **Elite Text Tool**: Advanced multi-line text input with options for font size, color, line spacing, and alignment. Supports drag-and-drop movement and re-editing of committed text.
- **Hand Tool**: Smoothly pan the viewport and rearrange pages on the canvas.

### 📄 Multi-Page Canvas System
- Create, manage, and navigate between multiple pages within a single document.
- Independent resolution settings (Width x Height) for each page.
- Smooth mouse-wheel zooming centered on the cursor.
- Sidebar preview panel for quick navigation between pages.

### 💾 Save & Export
- **Multiple Formats**: Export your work as PNG, JPEG, or PDF.
- **Quality Control**: Adjust compression quality for JPEG and PDF exports.
- **Google Drive Integration**: Sign in with your Google account to save files directly to specific folders in your Drive.

### 🎨 Premium UI/UX
- Elegant Apple-style Glassmorphism design.
- Full support for both Dark and Light modes.
- Efficiency-focused workspace with collapsible sidebar sections.
- Responsive layout optimized for mobile devices with an intuitive bottom bar.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (or yarn)

### Installation & Execution

```bash
# Clone the repository
git clone https://github.com/birdea/idrawbook.git

# Navigate to the project directory
cd idrawbook

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## ⌨️ Keyboard Shortcuts

Streamline your workflow with these intuitive shortcuts:

| Shortcut | Action |
|----------|--------|
| `Ctrl + P` | Pencil |
| `Ctrl + B` | Brush |
| `Ctrl + F` | Fill Color |
| `Ctrl + E` | Eraser |
| `Ctrl + T` | Text Tool |
| `Ctrl + H` | Hand Tool / Move |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + L` | Toggle Left Toolbar |
| `Ctrl + R` | Toggle Right Panel |

*Note: On Mac, these shortcuts also respond to the Command key.*

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (Strict Mode) |
| **Build Tool** | Vite 7 |
| **Styling** | Vanilla CSS (CSS Variables) |
| **Libraries** | jsPDF (PDF Generation), Vitest (Testing) |
| **Integration** | Google Identity Services, Google Drive API |

---

## ☁️ Google API Setup (Optional)

To enable Google Drive export functionality:

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Drive API** and **Google Picker API**.
3. Create OAuth 2.0 Client ID credentials and an API Key.
4. Add your credentials to the configuration file (or `.env` if supported).

---

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---
**Built with ❤️ by [birdea](https://github.com/birdea)**
