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
- Chart view with customizable MQL-Media branding

### New in v0.6.0

- **Buraq Compiler System**: Complete rewrite for reliable sequential compilation
- **Auto-Compilation**: All workspace files compiled on extension load
- **`.buraqignore` Support**: Exclude files using `.vscode/.buraqignore`
- **Persistent Diagnostics**: Problems panel shows errors from all files simultaneously
- **Centralized Logs**: All `.log` files stored in `.vscode/temp/`, auto-deleted
- **Enhanced Error Detection**: Reliable error detection with path normalization

### New in v0.5.0

- **Go To Definition:** Ctrl+Click to jump to any symbol's definition
- **Find All References:** Shift+F12 to find all usages of a function/variable
- **Symbol Outline:** Ctrl+Shift+O to navigate functions and classes
- **Rename Symbol:** F2 to rename symbols across all files
- **Code Lens:** See reference counts above each function
- **Quick Fix All:** One-click button to fix common issues (missing semicolons, etc.)
- **File Templates:** Create Expert Advisors, Scripts, Indicators, and more from templates
- **Auto-Diagnostics:** Problems panel updates on file open, edit, and save

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

## Customizing Syntax Highlighting

You can customize the colors of syntax highlighting for MQL files using VS Code's built-in `editor.tokenColorCustomizations` setting. This allows you to change colors for comments, keywords, functions, and any other code elements.

### How to Customize Colors

1. **Identify the TextMate Scope**:
   - Open a `.mq4`, `.mq5`, or `.mqh` file
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Search for and select **"Developer: Inspect Editor Tokens and Scopes"**
   - Click on the code element you want to customize (e.g., a comment, function name, keyword)
   - Note the **TextMate scope** shown in the popup (e.g., `comment.line.double-slash.mql`)

2. **Add Custom Colors to settings.json**:
   - Press `Ctrl+Shift+P` and select **"Preferences: Open Settings (JSON)"**
   - Add or modify the `editor.tokenColorCustomizations` section:

```json
{
    "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "comment.line.double-slash.mql",
        "settings": {
          "foreground": "#51ff00",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "comment.block.mql",
        "settings": {
          "foreground": "#51ff00",
          "fontStyle": "italic"
        }
      }
    ]
  }
}
```

### Common MQL TextMate Scopes

Here are some commonly used scopes for MQL files that you can customize:

- `comment.line.double-slash.mql` — Single-line comments (`//`)
- `comment.block.mql` — Multi-line comments (`/* */`)
- `keyword.control.mql` — Control keywords (if, else, for, while, return, etc.)
- `keyword.control.preprocessor.mql` — Preprocessor directives (#include, #property, etc.)
- `storage.type.mql` — Data types (int, double, string, bool, etc.)
- `storage.modifier.mql` — Modifiers (extern, input, static)
- `entity.name.function.mql` — Function names
- `string.quoted.double.mql` — String literals
- `constant.numeric.integer.mql` — Integer numbers
- `constant.numeric.double.mql` — Floating-point numbers

### Example: Custom Color Scheme for MQL

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "comment.line.double-slash.mql",
        "settings": {
          "foreground": "#00FF00",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "keyword.control.mql",
        "settings": {
          "foreground": "#569CD6",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "entity.name.function.mql",
        "settings": {
          "foreground": "#DCDCAA"
        }
      },
      {
        "scope": "storage.type.mql",
        "settings": {
          "foreground": "#4EC9B0"
        }
      }
    ]
  }
}
```

For more information on customizing syntax highlighting, see the [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color).


## Commands

- `buraq_mql5_mql4.compileScript`
- `buraq_mql5_mql4.checkFile`
- `buraq_mql5_mql4.compileFile`
- `buraq_mql5_mql4.help`
- `buraq_mql5_mql4.configurations`
- `buraq_mql5_mql4.Addicon`, `Showfiles`, `InsNameMQH`, `InsMQH`, `InsMQL`, `InsNameMQL`, `InsResource`, `InsImport`, `InsTime`, `InsIcon`, `openInME`, `commentary`
- `buraq_mql5_mql4.showChartView` - Display chart with MQL-Media branding

## Troubleshooting

### Common Issues

#### MetaEditor Not Found
- **Solution**: Verify `Metaeditor4Dir`/`Metaeditor5Dir` paths in settings and ensure MetaEditor is installed.
- Check that the path points to the actual `metaeditor.exe` file (e.g., `C:\Program Files\MetaTrader 5\MetaEditor64.exe`)

#### Buttons Missing in Editor Title Bar
- **Solution**: Ensure `ShowButton.*` settings are enabled and file extension is `.mq4`, `.mq5`, or `.mqh`.
- Reload VS Code window after changing settings (`Ctrl+Shift+P` → "Developer: Reload Window")

#### F1 Help Not Working / 404 Errors
- **Symptoms**: Pressing F1 shows "Failed to load help file. Server response code - 404"
- **Solutions**:
  1. Ensure `Help.HelpON` is set to `true` in settings
  2. Check your internet connection (help files are downloaded on first use)
  3. Try deleting the help cache folder and triggering F1 again:
     - Navigate to: `[Extension Install Dir]/mql-files/help/`
     - Delete all `.chm` files
     - Press F1 on a keyword to re-download
  4. If the issue persists, check the Developer Console (`Ctrl+Shift+I`) for detailed error messages
  5. Verify firewall/antivirus isn't blocking the download

#### Syntax Highlighting Colors
- **Question**: "Can I customize the syntax highlighting colors?"
- **Answer**: Yes! See the [Customizing Syntax Highlighting](#customizing-syntax-highlighting) section above for detailed instructions.
- Use `Ctrl+Shift+P` → "Developer: Inspect Editor Tokens and Scopes" to identify scopes, then customize in `settings.json`

#### Context Menu Items Absent
- **Solution**: Set `buraq_mql5_mql4.context` to `true` in settings

#### Chart Branding Not Visible
- **Solution**: Ensure `ShowChart.BrandingEnabled` is true and icon files exist in the extension directory

### FAQ

**Q: The help file downloads are very slow. Can I download them manually?**

A: Yes. Download the help files from the GitHub repository and place them in `[Extension Install Dir]/mql-files/help/`:
- For MQL4: `mql4.chm`
- For MQL5: `mql5.chm` (or localized versions like `mql5-russian.chm`)

**Q: Why does the extension use the C++ language mode?**

A: MQL syntax is similar to C++, so the extension maps `.mq4`, `.mq5`, and `.mqh` files to the `cpp` language ID for better IDE integration. This allows features like IntelliSense from the C++ tools extension.

**Q: How do I disable F1 help if it conflicts with VS Code's default help?**

A: Set `"buraq_mql5_mql4.Help.HelpON": false` in your settings.json.


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