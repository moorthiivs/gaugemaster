import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

const logger = new Logger('PdfFonts');

/**
 * Resolves the absolute path of a font file by checking standard distribution and source locations.
 * Works seamlessly in both local development (ts-node / dist) and production environments (PM2 release).
 */
export function resolveFontPath(fontFileName: string): string {
  const candidatePaths = [
    // 1. Production dist relative to compiled file location
    path.resolve(__dirname, '..', 'fonts', fontFileName),
    path.resolve(__dirname, 'fonts', fontFileName),
    path.resolve(__dirname, '..', 'fonts', 'fonts', fontFileName),
    path.resolve(__dirname, '..', '..', 'fonts', fontFileName),

    // 2. Relative to process.cwd() (root of application under PM2 or dev server)
    path.resolve(process.cwd(), 'dist', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'dist', 'fonts', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'backend', 'dist', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'src', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'backend', 'src', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'fonts', fontFileName),

    // 3. Fallback to node_modules if present
    path.resolve(process.cwd(), 'node_modules', 'pdfmake', 'fonts', fontFileName),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Continue searching
    }
  }

  logger.warn(`Font file "${fontFileName}" not found in candidate paths. Falling back to dist/fonts/${fontFileName}.`);
  return path.resolve(process.cwd(), 'dist', 'fonts', fontFileName);
}

/**
 * Returns the font descriptors required by pdfmake's PdfPrinter.
 */
export function getPdfFonts() {
  return {
    Roboto: {
      normal: resolveFontPath('Roboto-Regular.ttf'),
      bold: resolveFontPath('Roboto-Medium.ttf'),
      italics: resolveFontPath('Roboto-Italic.ttf'),
      bolditalics: resolveFontPath('Roboto-MediumItalic.ttf'),
    },
  };
}
