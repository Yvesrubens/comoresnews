import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticle, isPublishable } from '../build/lib/content.mjs';

const cats = ['economie','sport'];
const raw = `---
title: "Titre"
slug: mon-article
category: economie
author: Comoresnews
date: 2026-06-12
image: wp-content/uploads/x.png
excerpt: "chapo"
status: published
---
Corps **markdown**.`;

test('parseArticle extrait les champs', () => {
  const a = parseArticle(raw, cats);
  assert.equal(a.slug, 'mon-article');
  assert.equal(a.category, 'economie');
  assert.match(a.body, /Corps/);
});
test('parseArticle rejette categorie inconnue', () => {
  assert.throws(() => parseArticle(raw.replace('economie','inconnue'), cats));
});
test('parseArticle rejette titre manquant', () => {
  assert.throws(() => parseArticle(raw.replace('title: "Titre"',''), cats));
});
test('isPublishable: scheduled futur = false', () => {
  const a = parseArticle(raw.replace('status: published','status: scheduled'), cats);
  assert.equal(isPublishable(a, '2026-06-01'), false);
  assert.equal(isPublishable(a, '2026-07-01'), true);
});
