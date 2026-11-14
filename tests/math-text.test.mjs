import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText } from '../app/math-text.tsx';

test('renders mixed text and LaTeX while keeping plain and invalid text safe', () => {
 const html = renderToStaticMarkup(React.createElement(MathText, {text: 'Tính $\\frac{1}{2}$ và $$x^2$$.'}));
 assert.match(html, /class="katex"/);
 assert.match(html, /katex-display/);
 assert.match(html, /Tính /);
 const fallback = renderToStaticMarkup(React.createElement(MathText, {text: '<b> $\\badcommand$'}));
 assert.match(fallback, /&lt;b&gt;/);
 assert.match(fallback, /\$\\badcommand\$/);
});

test('example question bank contains valid renderable math', async () => {
 const data=JSON.parse(await readFile(new URL('../examples/toan-12.json', import.meta.url),'utf8'));
 assert.deepEqual(data.map(q=>q.answer),['D','C']);
 for (const q of data) for (const text of [q.question,...q.options]) {
  const html=renderToStaticMarkup(React.createElement(MathText,{text}));
  assert.match(html,/class="katex"/);
  assert.doesNotMatch(html,/\$|katex-error/);
 }
});
