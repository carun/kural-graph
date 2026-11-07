// Lets `node --test` load the app's own modules, so safety is tested on the code that ships and not on a copy of it.
// The app imports through `@/` and leaves off extensions, which only the bundler understands. Import this first, then
// load the app's modules with `await import(...)`: static imports resolve before this has run.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

registerHooks({
  resolve(specifier, context, next) {
    const local = specifier.startsWith("@/") ? `${SRC}${specifier.slice(2)}` : specifier.startsWith(".") && context.parentURL?.includes("/src/") ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (local && !existsSync(local) && existsSync(`${local}.ts`)) return { url: pathToFileURL(`${local}.ts`).href, shortCircuit: true };
    return next(specifier, context);
  },
});
