/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
// Lets plain Node load the app's TypeScript (src/**/*.ts) for checks and tests,
// using the TypeScript compiler already in node_modules: no extra packages.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const SRC = path.resolve(__dirname, "../src");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  let target = request;
  if (request.startsWith("@/")) target = path.join(SRC, request.slice(2));
  else if (!request.startsWith(".")) return originalResolve.call(this, request, parent, ...rest);
  else target = path.resolve(path.dirname(parent.filename), request);
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return originalResolve.call(this, request, parent, ...rest);
};

for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}
