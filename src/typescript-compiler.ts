/**
 * # TypeScript Compiler 
 */

import {
  createProgram,
  flattenDiagnosticMessageText,
  Program,
  SourceFile,
  CompilerOptions, ModuleResolutionKind, ModuleKind, ScriptTarget } from 'typescript'
import { EOL } from 'os'

/**
 * # source file
 * 
 * Creates a program using the TypeScript Compiler API
 * and returns a source file.
 */
export function getSourceFile (path: string): SourceFile {
  const program = createProgram([path], getCompilerOptions())
  logCompilerDiagnostics(program)
  const sourceFile = program.getSourceFile(path)
  if (!sourceFile) throw new Error('Error retrieving source file')
  return sourceFile
}

/**
 * # compiler options
 * 
 * Returns TypeScript compiler options with modern, sane defaults.
 */
export function getCompilerOptions (): CompilerOptions {
  return {
    moduleResolution: ModuleResolutionKind.NodeJs,
    module: ModuleKind.CommonJS,
    esModuleInterop: true,
    lib: [ 'ES2019' ],
    target: ScriptTarget.ES2019,
    strict: true
  }
}

/**
 * # compiler diagnostics
 * 
 * Logs semantic diagnostic information for the provided program.
 */
export function logCompilerDiagnostics (program: Program): void {
  const compilerDiagnostics = program.getSemanticDiagnostics()
  if (compilerDiagnostics.length === 0) {
    console.log('No compiler errors or warnings.')
    return
  }
  for (const diagnostic of compilerDiagnostics) {
    const message = flattenDiagnosticMessageText(diagnostic.messageText, EOL)
    if (diagnostic.file) {
      const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
      const formattedMessage= `${diagnostic.file.fileName}(${location.line + 1},${location.character + 1}): [TypeScript] ${message}`
      console.log(formattedMessage)
    } else {
      console.log(message)
    }
  }
}
