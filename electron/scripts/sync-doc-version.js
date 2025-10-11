const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

const changelog = fs.readFileSync(changelogPath, 'utf8');
const changelogMatch = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/);

if (!changelogMatch) {
  console.error('Unable to locate version in CHANGELOG.md');
  process.exit(1);
}

const version = changelogMatch[1];

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

let readme = fs.readFileSync(readmePath, 'utf8');

const versionPattern = /\*\*Version:\*\* [^\n]+/;
readme = readme.replace(versionPattern, `**Version:** ${version}`);

const exePattern = /Dictate \d+\.\d+\.\d+\.exe/g;
readme = readme.replace(exePattern, `Dictate ${version}.exe`);

fs.writeFileSync(readmePath, readme);

console.log(`Updated README version to ${version}`);
