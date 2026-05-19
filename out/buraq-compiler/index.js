'use strict';

/**
 * Buraq Compiler Module - Index
 * Centralized compilation system for MQL files
 */

const { BuraqIgnoreParser } = require('./BuraqIgnoreParser');
const { WorkspaceScanner } = require('./WorkspaceScanner');
const { LogFileManager } = require('./LogFileManager');
const { DiagnosticsManager } = require('./DiagnosticsManager');
const { CompilationQueue } = require('./CompilationQueue');
const { resolveMetaEditorPath, compileFileCore } = require('./compilerCore');

module.exports = {
    BuraqIgnoreParser,
    WorkspaceScanner,
    LogFileManager,
    DiagnosticsManager,
    CompilationQueue,
    resolveMetaEditorPath,
    compileFileCore
};
