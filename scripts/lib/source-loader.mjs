import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";
export function registerSourceLoader() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith("@/"))
        return nextResolve(
          pathToFileURL(
            resolve(root, "src", specifier.slice(2)) +
              (extname(specifier) ? "" : ".ts"),
          ).href,
          context,
        );
      if (
        specifier.startsWith(".") &&
        !extname(specifier) &&
        context.parentURL?.endsWith(".ts")
      ) {
        const url = new URL(specifier + ".ts", context.parentURL);
        if (existsSync(fileURLToPath(url)))
          return nextResolve(url.href, context);
      }
      return nextResolve(specifier, context);
    },
  });
}
