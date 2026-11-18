// @ts-check

const ELLIPSIS = '…';

/**
 * @param {string} text
 * @returns {string[]}
 */
function wordsOf(text) {
  return String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

/**
 * Shorten `value` until `value + …` fits. The ellipsis is one character.
 * @param {string} value
 * @param {(line: string) => number} measure
 * @param {number} maxWidth
 * @returns {string}
 */
function ellipsize(value, measure, maxWidth) {
  let result = value.trimEnd();
  if (measure(`${result}${ELLIPSIS}`) <= maxWidth) {
    return `${result}${ELLIPSIS}`;
  }
  while (result.length > 0 && measure(`${result}${ELLIPSIS}`) > maxWidth) {
    result = result.slice(0, -1).trimEnd();
  }
  return `${result}${ELLIPSIS}`;
}

/**
 * Wrap on spaces. At most `maxLines` lines. The last line ends with an
 * ellipsis when the rest of the text does not fit. A line never exceeds
 * `maxWidth`. No hyphenation.
 *
 * @param {string} text
 * @param {(line: string) => number} measure
 * @param {number} maxWidth
 * @param {number} maxLines
 * @returns {string[]}
 */
function wrapText(text, measure, maxWidth, maxLines) {
  const words = wordsOf(text);
  if (words.length === 0 || maxLines < 1 || maxWidth <= 0) {
    return [];
  }

  /** @type {string[]} */
  const lines = [];
  let index = 0;

  while (index < words.length && lines.length < maxLines) {
    const lastLine = lines.length === maxLines - 1;
    let line = '';

    while (index < words.length) {
      const candidate = line ? `${line} ${words[index]}` : words[index];
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        index += 1;
        continue;
      }
      break;
    }

    if (!line) {
      const truncated = ellipsize(words[index], measure, maxWidth);
      lines.push(truncated);
      index += 1;
      if (lastLine) {
        break;
      }
      continue;
    }

    if (lastLine && index < words.length) {
      lines.push(ellipsize(line, measure, maxWidth));
      break;
    }

    lines.push(line);
  }

  return lines;
}

module.exports = {
  ELLIPSIS,
  wrapText,
};
