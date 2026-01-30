# Changelog

All notable changes to the **Buraq MQL5 & MQL4** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
