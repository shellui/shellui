// @ts-check
/**
 * Read a service sidebar as data. Remote `sidebars.js` is never executed.
 * Supported input: JSON, or a JavaScript file whose body is only data and
 * local arrow helpers that return objects (the shape service handbooks use).
 * Anything else returns null so the caller can generate a sidebar from the
 * docs folder.
 */

const FAIL = Symbol('fail');

/**
 * @param {string} input
 */
function stripComments(input) {
  let out = '';
  let i = 0;
  /** @type {string | null} */
  let quote = null;
  while (i < input.length) {
    const c = input[i];
    const next = input[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += input[i + 1] || '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '`') return null;
    if (c === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 2;
      out += ' ';
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * @param {string} source
 * @returns {Array<{type: string, value: unknown}> | null}
 */
function tokenize(source) {
  const stripped = stripComments(source);
  if (stripped == null) return null;
  /** @type {Array<{type: string, value: unknown}>} */
  const tokens = [];
  let i = 0;
  while (i < stripped.length) {
    const c = stripped[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let value = '';
      while (j < stripped.length && stripped[j] !== c) {
        if (stripped[j] === '\\') {
          const escaped = stripped[j + 1];
          const map = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
          value += Object.prototype.hasOwnProperty.call(map, escaped) ? map[escaped] : escaped;
          j += 2;
          continue;
        }
        value += stripped[j];
        j += 1;
      }
      if (stripped[j] !== c) return null;
      tokens.push({ type: 'string', value });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(stripped[i + 1] || ''))) {
      let j = i;
      if (stripped[j] === '-') j += 1;
      while (j < stripped.length && /[0-9]/.test(stripped[j])) j += 1;
      if (stripped[j] === '.' || stripped[j] === 'e' || stripped[j] === 'E') return null;
      tokens.push({ type: 'number', value: Number(stripped.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < stripped.length && /[A-Za-z0-9_$]/.test(stripped[j])) j += 1;
      const value = stripped.slice(i, j);
      if (value === 'true' || value === 'false') tokens.push({ type: 'bool', value: value === 'true' });
      else if (value === 'null') tokens.push({ type: 'null', value: null });
      else tokens.push({ type: 'ident', value });
      i = j;
      continue;
    }
    if (c === '=' && stripped[i + 1] === '>') {
      tokens.push({ type: 'punct', value: '=>' });
      i += 2;
      continue;
    }
    if ('(){}[]:,.=;'.includes(c)) {
      tokens.push({ type: 'punct', value: c });
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

/**
 * @param {string} source
 * @returns {Record<string, unknown> | null}
 */
function parseSidebarModule(source) {
  const tokens = tokenize(source);
  if (!tokens) return null;
  let i = 0;
  const peek = () => tokens[i];
  const eat = (type, value) => {
    const token = tokens[i];
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) return null;
    i += 1;
    return token;
  };

  const parseExpr = () => {
    const token = peek();
    if (!token) return null;
    if (token.type === 'string' || token.type === 'number' || token.type === 'bool' || token.type === 'null') {
      i += 1;
      return { kind: 'lit', value: token.value };
    }
    if (token.type === 'punct' && token.value === '(') {
      i += 1;
      const inner = parseExpr();
      if (!inner || !eat('punct', ')')) return null;
      return inner;
    }
    if (token.type === 'punct' && token.value === '[') return parseArray();
    if (token.type === 'punct' && token.value === '{') return parseObject();
    if (token.type === 'ident') {
      const name = String(token.value);
      i += 1;
      if (peek() && peek().type === 'punct' && peek().value === '(') {
        i += 1;
        /** @type {unknown[]} */
        const args = [];
        if (!(peek() && peek().type === 'punct' && peek().value === ')')) {
          while (true) {
            const arg = parseExpr();
            if (!arg) return null;
            args.push(arg);
            if (peek() && peek().type === 'punct' && peek().value === ',') {
              i += 1;
              if (peek() && peek().type === 'punct' && peek().value === ')') break;
              continue;
            }
            break;
          }
        }
        if (!eat('punct', ')')) return null;
        return { kind: 'call', name, args };
      }
      return { kind: 'ref', name };
    }
    return null;
  };

  const parseArray = () => {
    if (!eat('punct', '[')) return null;
    /** @type {unknown[]} */
    const items = [];
    if (peek() && peek().type === 'punct' && peek().value === ']') {
      i += 1;
      return { kind: 'array', items };
    }
    while (true) {
      const item = parseExpr();
      if (!item) return null;
      items.push(item);
      if (peek() && peek().type === 'punct' && peek().value === ',') {
        i += 1;
        if (peek() && peek().type === 'punct' && peek().value === ']') break;
        continue;
      }
      break;
    }
    if (!eat('punct', ']')) return null;
    return { kind: 'array', items };
  };

  const parseObject = () => {
    if (!eat('punct', '{')) return null;
    /** @type {Array<{key: string, value: unknown}>} */
    const props = [];
    if (peek() && peek().type === 'punct' && peek().value === '}') {
      i += 1;
      return { kind: 'object', props };
    }
    while (true) {
      const keyTok = peek();
      if (!keyTok || (keyTok.type !== 'ident' && keyTok.type !== 'string')) return null;
      const key = String(keyTok.value);
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return null;
      i += 1;
      if (peek() && peek().type === 'punct' && peek().value === ':') {
        i += 1;
        const value = parseExpr();
        if (!value) return null;
        props.push({ key, value });
      } else if (keyTok.type === 'ident') {
        props.push({ key, value: { kind: 'ref', name: key } });
      } else return null;
      if (peek() && peek().type === 'punct' && peek().value === ',') {
        i += 1;
        if (peek() && peek().type === 'punct' && peek().value === '}') break;
        continue;
      }
      break;
    }
    if (!eat('punct', '}')) return null;
    return { kind: 'object', props };
  };

  const looksLikeArrow = () => {
    let depth = 0;
    for (let j = i; j < tokens.length; j += 1) {
      const token = tokens[j];
      if (token.type === 'punct' && token.value === '(') depth += 1;
      else if (token.type === 'punct' && token.value === ')') {
        depth -= 1;
        if (depth === 0) {
          const next = tokens[j + 1];
          return Boolean(next && next.type === 'punct' && next.value === '=>');
        }
      }
    }
    return false;
  };

  const parseFunction = () => {
    if (!eat('punct', '(')) return null;
    /** @type {string[]} */
    const params = [];
    if (!(peek() && peek().type === 'punct' && peek().value === ')')) {
      while (true) {
        const name = eat('ident');
        if (!name) return null;
        params.push(String(name.value));
        if (peek() && peek().type === 'punct' && peek().value === ',') {
          i += 1;
          continue;
        }
        break;
      }
    }
    if (!eat('punct', ')')) return null;
    if (!eat('punct', '=>')) return null;
    const body = parseExpr();
    if (!body || (body.kind !== 'object' && body.kind !== 'array' && body.kind !== 'lit')) return null;
    return { kind: 'fn', params, body };
  };

  /** @param {any} expr @param {Record<string, any>} scope */
  const evalExpr = (expr, scope) => {
    if (!expr) return FAIL;
    if (expr.kind === 'lit') return expr.value;
    if (expr.kind === 'ref') {
      if (!Object.prototype.hasOwnProperty.call(scope, expr.name)) return FAIL;
      const value = scope[expr.name];
      if (value && value.kind === 'fn') return FAIL;
      return value;
    }
    if (expr.kind === 'array') {
      const out = [];
      for (const item of expr.items) {
        const value = evalExpr(item, scope);
        if (value === FAIL) return FAIL;
        out.push(value);
      }
      return out;
    }
    if (expr.kind === 'object') {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const prop of expr.props) {
        const value = evalExpr(prop.value, scope);
        if (value === FAIL) return FAIL;
        out[prop.key] = value;
      }
      return out;
    }
    if (expr.kind === 'call') {
      const fn = scope[expr.name];
      if (!fn || fn.kind !== 'fn' || expr.args.length !== fn.params.length) return FAIL;
      /** @type {Record<string, any>} */
      const child = {};
      for (const [key, value] of Object.entries(scope)) {
        if (value && value.kind === 'fn') child[key] = value;
      }
      for (let n = 0; n < fn.params.length; n += 1) {
        const arg = evalExpr(expr.args[n], scope);
        if (arg === FAIL) return FAIL;
        child[fn.params[n]] = arg;
      }
      return evalExpr(fn.body, child);
    }
    return FAIL;
  };

  /** @type {Record<string, any>} */
  const scope = {};
  /** @type {unknown} */
  let exported = null;

  while (peek()) {
    if (peek().type === 'ident' && peek().value === 'const') {
      i += 1;
      const name = eat('ident');
      if (!name || !eat('punct', '=')) return null;
      if (peek() && peek().type === 'punct' && peek().value === '(' && looksLikeArrow()) {
        const fn = parseFunction();
        if (!fn) return null;
        scope[String(name.value)] = fn;
      } else {
        const expr = parseExpr();
        if (!expr) return null;
        const value = evalExpr(expr, scope);
        if (value === FAIL) return null;
        scope[String(name.value)] = value;
      }
      if (peek() && peek().type === 'punct' && peek().value === ';') i += 1;
      continue;
    }
    if (peek().type === 'ident' && peek().value === 'module') {
      i += 1;
      if (!eat('punct', '.') || !eat('ident', 'exports') || !eat('punct', '=')) return null;
      const expr = parseExpr();
      if (!expr) return null;
      exported = evalExpr(expr, scope);
      if (exported === FAIL) return null;
      if (peek() && peek().type === 'punct' && peek().value === ';') i += 1;
      continue;
    }
    return null;
  }

  if (!exported || typeof exported !== 'object' || Array.isArray(exported)) return null;
  if (Object.keys(exported).length === 0) return null;
  return /** @type {Record<string, unknown>} */ (exported);
}

/**
 * @param {string} source
 * @returns {Record<string, unknown> | null}
 */
function parseSidebarSource(source) {
  const trimmed = source.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
        return data;
      }
    } catch {
      // Not JSON. Try the data-only JavaScript subset.
    }
  }
  return parseSidebarModule(source);
}

/**
 * @param {Record<string, unknown>} sidebars
 */
function serializeSidebarModule(sidebars) {
  const safe = JSON.parse(JSON.stringify(sidebars));
  return `module.exports = ${JSON.stringify(safe, null, 2)};\n`;
}

/**
 * Sidebar used when a service file is missing or is not plain data.
 * Docusaurus lists every doc in the service docs folder.
 */
function autogeneratedSidebar() {
  return {
    tutorialSidebar: [{ type: 'autogenerated', dirName: '.' }],
  };
}

module.exports = {
  parseSidebarSource,
  serializeSidebarModule,
  autogeneratedSidebar,
};
