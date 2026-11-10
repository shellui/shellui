// @ts-check
const fs = require('fs');
const path = require('path');
const React = require('react');
const opentype = require('opentype.js');
const {Resvg} = require('@resvg/resvg-js');
const {DEFAULT_TITLE, readSiteDescription} = require('./copy');
const {wrapText} = require('./wrap');

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const TEXT_WIDTH = 740;

const COLORS = {
  background: '#ffffff',
  text: '#030712',
  muted: '#374151',
  border: '#e5e7eb',
  watermark: '#f3f3f4',
  gold: '#e3a512',
};

const TITLE_SIZE = 64;
const TITLE_LINE = 72;
const DESC_SIZE = 24;
const DESC_LINE = 34;
const EYEBROW_SIZE = 18;
const EYEBROW_LINE = 24;

const FONT_DIR = path.join(__dirname, '../fonts/inter');
const MARK_PATH = path.resolve(__dirname, '../../../static/app-icon.svg');

const FONT_FILES = {
  400: 'Inter-Regular.ttf',
  500: 'Inter-Medium.ttf',
  600: 'Inter-SemiBold.ttf',
  700: 'Inter-Bold.ttf',
};

/** @type {any[] | null} */
let satoriFonts = null;
/** @type {Map<number, import('opentype.js').Font> | null} */
let measuredFonts = null;
/** @type {{header: {src: string, width: number, height: number}, watermark: {src: string, width: number, height: number}} | null} */
let marks = null;

function loadSatoriFonts() {
  if (!satoriFonts) {
    satoriFonts = Object.entries(FONT_FILES).map(([weight, filename]) => ({
      name: 'Inter',
      data: fs.readFileSync(path.join(FONT_DIR, filename)),
      weight: Number(weight),
      style: 'normal',
    }));
  }
  return satoriFonts;
}

/**
 * @param {number} weight
 */
function measureFont(weight) {
  if (!measuredFonts) {
    measuredFonts = new Map();
  }
  let font = measuredFonts.get(weight);
  if (!font) {
    const filename = FONT_FILES[weight];
    if (!filename) {
      throw new Error(`No Inter file for weight ${weight}`);
    }
    font = opentype.parse(fs.readFileSync(path.join(FONT_DIR, filename)));
    measuredFonts.set(weight, font);
  }
  return font;
}

/**
 * Advance width without OpenType layout. Inter's GSUB tables use lookups
 * opentype.js cannot apply, and kerning only makes the line shorter, so the
 * unkerned width stays inside the measured limit.
 * @param {number} weight
 * @param {number} size
 * @returns {(line: string) => number}
 */
function measurer(weight, size) {
  const font = measureFont(weight);
  const scale = size / font.unitsPerEm;
  return (line) => {
    let width = 0;
    for (const char of line) {
      width += font.charToGlyph(char).advanceWidth * scale;
    }
    return width;
  };
}

/**
 * @param {string} svg
 * @param {string | null} fill
 * @param {number} height
 * @returns {{src: string, width: number, height: number}}
 */
