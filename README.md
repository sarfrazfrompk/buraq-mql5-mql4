# Buraq MQL5 & MQL4

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg) ![Version](https://img.shields.io/visual-studio-marketplace/v/sarfrazfrompk.buraq-mql5-mql4) ![License](https://img.shields.io/badge/license-MIT-blue.svg)

Buraq MQL5 & MQL4 is a Visual Studio Code extension that brings comprehensive language support, compilation, and productivity tooling for MetaQuotes Language (MQL4/MQL5) used in MetaTrader platforms.

## Features

- Syntax highlighting and language grammars for `.mq4`, `.mq5`, and `.mqh`
- Compile, check, and script actions integrated into VS Code
- Configurable MetaEditor paths and include directories for MT4/MT5
- Help access with English language support for MQL4/MQL5
- Context menu actions for inserting includes, resources, imports, and commentary
- Keybindings for quick compile/check/help actions
- Chart view with customizable MQL-Media branding (position: top-right, top-left, bottom-right, bottom-left)

## Installation

### From Marketplace

- Search for `Buraq MQL5 & MQL4` in VS Code Extensions, or install via CLI:

```bash
code --install-extension sarfrazfrompk.buraq-mql5-mql4
```

- Marketplace link: https://marketplace.visualstudio.com/items?itemName=sarfrazfrompk.buraq-mql5-mql4

### From VSIX (Local Package)

```bash
# Install packaging tool if needed
npm install -g vsce

# From project root, create a VSIX package
vsce package

# Install the generated VSIX
code --install-extension ./buraq-mql5-mql4-0.1.0.vsix
```

## Usage

- Open any `.mq4`, `.mq5`, or `.mqh` file. The extension activates automatically.
- Use the title bar buttons or Command Palette actions:
  - `MQL: Compile File`
  - `MQL: Check File`
  - `MQL: Compile Script`
  - `MQL: Help`
  - `MQL: Configurations`
- Context menu actions for MQL files:
  - Insert includes/resources/imports/time/icon
  - Create commentary blocks
  - Open file directly in MetaEditor

### Keybindings

- `Ctrl+Shift+C` — Compile Script
- `Ctrl+Shift+X` — Compile File
- `Ctrl+Shift+Z` — Check File
- `F1` — Open MQL Help (when enabled)



## Configuration

The extension contributes settings under `Buraq MQL5 & MQL4`.

### Environment Requirements

- Windows with MetaEditor installed for MT4 and/or MT5
- VS Code `^1.106.0`
- Extension dependency: `ms-vscode.cpptools`

### Settings Table

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `buraq_mql5_mql4.LogFile.DeleteLog` | boolean | `true` | Automatically delete previous log file on run |
| `buraq_mql5_mql4.Metaeditor.Metaeditor4Dir` | string | `C:\\MT4_Install\\MetaTrader\\metaeditor.exe` | Path to MetaEditor (MT4) executable |
| `buraq_mql5_mql4.Metaeditor.Metaeditor5Dir` | string | `C:\\MT5_Install\\MetaTrader\\metaeditor.exe` | Path to MetaEditor (MT5) executable |
| `buraq_mql5_mql4.Metaeditor.Include4Dir` | string | `` | Additional include directory for MT4 |
| `buraq_mql5_mql4.Metaeditor.Include5Dir` | string | `` | Additional include directory for MT5 |
| `buraq_mql5_mql4.LogFile.NameLog` | string | `` | Custom log file name/location |
| `buraq_mql5_mql4.ShowButton.Compile` | boolean | `true` | Show compile button in editor title bar |
| `buraq_mql5_mql4.ShowButton.Check` | boolean | `true` | Show check button in editor title bar |
| `buraq_mql5_mql4.ShowButton.Script` | boolean | `true` | Show script button in editor title bar |
| `buraq_mql5_mql4.Script.MiniME` | boolean | `true` | Use mini MetaEditor window mode for script |
| `buraq_mql5_mql4.Script.Timetomini` | number | `500` (min `100`) | Delay before switching to mini mode (ms) |
| `buraq_mql5_mql4.Script.CloseME` | boolean | `true` | Close MetaEditor after script runs |
| `buraq_mql5_mql4.Help.HelpON` | boolean | `true` | Enable F1 help integration |
| `buraq_mql5_mql4.Help.MQL4HelpLanguage` | string | `English` | Help language for MQL4 |
| `buraq_mql5_mql4.Help.MQL5HelpLanguage` | string | `English` | Help language for MQL5 |
| `buraq_mql5_mql4.Help.HelpVal` | number | `500` (min `150`) | Help operation timeout/interval (ms) |
| `buraq_mql5_mql4.context` | boolean | `false` | Enable extra explorer context menu commands |
| `buraq_mql5_mql4.ShowChart.BrandingEnabled` | boolean | `true` | Enable MQL-Media branding on charts |
| `buraq_mql5_mql4.ShowChart.BrandingPosition` | string | `top-right` | Position of MQL-Media branding on charts (top-right, top-left, bottom-right, bottom-left) |

## Commands

- `buraq_mql5_mql4.compileScript`
- `buraq_mql5_mql4.checkFile`
- `buraq_mql5_mql4.compileFile`
- `buraq_mql5_mql4.help`
- `buraq_mql5_mql4.configurations`
- `buraq_mql5_mql4.Addicon`, `Showfiles`, `InsNameMQH`, `InsMQH`, `InsMQL`, `InsNameMQL`, `InsResource`, `InsImport`, `InsTime`, `InsIcon`, `openInME`, `commentary`
- `buraq_mql5_mql4.showChartView` - Display chart with MQL-Media branding

## Troubleshooting

- MetaEditor not found: verify `Metaeditor4Dir`/`Metaeditor5Dir` paths and that MetaEditor is installed.
- Buttons missing: ensure `ShowButton.*` settings are enabled and file extension is `.mq4`, `.mq5`, or `.mqh`.
- Help not working: confirm `Help.HelpON` is true and select a valid help language.
- Context menu items absent: set `buraq_mql5_mql4.context` to `true`.
- Chart branding not visible: ensure `ShowChart.BrandingEnabled` is true and icon files exist in the extension directory.
- Build status badge is static until CI is configured in your repository.

## Contributing

1. Fork the repository and create a feature branch
2. Install dependencies:

```bash
npm install
```

3. Lint and test locally:

```bash
npm run lint
npm test
```

4. Follow conventional commits for messages
5. Open a Pull Request with a clear description and screenshots where relevant

### Code of Conduct

This project adheres to the Contributor Covenant, version 2.1. See https://www.contributor-covenant.org/version/2/1/code_of_conduct/ for details.

## Known Issues

- Primarily tested on Windows due to MetaEditor integration paths
- VS Code language id maps to `cpp` for grammar scope; other C++ tooling may interact

## Acknowledgments

- MetaQuotes Language (MQL4/MQL5) and documentation by MetaQuotes
- VS Code Extension API and samples

## Related Links

- MQL4 Reference: https://docs.mql4.com/
- MQL5 Reference: https://www.mql5.com/en/docs
- VS Code Extension API: https://code.visualstudio.com/api
- Publisher site: http://sarfrazfrompk.com
- [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/sarfrazfrompk/)
- [![Contact](https://img.shields.io/badge/Contact-FF6B6B?style=flat&logo=mail&logoColor=white)](https://sarfrazfrompk.com/contact)
- [![Facebook Community](https://img.shields.io/badge/Facebook%20Community-1877F2?style=flat&logo=facebook&logoColor=white)](https://www.facebook.com/groups/mql5programmers)

## License

Released under the MIT License. See `LICENSE.md`.