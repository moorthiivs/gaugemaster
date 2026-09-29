import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

const logger = new Logger('PdfFonts');

/**
 * Resolves the absolute path of a font file by checking standard distribution and source locations.
 * Prioritizes permanent source directories (src/fonts) so development rebuilds never cause ENOENT errors.
 */
export function resolveFontPath(fontFileName: string): string {
  const candidatePaths = [
    // 1. Permanent source directories (never wiped during nest build / watch restarts)
    path.resolve(process.cwd(), 'src', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'backend', 'src', 'fonts', fontFileName),
    path.resolve(__dirname, '..', '..', 'src', 'fonts', fontFileName),
    path.resolve(__dirname, '..', 'src', 'fonts', fontFileName),

    // 2. Production dist relative to compiled file location
    path.resolve(__dirname, '..', 'fonts', fontFileName),
    path.resolve(__dirname, 'fonts', fontFileName),
    path.resolve(__dirname, '..', '..', 'fonts', fontFileName),

    // 3. Process cwd dist / root directories
    path.resolve(process.cwd(), 'dist', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'backend', 'dist', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'fonts', fontFileName),

    // 4. Fallback to node_modules if present
    path.resolve(process.cwd(), 'node_modules', 'pdfmake', 'fonts', fontFileName),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        // Also ensure dist/fonts copy exists if dist directory is present
        const distFontsDir = path.resolve(process.cwd(), 'dist', 'fonts');
        const distTarget = path.join(distFontsDir, fontFileName);
        if (candidate !== distTarget && fs.existsSync(path.resolve(process.cwd(), 'dist')) && !fs.existsSync(distTarget)) {
          try {
            if (!fs.existsSync(distFontsDir)) fs.mkdirSync(distFontsDir, { recursive: true });
            fs.copyFileSync(candidate, distTarget);
          } catch {}
        }
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