function rasterizeMark(svg, fill, height) {
  const source = fill ? svg.replace(/#000000/gi, fill) : svg;
  const probe = new Resvg(source, {font: {loadSystemFonts: false}});
  const bbox = probe.innerBBox();
  if (bbox) {
    probe.cropByBBox(bbox);
  }
  const cropped = probe.toString();
  const rendered = new Resvg(cropped, {
    fitTo: {mode: 'height', value: height},
    font: {loadSystemFonts: false},
    background: 'rgba(0,0,0,0)',
    shapeRendering: 2,
  }).render();
  return {
    src: `data:image/png;base64,${rendered.asPng().toString('base64')}`,
    width: rendered.width,
    height: rendered.height,
  };
}

function loadMarks() {
  if (!marks) {
    const svg = fs.readFileSync(MARK_PATH, 'utf8');
    marks = {
      header: rasterizeMark(svg, null, 38),
      // Large S, light grey, cropped by the card. Height is bigger than the
      // card so the stroke runs off the top and bottom the way the home card does.
      watermark: rasterizeMark(svg, COLORS.watermark, 1080),
    };
  }
  return marks;
}

/**
 * @param {string} type
 * @param {Record<string, unknown> | null} props
 * @param {...unknown} children
 */
function h(type, props, ...children) {
  const flat = children.flat().filter((child) => child != null && child !== false);
  return React.createElement(type, props, ...flat);
}

/**
 * @param {{eyebrow?: string | null, title: string, description?: string | null}} input
 * @returns {Promise<Buffer>}
 */
async function renderOgCard({eyebrow, title, description}) {
  const satoriModule = await import('satori');
  const satori = satoriModule.default;
  const {header, watermark} = loadMarks();
  const titleMeasure = measurer(700, TITLE_SIZE);
  const descMeasure = measurer(400, DESC_SIZE);
  const eyebrowMeasure = measurer(600, EYEBROW_SIZE);
  const textWidth = TEXT_WIDTH - 12;
  const titleLines = wrapText(title, titleMeasure, textWidth, 2);
  const descriptionLines = description
    ? wrapText(description, descMeasure, textWidth, 2)
    : [];
  const eyebrowLines = eyebrow ? wrapText(eyebrow, eyebrowMeasure, textWidth, 1) : [];

  const element = h(
    'div',
    {
      style: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.background,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter',
      },
    },
        h('img', {
          src: watermark.src,
          width: watermark.width,
          height: watermark.height,
          style: {
            position: 'absolute',
            top: -130,
            right: -290,
          },
        }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          padding: '64px 80px 70px 80px',
          position: 'relative',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            height: 38,
          },
        },
        h('img', {
          src: header.src,
          width: header.width,
          height: header.height,
        }),
        h('div', {
          style: {
            width: 1,
            height: 28,
            background: COLORS.border,
            marginLeft: 16,
            marginRight: 16,
          },
        }),
        h(
          'div',
          {
            style: {
              fontSize: 20,
              fontWeight: 500,
              color: COLORS.text,
              lineHeight: '22px',
            },
          },
          'shellui.com',
        ),
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            marginTop: 36,
            width: TEXT_WIDTH,
          },
        },
        eyebrowLines.length > 0 &&
          h(
            'div',
            {
              style: {
                display: 'flex',
                fontSize: EYEBROW_SIZE,
                lineHeight: `${EYEBROW_LINE}px`,
                height: EYEBROW_LINE,
                fontWeight: 600,
                color: COLORS.muted,
                marginBottom: 14,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              },
            },
            eyebrowLines[0],
          ),
        ...titleLines.map((line) =>
          h(
            'div',
            {
              style: {
                display: 'flex',
                fontSize: TITLE_SIZE,
                lineHeight: `${TITLE_LINE}px`,
                height: TITLE_LINE,
                fontWeight: 700,
                color: COLORS.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              },
            },
            line,
          ),
        ),
        descriptionLines.length > 0 &&
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                marginTop: 22,
              },
            },
            ...descriptionLines.map((line) =>
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    fontSize: DESC_SIZE,
                    lineHeight: `${DESC_LINE}px`,
                    height: DESC_LINE,
                    fontWeight: 400,
                    color: COLORS.muted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  },
                },
                line,
              ),
            ),
          ),
      ),
      h('div', {style: {display: 'flex', flexGrow: 1}}),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.text,
              lineHeight: '28px',
            },
          },
          'docs.shellui.com',
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: '8px 14px 8px 12px',
            },
          },
          h('div', {
            style: {
              width: 8,
              height: 8,
              borderRadius: 999,
              background: COLORS.gold,
              marginRight: 8,
            },
          }),
          h(
            'div',
            {
              style: {
                fontSize: 16,
                fontWeight: 500,
                color: COLORS.muted,
                lineHeight: '20px',
              },
            },
            'MIT licensed',
          ),
        ),
      ),
    ),
  );

  const svg = await satori(element, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: loadSatoriFonts(),
  });
  const png = new Resvg(svg, {
    fitTo: {mode: 'width', value: CARD_WIDTH},
    font: {loadSystemFonts: false},
    background: COLORS.background,
  })
    .render()
    .asPng();
  return Buffer.from(png);
}

/**
 * Default card: heading plus the docs site description. No eyebrow.
 * @returns {Promise<Buffer>}
 */
function renderDefaultCard() {
  return renderOgCard({
    title: DEFAULT_TITLE,
    description: readSiteDescription(),
  });
}

module.exports = {
  CARD_HEIGHT,
  CARD_WIDTH,
  COLORS,
  TEXT_WIDTH,
  renderDefaultCard,
  renderOgCard,
};
