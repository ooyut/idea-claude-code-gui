function unescapeTomlString(value) {
  let result = '';
  let escaped = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (escaped) {
      switch (ch) {
        case 'n':
          result += '\n';
          break;
        case 't':
          result += '\t';
          break;
        case 'r':
          result += '\r';
          break;
        case '\\':
          result += '\\';
          break;
        case '"':
          result += '"';
          break;
        case '\'':
          result += '\'';
          break;
        default:
          result += '\\' + ch;
          break;
      }
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else {
      result += ch;
    }
  }
  if (escaped) {
    result += '\\';
  }
  return result;
}

function escapeTomlString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

function splitTomlElements(content, delimiter) {
  const result = [];
  let current = '';
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === '\'' && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (!inDouble && !inSingle) {
      if (ch === '[' || ch === '{') {
        depth += 1;
      } else if (ch === ']' || ch === '}') {
        depth -= 1;
      } else if (ch === delimiter && depth === 0) {
        result.push(current);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function parseTomlValue(valueStr) {
  if (!valueStr) {
    return '';
  }

  if (valueStr === 'true') {
    return true;
  }
  if (valueStr === 'false') {
    return false;
  }

  if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
    return parseTomlArray(valueStr);
  }

  if (valueStr.startsWith('{') && valueStr.endsWith('}')) {
    return parseTomlInlineTable(valueStr);
  }

  if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith('\'') && valueStr.endsWith('\''))) {
    return unescapeTomlString(valueStr.slice(1, -1));
  }

  const num = Number(valueStr);
  if (!Number.isNaN(num)) {
    return num;
  }

  return valueStr;
}

function parseTomlArray(arrayStr) {
  const content = arrayStr.slice(1, -1).trim();
  if (!content) {
    return [];
  }
  const elements = splitTomlElements(content, ',');
  return elements
    .map((element) => element.trim())
    .filter(Boolean)
    .map(parseTomlValue);
}

function parseTomlInlineTable(tableStr) {
  const content = tableStr.slice(1, -1).trim();
  if (!content) {
    return {};
  }
  const pairs = splitTomlElements(content, ',');
  const result = {};
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    let key = trimmed.slice(0, eqIndex).trim();
    let valueStr = trimmed.slice(eqIndex + 1).trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith('\'') && key.endsWith('\''))) {
      key = key.slice(1, -1);
    }
    result[key] = parseTomlValue(valueStr);
  }
  return result;
}

export function parseToml(content) {
  const result = {};
  let currentSection = result;

  const lines = String(content || '').split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      const sectionName = line.slice(1, -1).trim();
      const parts = sectionName.split('.');
      currentSection = result;
      for (const part of parts) {
        if (!currentSection[part] || typeof currentSection[part] !== 'object') {
          currentSection[part] = {};
        }
        currentSection = currentSection[part];
      }
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim();
      const valueStr = line.slice(eqIndex + 1).trim();
      currentSection[key] = parseTomlValue(valueStr);
    }
  }

  return result;
}

function toTomlValue(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(toTomlValue).join(', ')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([key, val]) => `"${escapeTomlString(key)}" = ${toTomlValue(val)}`);
    return `{ ${entries.join(', ')} }`;
  }

  return `"${escapeTomlString(value)}"`;
}

function writeTomlSection(lines, sectionPath, section) {
  const entries = Object.entries(section);
  const simpleEntries = entries.filter(([, value]) => typeof value !== 'object' || value === null || Array.isArray(value));
  const nestedEntries = entries.filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));

  if (simpleEntries.length > 0) {
    lines.push(`[${sectionPath}]`);
    for (const [key, value] of simpleEntries) {
      lines.push(`${key} = ${toTomlValue(value)}`);
    }
  }

  for (const [key, value] of nestedEntries) {
    writeTomlSection(lines, `${sectionPath}.${key}`, value);
  }
}

export function generateToml(config) {
  const lines = [];
  const entries = Object.entries(config || {});

  for (const [key, value] of entries) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      lines.push(`${key} = ${toTomlValue(value)}`);
    }
  }

  for (const [key, value] of entries) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      writeTomlSection(lines, key, value);
    }
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}

