# Adaptive UI Dashboard

A fully functional React-based dashboard for monitoring and managing UI personalization changes with complete undo/redo functionality.

## Features

✨ **Real-time Change Tracking** - View all UI modifications as they happen
📊 **Comprehensive Stats** - Track ML optimizations vs manual changes  
↶ **Undo/Redo** - Full history navigation with keyboard shortcuts
🔄 **Version Revert** - Jump to any previous state instantly
📥 **Export History** - Download complete change history as JSON
🔍 **Smart Filtering** - Filter by ML, manual, or system changes
🎨 **Beautiful UI** - Modern, responsive design with smooth animations

## Setup

1. Install dependencies:
```bash
cd dashboard
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Usage

- **Undo**: Click the Undo button or press `Ctrl+Z`
- **Redo**: Click the Redo button or press `Ctrl+Y`  
- **Revert**: Click "Revert to this version" on any history item
- **Export**: Download complete history as JSON file
- **Filter**: Show only ML, manual, or system changes

## Architecture

- **React 18** - Latest React with hooks
- **Vite** - Lightning-fast build tool
- **localStorage** - Persistent history storage
- **Axios** - API communication
- **CSS Modules** - Scoped styling

## API Integration

The dashboard integrates with your backend API at `http://localhost:5000/api`:

- `GET /api/users/:userId` - Fetch user data
- `POST /api/users/:userId/settings` - Apply settings
- `GET /api/users/:userId/history` - Get history

## Components

- `Header` - Dashboard title and branding
- `UserInfo` - User profile and session info
- `StatsCards` - Statistics overview
- `ControlPanel` - Undo/redo/filter controls
- `HistoryTimeline` - Visual change history
- `ComparisonView` - Before/after settings comparison
- `Toast` - Success/error notifications

Enjoy your fully functional dashboard! 🎉
