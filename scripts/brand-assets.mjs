import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { brand } from '../src/lib/brand.js';
import { templates } from '../src/data/templates.js';
import { productPages } from '../src/data/productPages.js';
import { resourcePages } from '../src/data/resourcePages.js';
import { escapeHtml } from '../src/lib/seo.js';

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${brand.themeColor}"/><path d="${brand.markPath}" fill="white"/></svg>`;
const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { defaultFontFamily: 'Arial' } }).render().asPng();
function lines(value, max = 24) {
  const result = [''];
  for (const word of value.split(' ')) {
    if (`${result.at(-1)} ${word}`.trim().length > max && result.at(-1)) result.push(word);
    else result[result.length - 1] = `${result.at(-1)} ${word}`.trim();
  }
  return result;
}

function socialCard(title, label, subtitle, nodes = ['Your next big idea', 'Explore a possibility', 'Make a connection', 'Find your next step']) {
  const heading = lines(title);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#faf9fe"/>
    <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#ded9eb"/></pattern></defs>
    <rect x="710" width="490" height="630" fill="url(#dots)"/>
    <g transform="translate(64 54)"><rect width="48" height="48" rx="13" fill="${brand.themeColor}"/><path transform="scale(.75)" d="${brand.markPath}" fill="white"/><text x="64" y="33" font-family="Arial" font-size="29" font-weight="700" fill="#151621">${escapeHtml(brand.name)}</text></g>
    <text x="64" y="195" font-family="Arial" font-size="17" font-weight="600" fill="${brand.themeColor}" letter-spacing="2">${escapeHtml(label.toUpperCase())}</text>
    <text x="60" y="270" font-family="Arial" font-size="55" font-weight="700" fill="#151621">${heading.map((line, i) => `<tspan x="60" dy="${i ? 66 : 0}">${escapeHtml(line)}</tspan>`).join('')}</text>
    <text x="64" y="${300 + heading.length * 66}" font-family="Arial" font-size="22" fill="#5f687b">${escapeHtml(subtitle)}</text>
    <text x="64" y="569" font-family="Arial" font-size="17" fill="#5f687b">Private by default   ·   No account needed</text>
    <g fill="none" stroke="#c1aedf" stroke-width="3"><path d="M942 286v-49q0-17 17-17h34"/><path d="M942 345v62q0 17 17 17h34"/><path d="M903 317h-55q-15 0-15 15v82"/></g>
    <g font-family="Arial" font-size="18" text-anchor="middle">
      <rect x="778" y="277" width="274" height="83" rx="16" fill="${brand.themeColor}"/><text x="915" y="326" fill="white" font-weight="700">${escapeHtml(nodes[0])}</text>
      <rect x="903" y="149" width="224" height="82" rx="14" fill="white" stroke="#d7dce7"/><text x="1015" y="198" fill="#42495b">${escapeHtml(nodes[1])}</text>
      <rect x="951" y="400" width="204" height="80" rx="14" fill="white" stroke="#d7dce7"/><text x="1053" y="448" fill="#42495b">${escapeHtml(nodes[2])}</text>
      <rect x="743" y="420" width="183" height="79" rx="14" fill="white" stroke="#d7dce7"/><text x="835" y="468" fill="#42495b">${escapeHtml(nodes[3])}</text>
    </g>
  </svg>`;
}

export async function generateBrandAssets(directory, { social = true } = {}) {
  await mkdir(`${directory}/icons`, { recursive: true });
  await writeFile(`${directory}/brand.svg`, svgIcon);
  await mkdir(`${directory}/brand`, { recursive: true });
  await writeFile(`${directory}/brand/drawanything-wordmark.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="96" viewBox="0 0 460 96" role="img" aria-labelledby="title"><title id="title">${escapeHtml(brand.name)}</title><g transform="translate(8 16)"><rect width="64" height="64" rx="16" fill="${brand.themeColor}"/><path d="${brand.markPath}" fill="white"/></g><text x="92" y="64" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="700" letter-spacing="-1.5" fill="#151621">${escapeHtml(brand.name)}</text></svg>`);
  // Cached installations can still request the former favicon URL.
  await writeFile(`${directory}/nova.svg`, svgIcon);
  for (const size of [32, 48, 180, 192, 512]) await writeFile(`${directory}/icons/icon-${size}.png`, png(svgIcon, size));
  // Keep the entire mark inside the central 80%-diameter safe-area circle.
  const maskable = svgIcon.replace('rx="16"', 'rx="0"').replace('<path ', '<path transform="translate(6.4 6.4) scale(.8)" ');
  await writeFile(`${directory}/icons/maskable-512.png`, png(maskable, 512));
  const sizes = [16, 32, 48], images = sizes.map(size => png(svgIcon, size));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((bytes, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index]; header[entry + 1] = sizes[index];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  await writeFile(`${directory}/favicon.ico`, Buffer.concat([header, ...images]));
  await writeFile(`${directory}/manifest.webmanifest`, JSON.stringify({ id: '/', name: `${brand.name} — Private whiteboard`, short_name: brand.name, description: brand.description, lang: 'en', categories: ['productivity', 'education'], start_url: '/projects', scope: '/', display: 'standalone', background_color: brand.backgroundColor, theme_color: brand.themeColor, icons: [{ src: `/brand.svg?v=${brand.assetVersion}`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }, ...[192, 512].map(size => ({ src: `/icons/icon-${size}.png?v=${brand.assetVersion}`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })), { src: `/icons/maskable-512.png?v=${brand.assetVersion}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }], shortcuts: [{ name: 'Open workspace', url: '/projects' }, { name: 'Browse templates', url: '/templates' }] }, null, 2));
  if (!social) return;
  await mkdir(`${directory}/social`, { recursive: true });
  const cards = [{ id: 'home', title: brand.tagline, label: 'A private online whiteboard', subtitle: 'Brainstorm. Connect. Find your next move.' }, { id: 'templates', title: 'A little structure. Endless possibilities.', label: `${templates.length} editable templates`, subtitle: 'Your next idea already has a starting point.' }, ...[...productPages, ...resourcePages].map(page => ({ id: page.path.slice(1), ...page.social }))];
  for (const card of cards) await writeFile(`${directory}/social/${card.id}.png`, png(socialCard(card.title, card.label, card.subtitle, card.nodes), 1200));
}

if (process.argv.includes('--public')) await generateBrandAssets('public', { social: false });
