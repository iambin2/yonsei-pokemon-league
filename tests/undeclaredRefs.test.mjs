import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";
import { parseAst } from "rollup/parseAst";

const GLOBALS = new Set([
  "window", "document", "navigator", "location", "history", "localStorage", "sessionStorage",
  "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "cancelAnimationFrame", "queueMicrotask", "fetch", "Headers", "Request", "Response",
  "URL", "URLSearchParams", "Blob", "File", "FileReader", "FormData", "Image", "Audio", "AudioContext",
  "webkitAudioContext", "Event", "CustomEvent", "AbortController", "AbortSignal", "ResizeObserver",
  "IntersectionObserver", "MutationObserver", "PerformanceObserver", "performance", "crypto",
  "atob", "btoa", "structuredClone", "TextEncoder", "TextDecoder", "WebGL2RenderingContext",
  "OffscreenCanvas", "Worker", "SharedWorker", "Notification", "PushManager", "ServiceWorker",
  "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLButtonElement",
  "HTMLCanvasElement", "SVGElement", "Element", "Node", "DOMMatrix", "DOMException",
  "CSS", "matchMedia", "getComputedStyle", "devicePixelRatio",
  "innerWidth", "innerHeight", "scrollTo", "scrollY", "scrollX", "alert", "confirm", "prompt",
  "addEventListener", "removeEventListener", "postMessage", "dispatchEvent",
  "Intl", "JSON", "Math", "Date", "Number", "String", "Boolean", "Array", "Object", "Map", "Set",
  "WeakMap", "WeakSet", "Promise", "Symbol", "BigInt", "RegExp", "Error", "TypeError", "RangeError",
  "SyntaxError", "ReferenceError", "URIError", "EvalError", "Proxy", "Reflect",
  "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array",
  "Float32Array", "Float64Array", "ArrayBuffer", "DataView", "Uint8ClampedArray",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
  "encodeURI", "decodeURI", "undefined", "NaN", "Infinity", "globalThis", "self", "process",
  "Buffer", "setImmediate", "clearImmediate", "arguments", "this", "super", "import",
  "createImageBitmap", "ClipboardItem", "BroadcastChannel", "MessageChannel", "WebSocket", "EventSource",
  "ImageData", "Path2D", "CanvasRenderingContext2D",
  "requestIdleCallback", "cancelIdleCallback", "visualViewport", "screen", "caches",
  "ReadableStream", "WritableStream", "TransformStream", "CompressionStream", "DecompressionStream",
]);

function collectPatternBindings(node, set) {
  if (!node) return;
  switch (node.type) {
    case "Identifier":
      set.add(node.name);
      break;
    case "AssignmentPattern":
      collectPatternBindings(node.left, set);
      break;
    case "RestElement":
      collectPatternBindings(node.argument, set);
      break;
    case "ArrayPattern":
      for (const el of node.elements) collectPatternBindings(el, set);
      break;
    case "ObjectPattern":
      for (const prop of node.properties) {
        if (prop.type === "RestElement") collectPatternBindings(prop.argument, set);
        else collectPatternBindings(prop.value, set);
      }
      break;
  }
}

