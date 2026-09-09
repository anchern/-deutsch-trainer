import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateTopics } from '../src/content.js';
const manifest = JSON.parse(await readFile(new URL('../data/topics.json', import.meta.url), 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.topics) || manifest.topics.some(p => !/^topics\/[a-z0-9-]+\.json$/.test(p))) throw new Error('Invalid topics manifest');
const topics = validateTopics(await Promise.all(manifest.topics.map(p => readFile(new URL(`../data/${p}`, import.meta.url),'utf8').then(JSON.parse))));
const root = new URL('../', import.meta.url);
const assets = ['index.html','icon.svg','manifest.webmanifest','data/topics.json',...manifest.topics.map(p=>`data/${p}`),...(await readdir(new URL('../src/',import.meta.url))).filter(p=>/\.(js|css)$/.test(p)).map(p=>`src/${p}`)];
const hash = createHash('sha256');
for (const path of assets) { hash.update(path); hash.update(await readFile(new URL(path,root))); }
const template = await readFile(new URL('./sw-template.js',import.meta.url),'utf8');
hash.update(template);
const revision = hash.digest('hex').slice(0,12);
const sw = template.replace('__REVISION__',revision).replace('__ASSETS__',JSON.stringify(assets.map(p=>`./${p}`)));
await writeFile(new URL('sw.js',root),sw);
await rm(new URL('dist/',root),{recursive:true,force:true});
await mkdir(new URL('dist/',root));
for (const path of [...assets,'sw.js']) { const target=new URL(`dist/${path}`,root);await mkdir(new URL('./',target),{recursive:true});await cp(new URL(path,root),target); }
console.log(`Built ${topics.length} topics / ${topics.reduce((n,t)=>n+t.words.length,0)} entries. Offline revision: ${revision}. Output: dist/`);
