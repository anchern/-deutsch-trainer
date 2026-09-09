import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const template=await readFile(new URL('../scripts/sw-template.js',import.meta.url),'utf8');
function worker(){
  const scope='https://example.test/-deutsch-trainer/',handlers={},stored=new Map(),cacheName=`deutsch-trainer:${scope}:test`;
  const names=[cacheName,`deutsch-trainer:${scope}:old`,'deutsch-trainer:https://example.test/other/:old','unrelated-cache'];
  const deleted=[];let network=0;
  const cache={addAll:async requests=>requests.forEach(r=>stored.set(r.url,{body:r.url})),match:async req=>stored.get(req.url||String(req))};
  vm.runInNewContext(template.replace('__REVISION__','test').replace('__ASSETS__',JSON.stringify(['./index.html','./data/topics.json'])),{
    self:{registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{}},addEventListener:(kind,fn)=>handlers[kind]=fn},
    caches:{open:async()=>cache,keys:async()=>names,delete:async key=>deleted.push(key)},URL,Request,
    fetch:async()=>{network++;throw new Error('offline');}
  });
  return {handlers,stored,deleted,scope,get network(){return network;}};
}
test('offline cache includes subpath assets and serves navigation without network',async()=>{
  const w=worker();let pending;
  w.handlers.install({waitUntil:p=>pending=p});await pending;
  assert.ok(w.stored.has(`${w.scope}data/topics.json`));
  w.handlers.fetch({request:{url:w.scope,method:'GET',mode:'navigate'},respondWith:p=>pending=p});
  const response=await pending;assert.equal(response.body,`${w.scope}index.html`);assert.equal(w.network,0);
  w.handlers.fetch({request:{url:`${w.scope}data/topics.json`,method:'GET',mode:'cors'},respondWith:p=>pending=p});
  assert.equal((await pending).body,`${w.scope}data/topics.json`);assert.equal(w.network,0);
});
test('updates delete only this app scope cache, never other hosted apps',async()=>{
  const w=worker();let pending;w.handlers.activate({waitUntil:p=>pending=p});await pending;
  assert.deepEqual(w.deleted,[`deutsch-trainer:${w.scope}:old`]);
});
