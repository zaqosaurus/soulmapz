// THE SOUL SURVEY — boot (v0.7 Phase 0.1).
// The layer data and basemaps ship gzip-compressed inside the page (base64). They are
// inflated here with the browser's own DecompressionStream — still zero network calls —
// and only then does the survey start. A `--plain` build skips all of this.
(function(){
 function start(){ try{ window.__SOUL_APP__(); }catch(e){ var b=document.getElementById('errbox'); if(b) b.textContent+=(e&&(e.message||e))+"\n"; } }
 var P=window.__PACKED__;
 if(!P){ start(); return; }
 function fail(msg){
  var b=document.getElementById('errbox');
  if(b){ b.textContent=msg; b.style.display='block'; }
 }
 if(typeof DecompressionStream==='undefined'){
  fail('This browser cannot unpack the survey (no DecompressionStream). Any current Chrome, Edge, Firefox or Safari can; the repository also builds a plain version: python3 pipeline/build.py --plain');
  return;
 }
 function inflate(b64){
  var bin=atob(b64), n=bin.length, u=new Uint8Array(n);
  for(var i=0;i<n;i++) u[i]=bin.charCodeAt(i);
  var s=new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(s).text().then(JSON.parse);
 }
 Promise.all([inflate(P.ld), inflate(P.bm)]).then(function(r){
  window.__LAYERDATA__=r[0]; window.__BASEMAPS__=r[1];
  window.__PACKED__=null;
  window.__SURVEY_UNPACKED__=true;
  start();
 }).catch(function(e){ fail('The survey could not unpack its data: '+(e&&e.message||e)); });
})();
