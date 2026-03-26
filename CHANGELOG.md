# Changelog

All notable changes to the **Buraq MQL5 & MQL4** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.6.0] — 2026-03-26

### ✨ Added
- **Buraq Compiler System**: Complete rewrite of compilation infrastructure for reliability and performance
- **Sequential Compilation**: Files compile one-by-one (no bulk processing) to prevent race conditions
- **Auto-Compilation on Activation**: All MQL files in workspace automatically compiled when extension loads
- **`.buraqignore` Support**: Exclude files/folders from compilation using `.vscode/.buraqignore` (gitignore-style patterns)
- **Persistent Diagnostics**: Problems panel accumulates errors from all files (no overwriting when editing)
- **Centralized Log Management**: All compiler `.log` files stored in `.vscode/temp/` folder, automatically deleted after processing
- **Diagnostics Cache**: Maintains diagnostics from all files for consistent Problems panel display
- **Enhanced Logging**: Detailed output panel logs for debugging compilation issues

### 🔧 Improved
- **Diagnostics Collection**: Fixed root cause where diagnostics were not appearing in Problems panel
- **File Path Handling**: Robust path normalization handles both forward and backward slashes in compiler logs
- **Error Detection**: Errors now reliably detected and displayed after file save
- **Cache Management**: Diagnostics cache properly updated even when files have no errors (clears fixed errors)
- **Include File Support**: Errors in included `.mqh` files properly tracked and displayed
- **Graceful Fallbacks**: Handles missing log files and compilation failures without losing diagnostics

### 🐛 Fixed
- **Critical**: `diagnosticCollection` initialization added - diagnostics now appear in Problems panel
- **Stale Errors**: Fixed issue where old errors persisted after being fixed
- **Path Format Issues**: Fixed diagnostics not created when log file used different path format
- **Cache Updates**: Cache now always updated for compiled files, even on success
- **Include File Diagnostics**: Errors in include files now properly attributed to correct file

### 📚 Documentation
- **Buraq Compiler System**: Complete architecture documentation
- **API Reference**: Module usage examples and configuration guide
- **Troubleshooting**: Output panel logging guide

---

## [0.5.0] — 2026-01-31

### ✨ Added
- **Go To Definition:** Ctrl+Click on any symbol to jump to its definition
- **Find All References:** Shift+F12 to find all usages of a symbol
- **Symbol Outline:** Ctrl+Shift+O to view and navigate to all functions/classes
- **Rename Symbol:** F2 to rename a symbol across all files
- **Code Lens:** Reference counts displayed above functions and classes
- **Quick Fix All:** New button in editor title bar to fix all issues at once
- **Independent Quick Fix Analyzer:** Analyzes code without needing compiler errors
- **File Templates:** Create new Expert Advisor, Script, Indicator, Library, Include, and Class files from templates

### 🔧 Improved
- **Enhanced Lifecycle Events:** Syntax checking now runs on file open, editor switch, and extension activation
- **Code Folding:** Fixed to show both opening and closing brackets when folded
- **Workspace Scanning:** Automatically scans all open MQL files on extension startup

### 🐛 Fixed
- **Go To Definition:** Now correctly finds function and class definitions
- **Symbol Outline:** Fixed parsing to detect all symbols in MQL files
- **Rename Symbol:** More reliable definition detection
- **Code Lens:** Rewritten for better performance and reliability

---

## [0.4.0] — 2026-01-30

### ✨ Added
- **Problems Panel Integration:** Compilation errors and warnings now appear directly in VS Code's Problems panel (`Ctrl+Shift+M`)
- **Auto-Diagnostics on Save:** Automatically checks for syntax errors when saving MQL files
- **Background Compilation:** Silent compilation runs in the background without interrupting workflow

### 🔧 Improved
- **Error Parsing:** Completely rewritten error regex to properly match MetaEditor's log format
- **Diagnostics Source:** Renamed diagnostic source to "Buraq Compiler" for better identification
- **Language Configuration:** Added indentation rules and word pattern for better editor behavior

### 🐛 Fixed
- **Diagnostic Extraction:** Fixed issue where errors weren't being extracted from compilation logs
- **File Path Parsing:** Corrected regex to properly extract file paths with line/column information

---

## [0.3.0] — 2025-12-24

### 🔧 Fixed
- **Documentation:** Resolved issue where the documentation window would close automatically
- **Performance:** Fixed UI freezing in VS Code while the compiler script was waiting
- **Search:** Improved search keyword accuracy in CHM help files

---

## [0.2.0] — 2025-11-18

### ✨ Added
- **Syntax:** Enhanced syntax highlighting for MQL5 and MQL4 files
- **IntelliSense:** Intelligent code completion for common MQL keywords
- **Terminal:** Implemented status indicators in Buraq Terminal

---

## [0.1.0] — 2025-11-17

### ✨ Added
- **Release:** Initial release of Buraq MQL5 & MQL4 extension
- **Compiler:** Basic compilation support via MetaEditor
- **Docs:** Help documentation access (F1)
