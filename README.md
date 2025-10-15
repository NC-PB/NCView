# NC-Code Viewer

A modern, cross-platform G-Code/NC-Code viewer built with Tauri and Svelte. This application provides syntax highlighting and an intuitive interface for viewing CNC machine code files.

## Features

- **File Opening**: Open G-Code files with support for common extensions (`.nc`, `.cnc`, `.gcode`, `.g`, `.tap`, `.txt`)
- **Syntax Highlighting**: Color-coded display of different G-Code elements:
  - **G-codes** (green): Motion commands (G00, G01, G02, etc.)
  - **M-codes** (orange): Machine functions (M03, M05, M30, etc.)
  - **F-codes** (blue): Feed rate commands
  - **S-codes** (purple): Spindle speed commands
  - **T-codes** (teal): Tool selection commands
  - **Coordinates** (yellow): X, Y, Z, A, B, C coordinates
  - **Comments** (gray): Parenthetical and semicolon comments
  - **Numbers** (red): Numeric values
- **Line Numbers**: Easy navigation with line number display
- **File Information**: Display file name, size, and line count
- **Responsive Design**: Works on different screen sizes
- **Dark/Light Mode**: Automatic theme detection
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Rust](https://rustup.rs/) (latest stable version)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd NCView
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

4. Build for production:
   ```bash
   npm run tauri build
   ```

## Usage

1. Launch the application
2. Click the "📁 Open G-Code File" button
3. Select a G-Code file from your file system
4. View the file with syntax highlighting and line numbers
5. Use the "🗑️ Clear" button to clear the current file

## Sample File

The application includes a sample G-Code file (`static/sample.gcode`) that demonstrates various G-Code commands and syntax highlighting features.

## Supported File Extensions

- `.nc` - Numerical Control files
- `.cnc` - CNC files
- `.gcode` - G-Code files
- `.g` - G-Code files
- `.tap` - Tape files
- `.txt` - Text files

## Technology Stack

- **Frontend**: Svelte 5, Vite
- **Backend**: Rust, Tauri
- **UI**: Modern CSS with responsive design
- **File System**: Tauri file dialog and file system plugins

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
