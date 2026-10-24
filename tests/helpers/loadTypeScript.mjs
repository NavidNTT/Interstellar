import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export function createTypeScriptLoader() {
  const root = path.resolve(import.meta.dirname, "../..");
  const cache = new Map();
  function load(file) {
    const filename = file.endsWith(".ts") ? file : file + ".ts";
    if (cache.has(filename)) return cache.get(filename);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule.exports);
    const localRequire = (id) => load(id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id));
    vm.runInThisContext("(function(require,loadedModule,exports){" + source + "\n})", { filename })(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return (file) => load(path.resolve(root, file));
}