function findUndeclaredRefs(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const { code } = transformSync(src, {
    loader: filePath.endsWith(".jsx") ? "jsx" : "js",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    sourcefile: filePath,
  });
  const ast = parseAst(code);
  const scopes = [new Set(GLOBALS)];
  const unresolved = new Set();

  function isDeclared(name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) return true;
    }
    return false;
  }

  function hoistScope(stmts, scope) {
    for (const stmt of stmts) {
      if (!stmt) continue;
      if (stmt.type === "ImportDeclaration") {
        for (const s of stmt.specifiers) scope.add(s.local.name);
      } else if ((stmt.type === "FunctionDeclaration" || stmt.type === "ClassDeclaration") && stmt.id) {
        scope.add(stmt.id.name);
      } else if (stmt.type === "VariableDeclaration") {
        for (const d of stmt.declarations) collectPatternBindings(d.id, scope);
      } else if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
        hoistScope([stmt.declaration], scope);
      } else if (stmt.type === "ExportDefaultDeclaration" && stmt.declaration?.id) {
        scope.add(stmt.declaration.id.name);
      }
    }
  }

  function hoistVars(node, fnScope) {
    if (!node || typeof node !== "object") return;
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") return;
    if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const d of node.declarations) collectPatternBindings(d.id, fnScope);
    }
    for (const k of Object.keys(node)) {
      if (k === "type" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) for (const item of v) hoistVars(item, fnScope);
      else if (v && typeof v === "object" && v.type) hoistVars(v, fnScope);
    }
  }

  function visitPatternDefaults(node) {
    if (!node) return;
    if (node.type === "AssignmentPattern") {
      visitPatternDefaults(node.left);
      visit(node.right);
    } else if (node.type === "ArrayPattern") {
      for (const el of node.elements) visitPatternDefaults(el);
    } else if (node.type === "ObjectPattern") {
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          if (prop.computed) visit(prop.key);
          visitPatternDefaults(prop.value);
        }
      }
    } else if (node.type === "RestElement") {
      visitPatternDefaults(node.argument);
    }
  }

  function visit(node) {
    if (!node || typeof node !== "object") return;
    switch (node.type) {
      case "Program": {
        const s = new Set();
        hoistScope(node.body, s);
        hoistVars(node, s);
        scopes.push(s);
        for (const stmt of node.body) visit(stmt);
        scopes.pop();
        return;
      }
      case "BlockStatement": {
        const s = new Set();
        hoistScope(node.body, s);
        scopes.push(s);
        for (const stmt of node.body) visit(stmt);
        scopes.pop();
        return;
      }
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const s = new Set();
        if (node.id) s.add(node.id.name);
        for (const p of node.params) collectPatternBindings(p, s);
        if (node.body.type === "BlockStatement") {
          hoistScope(node.body.body, s);
          hoistVars(node.body, s);
        }
        scopes.push(s);
        for (const p of node.params) visitPatternDefaults(p);
        if (node.body.type === "BlockStatement") {
          for (const stmt of node.body.body) visit(stmt);
        } else {
          visit(node.body);
        }
        scopes.pop();
        return;
      }
      case "CatchClause": {
        const s = new Set();
        if (node.param) collectPatternBindings(node.param, s);
        hoistScope(node.body.body, s);
        scopes.push(s);
        for (const stmt of node.body.body) visit(stmt);
        scopes.pop();
        return;
      }
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const s = new Set();
        const init = node.init || node.left;
        if (init && init.type === "VariableDeclaration" && init.kind !== "var") {
          for (const d of init.declarations) collectPatternBindings(d.id, s);
        }
        scopes.push(s);
        if (node.init) visit(node.init);
        if (node.left) visit(node.left);
        if (node.right) visit(node.right);
        if (node.test) visit(node.test);
        if (node.update) visit(node.update);
        visit(node.body);
        scopes.pop();
        return;
      }
      case "SwitchStatement": {
        visit(node.discriminant);
        const s = new Set();
        for (const c of node.cases) hoistScope(c.consequent, s);
        scopes.push(s);
        for (const c of node.cases) {
          if (c.test) visit(c.test);
          for (const stmt of c.consequent) visit(stmt);
        }
        scopes.pop();
        return;
      }
      case "VariableDeclarator": {
        visitPatternDefaults(node.id);
        if (node.init) visit(node.init);
        return;
      }
      case "MemberExpression": {
        visit(node.object);
        if (node.computed) visit(node.property);
        return;
      }
      case "Property": {
        if (node.computed) visit(node.key);
        visit(node.value);
        return;
      }
      case "MethodDefinition":
      case "PropertyDefinition": {
        if (node.computed) visit(node.key);
        if (node.value) visit(node.value);
        return;
      }
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "BreakStatement":
      case "ContinueStatement":
      case "MetaProperty":
        return;
      case "ExportNamedDeclaration": {
        if (node.declaration) visit(node.declaration);
        else if (!node.source) for (const sp of node.specifiers) visit(sp.local);
        return;
      }
      case "LabeledStatement":
        visit(node.body);
        return;
      case "UnaryExpression":
        if (node.operator === "typeof" && node.argument.type === "Identifier") return;
        visit(node.argument);
        return;
      case "Identifier":
        if (!isDeclared(node.name)) unresolved.add(node.name);
        return;
    }
    for (const k of Object.keys(node)) {
      if (k === "type" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) for (const item of v) visit(item);
      else if (v && typeof v === "object" && v.type) visit(v);
    }
  }

  visit(ast);
  return [...unresolved];
}

function walkSrc(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSrc(full, out);
    else if (/\.(js|jsx|mjs)$/.test(ent.name)) out.push(full);
  }
  return out;
}

test("every source module under src/ resolves all referenced identifiers", () => {
  const failures = [];
  for (const file of walkSrc(path.resolve("src"))) {
    const refs = findUndeclaredRefs(file);
    if (refs.length) {
      failures.push(`${path.relative(process.cwd(), file)}: ${refs.join(", ")}`);
    }
  }
  assert.deepEqual(failures, []);
});
