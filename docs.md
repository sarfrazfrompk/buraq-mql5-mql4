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
| `buraq_mql5_mql4.Metaeditor.Metaeditor4Dir` | `C:\MT4_Install\MetaTrader\metaeditor.exe` | Path to MT4 MetaEditor executable. |
| `buraq_mql5_mql4.Metaeditor.Metaeditor5Dir` | `C:\MT5_Install\MetaTrader\metaeditor.exe` | Path to MT5 MetaEditor executable. |
| `buraq_mql5_mql4.Metaeditor.Include4Dir` | `""` | Path to MT4 Include folder (optional, auto-detectable). |
| `buraq_mql5_mql4.Metaeditor.Include5Dir` | `""` | Path to MT5 Include folder (optional, auto-detectable). |
| `buraq_mql5_mql4.LogFile.DeleteLog` | `true` | Delete temporary compilation log files after reading. |
| `buraq_mql5_mql4.ShowButton.Compile` | `true` | Show Compile button in editor title bar. |
| `buraq_mql5_mql4.ShowButton.Check` | `true` | Show Check button in editor title bar. |
| `buraq_mql5_mql4.author` | `"Your Name"` | Author name used in file templates. |
| `buraq_mql5_mql4.link` | `"https://www.example.com"` | Author link used in file templates. |

---

## Commands
Access these commands via the **Command Palette** (`Ctrl+Shift+P`):

- **MQL: Compile File**: Compiles the current file.
- **MQL: Configurations**: Applies recommended settings (file associations, exclusions, syntax highlighting colours) for MQL development. This now merges with your existing settings instead of overwriting them.
- **MQL: Auto-Configure Include Paths**: Automatically sets the best detected include paths in settings.
- **MQL: New Expert Advisor/Indicator/Script**: Creates a new file from a template.
- **MQL: Show Compiled File Info**: Displays information about the compiled binary.
- **MQL: Compare Compiled Files**: Compares the current compiled binary with another version.

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
The extension logic is primarily located in the `out/` directory (compiled JS or direct JS source).

#### Core Components
- **`extension.js`**: The main entry point.
  - Activates the extension.
  - Registers commands.
  - Manages the **Buraq Terminal** (`initializeBuraqTerminal`, `writeToTerminal`).
  - Handles the compilation process (`Compile` function):
    1. Saves all files.
    2.Determines the compiler path based on file extension.
    3. Executes `metaeditor.exe` with `/compile` and `/log` arguments.
    4. Reads the generated log file (UTF-16LE).
    5. Parses the log (`replaceLog`) to extract errors/warnings.
    6. Updates the VS Code Diagnostic Collection (Problems panel).
    7. Outputs colorized results to the terminal.

#### Language Features
- **`provider.js`**: Implements Language Server Protocol features.
  - `Hover_log`: Hover support for usage logs.
  - `DefinitionProvider`: Go to Definition support.
  - `Hover_MQL`: Hover documentation for MQL functions.
  - `ItemProvider`: Code completion (IntelliSense).
  - `HelpProvider`: Signature help for functions.
  - `ColorProvider`: VS Code color picker support for MQL colors.
- **`symbolProvider.js`**: Handles Document Symbols (Outline) and Workspace Symbols.
- **`codeLensProvider.js`**: Implements CodeLens (e.g., showing reference counts).
- **`foldingProvider.js`**: Logic for code folding ranges.

#### Utilities
- **`includePathDetector.js`**:
  - `findAppDataTerminals()`: Scans `%APPDATA%\MetaQuotes\Terminal` for MT4/5 data folders.
  - `findCommonInstallations()`: Scans common "Program Files" paths.
  - `autoConfigureIncludePaths()`: Updates user settings with the best found paths.
- **`compiledFileDiff.js`**: Logic for comparing binary or text outputs.
- **`errorCodeDatabase.js`**: Database of MQL error codes for enhanced hover/error info.
- **`chartView.js`**: Manages webview-based chart interactions or branding.

### Compilation Flow
1. User triggers **Compile File**.
2. `extension.js` -> `Compile(1)` is called.
3. Extension checks `buraq_mql5_mql4.Metaeditor` settings.
4. Shell execution spawns `metaeditor.exe`.
5. Log file parsing uses Regex to match `File(Line,Col) : Error Code: Message`.
6. `vscode.Diagnostic` objects are created and pushed to `diagnosticCollection`.
