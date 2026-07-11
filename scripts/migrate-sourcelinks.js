#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple approach: use relative paths from current working directory
const root = process.cwd();

// Load demo persons with sourceLinks
const demoIndexPath = path.join(root, 'datasets', 'demo', 'persons', 'index.json');
const demoIndex = JSON.parse(fs.readFileSync(demoIndexPath, 'utf-8'));
const demoDir = path.dirname(demoIndexPath);

const demoPersonMap = {};
for (const filename of demoIndex.items) {
  const filePath = path.join(demoDir, filename);
  const person = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (person.sourceLinks) {
    demoPersonMap[person.id] = person.sourceLinks;
  }
}

console.log(`✓ Loaded ${Object.keys(demoPersonMap).length} Demo persons with sourceLinks`);

// Update testing persons
const testingIndexPath = path.join(root, 'datasets', 'testing', 'persons', 'index.json');
const testingIndex = JSON.parse(fs.readFileSync(testingIndexPath, 'utf-8'));
const testingDir = path.dirname(testingIndexPath);

let updated = 0;
for (const filename of testingIndex.items) {
  const filePath = path.join(testingDir, filename);
  const person = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (demoPersonMap[person.id]) {
    person.sourceLinks = demoPersonMap[person.id];
    fs.writeFileSync(filePath, JSON.stringify(person, null, 2) + '\n', 'utf-8');
    updated++;
    console.log(`  ✓ ${person.name}`);
  }
}

console.log(`\n✓ Updated ${updated} Testing persons with sourceLinks`);
