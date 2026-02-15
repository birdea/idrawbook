# iDrawBook

A web-based drawing application with an Apple-inspired design. Built with TypeScript and Vite, iDrawBook provides a multi-page canvas environment with a variety of creative tools, Google Drive integration, and a premium glassmorphism UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

## Features

### Drawing Tools
- **Freehand** -- Pencil, Brush, and Pen with pressure sensitivity, opacity, and hardness controls
- **Shapes** -- Line, Rectangle, and Circle tools with real-time preview
- **Fill** -- Flood fill with any color
- **Eraser** -- Erase strokes by painting white
- **Text** -- Multi-line text input with options popup (font size, color, line spacing, horizontal alignment), drag-to-move, and re-editing of committed text
- **Hand** -- Pan the viewport and move pages on the canvas

### Multi-Page Canvas
- Create, delete, and navigate between multiple pages
- Each page has independent resolution (width x height)
- Zoom in/out with mouse wheel (centered on cursor)
- Page thumbnails in the sidebar preview panel

### History
- Unlimited undo/redo (configurable limit via Settings)
- Action-based replay system (strokes, shapes, fills, text)

### Save & Export
- Download as PNG, JPEG, or PDF (via jsPDF)
- Adjustable JPEG/PDF quality
- Save directly to Google Drive with folder selection

### Google Integration
- Sign in with Google account
- Google Drive file export with native folder picker
- User profile display in the menu bar

### UI/UX
- Apple-style glassmorphism design with light/dark mode support
- Collapsible sidebar sections (Stroke, Color, Canvas, Preview)
- Customizable color palette with grid layout
- Global tool indicator showing current color and size
- Responsive portrait layout with bottom bar
- Keyboard shortcuts for all major tools
- Toast notifications

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Build | Vite 7 |
| Styling | Vanilla CSS with CSS custom properties |
| PDF Export | jsPDF |
| Auth | Google Identity Services |
| Deployment | Docker (nginx) |

## Project Structure

```
src/
  main.ts          # App entry point, DOM wiring, keyboard shortcuts
  canvas.ts        # CanvasManager: multi-page canvas, viewport, pointer events
  tools.ts         # DrawingTool types, ToolUtils (stroke rendering, shapes, flood fill)
  history.ts       # HistoryManager, action classes (Stroke, Shape, Fill)
  text-tool.ts     # TextTool class, TextAction, options popup, drag & re-edit
  icons.ts         # SVG icon strings
  config.ts        # App name and version config
  google.ts        # Google OAuth and Drive API integration
  style.css        # All styles (glassmorphism, tools, modals, text overlay, responsive)
index.html         # Single-page HTML with modals and toolbar markup
```

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- npm

### Install & Run

```bash
git clone https://github.com/birdea/idrawbook.git
cd idrawbook
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build

```bash
npm run build
```

Output is generated in the `dist/` directory.

### Docker

```bash
docker build -t idrawbook .
docker run -p 80:80 idrawbook
```

### Google API Setup

To enable Google Drive export:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Drive API** and **Google Picker API**
3. Create OAuth 2.0 credentials (Client ID) and an API Key
4. Update `src/google.ts` with your credentials:
   ```typescript
   private clientId = 'YOUR_CLIENT_ID';
   private apiKey = 'YOUR_API_KEY';
   ```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Pencil |
| `Ctrl+B` | Brush |
| `F` | Fill |
| `Ctrl+E` | Eraser |
| `T` | Text |
| `Ctrl+H` | Hand / Move |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+L` | Toggle left toolbar |
| `Ctrl+R` | Toggle right panel |

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

Built by [birdea](https://github.com/birdea)
