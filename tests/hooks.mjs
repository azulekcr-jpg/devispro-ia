// Permet à Node d'exécuter les tests TypeScript du projet sans outil supplémentaire
// (imports sans extension et alias "@/").
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, next) {
  const spec = specifier.startsWith('@/') ? pathToFileURL(path.join(root, 'src', specifier.slice(2))).href : specifier;
  try {
    return await next(spec, context);
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      for (const ext of ['.ts', '/index.ts']) {
        try { return await next(spec + ext, context); } catch { /* essai suivant */ }
      }
    }
    throw e;
  }
}
