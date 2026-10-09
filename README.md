# NC-Code Viewer

A fast, distraction-free G-code / NC-code viewer for NC programmers, built with Tauri and Svelte. Open a program, read it, close it — nothing else in the way.

## Download

Get the latest version from the **[Releases page](https://github.com/NC-PB/NCView/releases/latest)**:

| System | File |
| --- | --- |
| macOS (Apple Silicon and Intel) | `NC-Code Viewer_<version>_universal.dmg` |
| Windows | `NC-Code Viewer_<version>_x64-setup.exe` or `NC-Code Viewer_<version>_x64_en-US.msi` |

`SHA256SUMS` lists the checksum of every file.

The installers are not signed with a paid certificate, so the system warns on first launch:

- **macOS**: open the `.dmg` and drag the app to *Applications*. On first launch macOS says the app is from an unidentified developer; right-click the app and choose **Open**, or go to *System Settings → Privacy & Security* and click **Open Anyway**. You only need to do this once.
- **Windows**: when SmartScreen shows *Windows protected your PC*, click **More info → Run anyway**.

## Features

- **Fast opening**: Drop a file onto the window, press `⌘O` / `Ctrl+O`, or use the Open button
- **Three dialects**, detected automatically from the extension and content, with a selector in the top bar to override:
  - **ISO / Fanuc**: G-codes, coordinates (X Y Z A B C I J K), M/T words, F/S words, block numbers, `#` variables, `( … )` and `;` comments. Works with packed words (`G01X10Y20`) and lowercase code
  - **Heidenhain Klartext** (`.h`): keywords such as `TOOL CALL`, `CYCL DEF`, `L`, `CC`, `R0`, `FMAX`; the tool of a `TOOL CALL`; Q parameters; incremental axes (`IX+10`); structure blocks (`* - …`) as headings; comments that leave the `~` continuation alone
  - **Siemens Sinumerik 840D** (`.mpf`, `.spf`): the `%_N_…_MPF` header, labels, strings (a `;` inside `MSG("…")` stays in the string), `$` system variables and R parameters, `=` assignments (`X=AC(10)`, `T="DRILL"`), cycle and function calls and control keywords
- **Syntax highlighting** in the CNC-Master color scheme
- **Large files**: Only the visible lines are rendered, so programs with hundreds of thousands of lines stay responsive
- **Line endings and encodings**: LF, CRLF and CR; UTF-8, UTF-16 (with BOM) and Windows-1252
- **Light and dark mode**: Follows the system until you pick one with the switch in the top bar; the choice is remembered
- **Cross-platform**: Runs on Windows, macOS and Linux

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22.17 or later)
- [Rust](https://rustup.rs/) (latest stable version)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/NC-PB/NCView.git
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

### Checks and Tests

```bash
npm run check              # svelte-check type checking
npm test                   # frontend unit tests (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # backend unit tests
```

### CI and Releases

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push to `main` and on pull requests: type check, unit tests and frontend build; `cargo fmt`, `clippy` and `cargo test` on macOS and Windows; and unsigned debug installers for both systems, downloadable from the run's artifacts.
- **Release** ([`.github/workflows/release.yml`](.github/workflows/release.yml)): bump the version in `package.json` and `src-tauri/Cargo.toml`, merge to `main`, then push a tag `vX.Y.Z`. The workflow checks the tag against the version, runs CI on the tagged commit, builds a universal macOS `.dmg` and Windows `.msi` / `.exe` installers, and creates a **draft** GitHub release with a `SHA256SUMS` file. Publish the draft by hand. Running it from the Actions tab is a dry run that only builds the installers.
- The installers are not signed with a certificate (the macOS app is signed ad hoc), so Gatekeeper and SmartScreen warn on first launch.

## Usage

1. Launch the application
2. Drop an NC file onto the window, press `⌘O` / `Ctrl+O`, or click **Open file**
3. The top bar shows the file name, line count and size (and the encoding, if it isn't UTF-8), and the detected dialect, which you can change if the guess is wrong
4. Close the file with **×**, switch light/dark mode with the sun/moon button

## Sample File

The repository includes a sample G-Code file (`static/sample.gcode`) that demonstrates various G-Code commands and syntax highlighting features. Open it from the app with the file dialog.

## Supported File Extensions

The open dialog filters for `.nc`, `.cnc`, `.gcode`, `.g`, `.ngc`, `.tap`, `.h`, `.mpf`, `.spf`, `.iso`, `.eia` and `.txt`. Any other text file can be opened via *All files* or by dropping it onto the window.

## Technology Stack

- **Frontend**: Svelte 5, SvelteKit 3, Vite 8
- **Backend**: Rust, Tauri 2
- **File Access**: Tauri dialog plugin and drag & drop; files are read and decoded in the Rust backend
- **Fonts**: Space Grotesk and JetBrains Mono, bundled locally (no network access needed)

The app icon is generated from `src-tauri/app-icon.svg` with `npx tauri icon src-tauri/app-icon.svg`.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
