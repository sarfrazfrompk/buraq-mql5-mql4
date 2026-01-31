# Changelog

All notable changes to the **Buraq MQL5 & MQL4** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
