'use strict';
// mindfagg v30: core/database.js (klassisches Script; gemeinsame globale Laufzeit).
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function all(store){return req(tx(store).getAll())}
// Undo/redo stores content and document names per document. Typing is grouped by autosave pauses.
