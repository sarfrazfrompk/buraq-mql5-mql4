# Buraq MQL5 & MQL4 Extension Documentation

## Overview
**Buraq MQL5 & MQL4** is a Visual Studio Code extension designed to provide a powerful development environment for MQL (MetaQuotes Language). It bridges VS Code with MetaEditor, enabling seamless compilation, syntax checking, and code navigation for MQL4 and MQL5.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Features](#features)
3. [Configuration](#configuration)
4. [Commands](#commands)
5. [Keybindings](#keybindings)
6. [Developer Guide (Architecture)](#developer-guide-architecture)

---

## Prerequisites
To use this extension, you must have **MetaTrader 4** or **MetaTrader 5** installed on your system. The extension relies on `metaeditor.exe` for compilation and syntax checking.

## Features

### 1. Compilation & Syntax Checking
- **Compile**: Compiles `.mq4` and `.mq5` files using the `metaeditor.exe` CLI.
- **Syntax Check**: Performs a compilation check without generating an executable (faster).
- **Background Checks**: Automatically checks syntax on file save (debounced).
- **Output**: Compilation results are displayed in the custom **Buraq Terminal** with ANSI color support for easier reading.
- **Problems Panel**: Errors and warnings are parsed and displayed in VS Code's Problems panel for quick navigation.

### 2. Intelligent Code Support
- **Snippets**: Includes rich snippets for MQL4/5 functions.
- **Hover Info**: Shows documentation and parameter info when hovering over functions.
- **Signature Help**: Shows parameter details while typing function arguments.
- **Go to Definition**: Navigate to function definitions within your files or include files.
- **Color Provider**: Visualizes custom MQL color codes (e.g., `C'128,128,128'`, `0xFFFFFF`).
- **Document Links**: Navigate to included files by holding `Ctrl` and clicking on `#include` paths.

### 3. Include Path Management
- **Auto-Detection**: Automatically detects MetaTrader installation paths (AppData and Program Files) to find `Include` folders.
- **Configuration**: Allows manual or automatic configuration of include paths to resolve dependencies.

### 4. File Management
- **New File Templates**: Quickly create new EAs, Indicators, Scripts, and Libraries using built-in templates.
- **Compiled File Diff**: Compare the current compiled version with previous versions (if available).
- **Show Compiled Info**: View details about generated `.ex4` or `.ex5` files.

---

## Configuration
You can configure the extension settings in `.vscode/settings.json` or via the VS Code Settings UI.

| Setting | Default | Description |
|---------|---------|-------------|
| `buraq_mql5_mql4.Metaeditor.Metaeditor4Dir` | `"C:\MT4_Install\MetaTrader\metaeditor.exe"` | Path to "metaeditor.exe" for MQL4. |
| `buraq_mql5_mql4.Metaeditor.Metaeditor5Dir` | `"C:\MT5_Install\MetaTrader\metaeditor.exe"` | Path to "metaeditor.exe" for MQL5. |
| `buraq_mql5_mql4.Metaeditor.Include4Dir` | `""` | Path to the "Include" folder for MQL4 (optional). |
| `buraq_mql5_mql4.Metaeditor.Include5Dir` | `""` | Path to the "Include" folder for MQL5 (optional). |
| `buraq_mql5_mql4.LogFile.DeleteLog` | `true` | Delete temporary compilation log files after checking/compilation. |
| `buraq_mql5_mql4.LogFile.NameLog` | `""` | Custom log file name/location. If empty, it is generated automatically. |
| `buraq_mql5_mql4.ShowButton.Compile` | `true` | Show Compile button in the editor title bar. |
| `buraq_mql5_mql4.ShowButton.Check` | `true` | Show Check button in the editor title bar. |
| `buraq_mql5_mql4.ShowButton.Script` | `true` | Show Compile using Script button in the editor title bar. |
| `buraq_mql5_mql4.Script.MiniME` | `true` | Minimize MetaEditor after launch (when compiling via script). |
| `buraq_mql5_mql4.Script.Timetomini` | `500` | Delay before minimizing MetaEditor (in milliseconds, minimum `100`). |
| `buraq_mql5_mql4.Script.CloseME` | `true` | Close MetaEditor after compilation finishes. |
| `buraq_mql5_mql4.Help.HelpON` | `true` | Enable F1 offline help integration. |
| `buraq_mql5_mql4.Help.MQL4HelpLanguage` | `"English"` | Help language for MQL4. |
| `buraq_mql5_mql4.Help.MQL5HelpLanguage` | `"English"` | Help language for MQL5. |
| `buraq_mql5_mql4.Help.HelpVal` | `500` | Help operation timeout/interval (in milliseconds, minimum `150`). |
| `buraq_mql5_mql4.context` | `false` | Enable extra Explorer context menu commands (do not disable). |
| `buraq_mql5_mql4.ShowChart.BrandingEnabled` | `true` | Enable MQL-Media branding on charts. |
| `buraq_mql5_mql4.ShowChart.BrandingPosition` | `"top-right"` | Position of MQL-Media branding on charts (`top-right`, `top-left`, `bottom-right`, `bottom-left`). |
| `buraq_mql5_mql4.author` | `"sarfrazfrompk"` | Author name used in file templates. |
| `buraq_mql5_mql4.link` | `"https://sarfrazfrompk.com"` | Author link/website used in file templates. |
| `buraq_mql5_mql4.codeLens.enabled` | `true` | Enable Code Lens showing reference counts. |

---

## Commands
Access these commands via the **Command Palette** (`Ctrl+Shift+P`):

- **MQL: Compile File**: Compiles the current `.mq4`, `.mq5`, or `.mqh` file using MetaEditor.
- **MQL: Check MQL Syntax**: Performs a syntax check without generating an executable.
- **MQL: Compile MQL file using script**: Compiles the file utilizing MetaEditor scripting.
- **MQL: Get the MQL4/MQL5 help**: Opens the offline help file (`.chm`) targeting the keyword at the cursor.
- **MQL: Create configuration**: Merges recommended workspace settings (file associations, exclusions, syntax token colors) for MQL development.
- **MQL: Detect Include Paths**: Automatically scans the system to locate MetaTrader data folders and Include directories.
- **MQL: Auto-Configure Include Paths**: Automatically detects and writes include directory configuration settings.
- **MQL: New Expert Advisor / Indicator / Script / Library**: Prompts for details and builds a new file from templates.
- **MQL: Show Compiled File Info**: Displays metadata and size of the compiled binary (`.ex4` or `.ex5`).
- **MQL: Compare Compiled Files**: Compares the currently active compiled binary against another file.
- **MQL: Compile All MQL Files**: Scans the workspace and compiles all non-ignored MQL files sequentially.
- **MQL: Compile Main MQL File**: Automatically compiles the main `.mq5` file located in the workspace root.
- **MQL: Quick Fix All**: Analyzes the current document and applies syntax corrections automatically.
- **MQL: Show Chart with MQL-Media Branding**: Displays the chart view with customizable branding.
- **MQL: Show/hide ex4/ex5 files**: Toggles the visibility of compiled binary files in the VS Code explorer.

---

## Keybindings
Default keybindings (active in MQL files):
- `Ctrl+Shift+X`: Compile File
- `Ctrl+Shift+Z`: Check File (Syntax Check)
- `Ctrl+Shift+C`: Compile Script

---

## Developer Guide (Architecture)
This section documents the internal code structure for developers contributing to the extension.

### File Structure (`out/`)
The extension logic is structured into the following components inside the `out/` directory:

#### Core Components
- **`extension.js`**: The main entry point. Activates the extension, registers commands, initializes providers, and coordinates background files/workspace scans.
- **`MQLDashboardProvider.js`**: Webview provider for the "MQL Dashboard" sidebar UI. Renders compilation progress, queue details, and file statuses.
- **`buraq-compiler/`**: The core compilation system containing:
  - `index.js`: Exports compiler interfaces.
  - `compilerCore.js`: The unified compiler core that runs `metaeditor.exe`, reads UTF-16LE compiler log files, parses errors/warnings via regex, and returns structured compilation results.
  - `DiagnosticsManager.js`: Re-architected diagnostic manager storing compilation diagnostics keyed by the exact files where they occurred to prevent diagnostics pollution.
  - `CompilationQueue.js`: Sequential compilation queue preventing race conditions and file locking during compilation runs.
  - `WorkspaceScanner.js`: Scans the workspace folder to find all compilation targets while respecting `.buraqignore`.
  - `BuraqIgnoreParser.js`: Parses ignore files and applies glob rules.
  - `LogFileManager.js`: Manages generated compilation logs.

#### Language & Editor Features
- **`provider.js`**: Implements Language Server Protocol features including Hover documentation for MQL functions/logs, Definition Provider for includes, signature help, and custom Color Picker support.
- **`symbolProvider.js`**: Provides Document Symbols (outline view), Workspace Symbols, and rename actions.
- **`codeLensProvider.js`**: Implements reference count Code Lens indicators for MQL code symbols.
- **`foldingProvider.js`**: Provides code folding ranges based on MQL brackets and regions.
- **`documentLinkProvider.js`**: Implements Document Links on `#include` statements for fast navigation.
- **`codeActionProvider.js`**: Provides editor Quick Fixes and Refactoring commands (e.g., Extract to function, Add include guards).
- **`quickFixAnalyzer.js`**: Statically analyzes files to detect issues like missing/duplicate semicolons.

#### Utilities & UI Helper Components
- **`includePathDetector.js`**: Automatically scans Program Files and AppData folders to auto-configure MT4/MT5 include directories.
- **`compiledFileDiff.js`**: Compares different versions of compiled MQL binaries.
- **`errorCodeDatabase.js`**: Offline MQL error code database that provides descriptive explanations during hovers.
- **`chartView.js`**: Integrates webview chart displays with customizable branding.
- **`help.js`**: Handles downloading and launching MQL `.chm` help files via `BuraqKeys.exe`.
- **`createProperties.js`**: Configures global/workspace setting values (file associations, token colors, folder exclusions).

### Compilation Flow
1. User triggers **Compile File**.
2. `extension.js` -> `Compile(1)` is called.
3. Extension checks `buraq_mql5_mql4.Metaeditor` settings.
4. Shell execution spawns `metaeditor.exe`.
5. Log file parsing uses Regex to match `File(Line,Col) : Error Code: Message`.
6. `vscode.Diagnostic` objects are created and pushed to `diagnosticCollection`.

---

## Related Links
- **GitHub Repository**: https://github.com/sarfrazfrompk/buraq-mql5-mql4
- **Publisher Website**: https://sarfrazfrompk.com
