import { Project, SourceFile, FunctionDeclaration, ClassDeclaration, ExportDeclaration } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

export interface AnalyzedFile {
  filePath: string;
  relativePath: string;
  exports: string[];
  content: string;
}

export interface AnalysisResult {
  files: AnalyzedFile[];
  totalFiles: number;
  selectedFiles: number;
}

export class TypeScriptAnalyzer {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 1, // CommonJS
        allowJs: true,
        jsx: 1, // React
      },
    });
  }

  async analyzeRepository(repoPath: string): Promise<AnalysisResult> {
    // Add all TypeScript and JavaScript files
    const sourceFiles = this.project.addSourceFilesAtPaths([
      path.join(repoPath, '**/*.{ts,tsx,js,jsx}'),
    ]);

    const analyzedFiles: AnalyzedFile[] = [];

    for (const sourceFile of sourceFiles) {
      const exports = this.extractExports(sourceFile);
      if (exports.length > 0) {
        const relativePath = path.relative(repoPath, sourceFile.getFilePath());
        analyzedFiles.push({
          filePath: sourceFile.getFilePath(),
          relativePath,
          exports,
          content: sourceFile.getFullText(),
        });
      }
    }

    analyzedFiles.sort((a, b) => b.exports.length - a.exports.length);
    const selectedFiles = analyzedFiles.slice(0, 4);

    return {
      files: selectedFiles,
      totalFiles: sourceFiles.length,
      selectedFiles: selectedFiles.length,
    };
  }

  private extractExports(sourceFile: SourceFile): string[] {
    const exports: string[] = [];

    // Get named exports
    const exportDeclarations = sourceFile.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      const namedExports = exportDecl.getNamedExports();
      for (const namedExport of namedExports) {
        exports.push(namedExport.getName());
      }
    }

    // Get exported functions
    const functions = sourceFile.getFunctions().filter(func => func.isExported());
    for (const func of functions) {
      exports.push(func.getName() || 'anonymous');
    }

    // Get exported classes
    const classes = sourceFile.getClasses().filter(cls => cls.isExported());
    for (const cls of classes) {
      exports.push(cls.getName() || 'anonymous');
    }

    // Get default export
    const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
    if (defaultExportSymbol) {
      exports.push('default');
    }

    return exports;
  }

  buildPrompt(file: AnalyzedFile): string {
    return `You are an expert developer who writes robust, production-ready Jest tests.

File: ${file.relativePath}
Exports: ${file.exports.join(', ')}

Contents:
\`\`\`ts
${file.content}
\`\`\`

Task:
\t•\tProduce runnable Jest tests for the above file.
\t•\tUse describe/it blocks; include edge cases.
\t•\tMock external imports when necessary (use Jest mocks).
\t•\tKeep tests self-contained and runnable with jest (or vitest compatibility).
\t•\tReturn only the test code (no commentary).`;
  }
}
