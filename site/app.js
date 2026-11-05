"use strict";
(function(){
const $=s=>document.querySelector(s);
const errbox=$('#errbox');
function err(e){ if(errbox) errbox.textContent+=((e&&(e.message||e))+"\n"); }
window.addEventListener('error',ev=>err(ev.error||ev.message));

const R=window.__REGISTRY__, D=window.__LAYERDATA__, B=window.__BASEMAPS__;
const live=R.layers.filter(l=>l.status==='live');
const byId={}; R.layers.forEach(l=>byId[l.id]=l);
const themeById={}; R.themes.forEach(t=>themeById[t.id]=t);
R.meta.repo=R.meta.repo||'ansalamalasna/soulmap';R.meta.site=R.meta.site||('https://'+R.meta.repo.split('/')[0]+'.github.io/'+R.meta.repo.split('/')[1]+'/');
const GH='https://github.com/'+R.meta.repo+'/blob/main/';
const fmtInt=n=>Number(n||0).toLocaleString('en-US');
const MONTHS=["","January","February","March","April","May","June","July","August","September","October","November","December"];
const STATE_POSTAL={"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"};
const STATE_NAME={}; Object.keys(STATE_POSTAL).forEach(n=>STATE_NAME[STATE_POSTAL[n]]=n);
const ISO_NUM={MX:"484",PH:"608",BR:"076",DE:"276",FR:"250",IT:"380",GB:"826",ES:"724",CA:"124",JP:"392",PL:"616",AR:"032",NL:"528",CO:"170",UA:"804",AU:"036",EG:"818",PE:"604",CL:"152",US:"840"};
const TINY_STATES=new Set(["RI","DE","DC","CT","NJ","MA","MD","NH","VT"]);

// visual voice per layer
const VIS={
 'memory-births':{cellCore:.40,starCore:.62,cA:.5},
 'power-datacenters':{r:2.35,core:.76,cA:.42},
 'power-fortune500':{core:.72},
 'motion-fulfillment':{core:.72,cA:.36},
 'loss-crashes':{r:1.45,core:.38,cA:.42},
 'omen-names':{r:2.0,core:.6},
 'wonder-ufos':{core:.46,cA:.32},
 'residue-superfund':{core:.66},
 'betrayal-ledger':{core:.82}
};
const CONTOUR_T=[.10,.18,.30,.45,.62,.82];
const FIPS_POSTAL={"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
const money=v=>v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e6?'$'+(v/1e6).toFixed(1)+'M':v>=1e3?'$'+Math.round(v/1e3)+'K':'$'+Math.round(v||0);
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return u;}};
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ---------- geometry ----------
const topo=window.topojson;
const geo={
 land:topo.feature(B.land,B.land.objects.land),
 countries:topo.feature(B.countries,B.countries.objects.countries).features,
 countryMesh:topo.mesh(B.countries,B.countries.objects.countries,(a,b)=>a!==b),
 states:topo.feature(B.states,B.states.objects.states).features,
 stateMesh:topo.mesh(B.states,B.states.objects.states,(a,b)=>a!==b),
 nation:topo.feature(B.nation,B.nation.objects.nation)
};

// ---------- state ----------
let scope='us';
let t=d3.zoomIdentity;
const alpha={},target={};
const CURATED=['memory-births','loss-crashes','power-datacenters','omen-names'];
live.forEach(l=>{const on=CURATED.indexOf(l.id)>=0?1:0;alpha[l.id]=on;target[l.id]=on;});
let dirty=true,terrainDirty=true,plateOpen=null,savedTargets=null;
let W=0,H=0,dpr=1;
const SC={};           // per-scope caches
const glowBMs={};      // lid -> {cv,ctx,t:{k,x,y}}
let qt=null,qtTimer=null,bakeTimer=null;
let hoverPt=null;
let zooming=false,zoomEndT=null,needBake=false,lastBakePump=0,bakeRR=0;
let era=-1,eraPlay=null,reading=null,readingSaved=null,orientTimers=[],hashHadState=false,hashTimer=null;
let refNames=true,refBounds=true;const refSyncs=[];
let lens={},pickMode=null;
// ---- v0.6 state ----
let tipPinned=null;            // a tooltip held in place by a click or tap: {content,x,y}
let rec=null;                  // the recorder: {title,stops:[],pin:[lon,lat]|null,seedTitle}
let tour=null,tourIdx=null,tourParam=null; // a citizen reading loaded from the link, its cursor, its encoded form
let lensPlay=null;             // a lens stepping through time: {lid,field,idx,timer}
let pendingGeo=null;           // permalink camera waiting for the projection to exist
function hasGlow(l){return !!(l.forms.points||l.forms.flows);}

const cvs={base:$('#cvBase'),terr:$('#cvTerrain'),glow:$('#cvGlow'),lab:$('#cvLabel')};
const ctxs={};
const hitCv=document.createElement('canvas');
const hitCtx=hitCv.getContext('2d');

function sizeCanvases(){
 W=window.innerWidth;H=window.innerHeight;dpr=Math.min(window.devicePixelRatio||1,2);
 for(const k in cvs){const c=cvs[k];c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);ctxs[k]=c.getContext('2d');}
}
function padLeft(){const r=$('#rail');const rb=r?r.getBoundingClientRect():{right:340};return Math.min(rb.right+22,W*0.42);}
function extent(){return [[padLeft(),108],[W-46,H-86]];}

function hexA(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}
function mixWhite(hex,f){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgb(${Math.round(r+(255-r)*f)},${Math.round(g+(255-g)*f)},${Math.round(b+(255-b)*f)})`;}

function makeSprite(hex,core){
 const S=64,c=document.createElement('canvas');c.width=S;c.height=S;const x=c.getContext('2d');
 const g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
 g.addColorStop(0,hexA('#ffffff',0)); // placeholder replaced below
 const grad=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
 grad.addColorStop(0,`rgba(255,255,255,${core})`);
 grad.addColorStop(.18,hexA(hex,core*.85));
 grad.addColorStop(.45,hexA(hex,core*.30));
 grad.addColorStop(1,hexA(hex,0));
 x.fillStyle=grad;x.fillRect(0,0,S,S);
 return c;
}
const SPR={};
function buildSprites(){
 SPR.memCell=makeSprite(byId['memory-births'].accent,VIS['memory-births'].cellCore);
 SPR.memStar=makeSprite(byId['memory-births'].accent,VIS['memory-births'].starCore);
 SPR.dc=makeSprite(byId['power-datacenters'].accent,VIS['power-datacenters'].core);
 SPR.f500=makeSprite(byId['power-fortune500'].accent,VIS['power-fortune500'].core);
 SPR.ful=makeSprite(byId['motion-fulfillment'].accent,VIS['motion-fulfillment'].core);
 SPR.crash=makeSprite(byId['loss-crashes'].accent,VIS['loss-crashes'].core);
 SPR.omenD=makeSprite(byId['omen-names'].accent,VIS['omen-names'].core);
 SPR.omenL=makeSprite(byId['omen-names'].accent2||'#f2ead8',VIS['omen-names'].core);
 if(byId['wonder-ufos'])SPR.ufo=makeSprite(byId['wonder-ufos'].accent,VIS['wonder-ufos'].core);
 if(byId['residue-superfund'])SPR.sf=makeSprite(byId['residue-superfund'].accent,VIS['residue-superfund'].core);
 if(byId['betrayal-ledger'])SPR.coin=makeSprite(byId['betrayal-ledger'].accent,VIS['betrayal-ledger'].core);
}
// Any point layer the registry declares gets a sprite in its own accent, even if no
// hand-tuned voice exists for it yet — a new layer must never render invisible.
function spriteFor(lid){
 if(!SPR['_'+lid])SPR['_'+lid]=makeSprite(byId[lid].accent,(VIS[lid]&&VIS[lid].core)||.62);
 return SPR['_'+lid];
}
function inEra(b){
 if(b==null||isNaN(b))return false;
 if(era===0)return b<=500;
 if(era===1)return b>=501&&b<=1500;
 if(era===2)return b>=1501&&b<=1800;
 if(era===3)return b>=1801&&b<=1900;
 if(era===4)return b>=1901;
 return true;
}

function projArrays(proj,lonA,latA){
 const n=lonA.length,xs=new Float32Array(n),ys=new Float32Array(n),keep=new Uint8Array(n);
 for(let i=0;i<n;i++){const p=proj([lonA[i],latA[i]]);if(p){xs[i]=p[0];ys[i]=p[1];keep[i]=1;}}
 return {xs,ys,keep,n};
}

function gaussBlur(src,GW,GH){
 const R2=6,sig=2.3,K=[];let ks=0;
 for(let i=-R2;i<=R2;i++){const v=Math.exp(-i*i/(2*sig*sig));K.push(v);ks+=v;}
 for(let i=0;i<K.length;i++)K[i]/=ks;
 const tmp=new Float32Array(src.length),out=new Float32Array(src.length);
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0;for(let k=-R2;k<=R2;k++){const xx=Math.min(GW-1,Math.max(0,x+k));s+=src[y*GW+xx]*K[k+R2];}tmp[y*GW+x]=s;}
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0;for(let k=-R2;k<=R2;k++){const yy=Math.min(GH-1,Math.max(0,y+k));s+=tmp[yy*GW+x]*K[k+R2];}out[y*GW+x]=s;}
 return out;
}

function buildScope(s){
 if(SC[s])return SC[s];
 const ext=extent();
 const proj=s==='us'
   ? d3.geoAlbersUsa().fitExtent(ext,geo.nation)
   : d3.geoEqualEarth().fitExtent([[ext[0][0],ext[0][1]+8],[ext[1][0],ext[1][1]-8]],{type:'Sphere'});
 const gp=d3.geoPath(proj);
 const C={scope:s,proj,ext,gp,paths:{},layers:{},grids:{},contours:{},statePaths:{},stateCent:{},countryPaths:{},countryCent:{}};
 // base paths
 if(s==='world'){
  C.paths.sphere=new Path2D(gp({type:'Sphere'}));
  C.paths.grat=new Path2D(gp(d3.geoGraticule10()));
  C.paths.land=new Path2D(gp(geo.land));
  C.paths.borders=new Path2D(gp(geo.countryMesh));
  for(const iso in ISO_NUM){
   const f=geo.countries.find(f=>String(f.id)===ISO_NUM[iso]);
   if(f){C.countryPaths[iso]=new Path2D(gp(f));C.countryCent[iso]=gp.centroid(f);}
  }
 }else{
  C.paths.nation=new Path2D(gp(geo.nation));
  C.paths.stateMesh=new Path2D(gp(geo.stateMesh));
  geo.states.forEach(f=>{
   const po=STATE_POSTAL[f.properties.name];if(!po)return;
   const d=gp(f);if(!d)return;
   C.statePaths[po]=new Path2D(d);C.stateCent[po]=gp.centroid(f);
  });
 }
 // layer projections
 for(const l of live){
  if(!l.scopes.includes(s))continue;
  const d=D[l.id];if(!d)continue;
  if(d.kind==='memory'){
   C.layers[l.id]={cells:projArrays(proj,d.cells.lon,d.cells.lat),stars:projArrays(proj,d.stars.lon,d.stars.lat)};
  }else if(d.kind==='points'){
   C.layers[l.id]={pts:projArrays(proj,d.lon,d.lat)};
  }else if(d.kind==='flows'){
   C.layers[l.id]={fa:projArrays(proj,d.arcs.alon,d.arcs.alat),fb:projArrays(proj,d.arcs.blon,d.arcs.blat)};
  }
 }
 // density grids + contours
 const exw=ext[1][0]-ext[0][0],exh=ext[1][1]-ext[0][1];
 const GW=520,GH=Math.max(110,Math.round(GW*exh/exw));
 C.GW=GW;C.GH=GH;
 for(const l of live){
  if(!l.scopes.includes(s)||!D[l.id])continue;
  if(!(l.weight>0))continue;
  const d=D[l.id],grid=new Float32Array(GW*GH);
  const put=(x,y,w)=>{
   const gx=Math.floor((x-ext[0][0])/exw*GW),gy=Math.floor((y-ext[0][1])/exh*GH);
   if(gx>=0&&gx<GW&&gy>=0&&gy<GH)grid[gy*GW+gx]+=w;
  };
  if(d.kind==='memory'){
   const P=C.layers[l.id].cells;
   for(let i=0;i<P.n;i++)if(P.keep[i])put(P.xs[i],P.ys[i],Math.log1p(d.cells.v[i]));
  }else{
   const P=C.layers[l.id].pts;
   const vv=d.v;
   for(let i=0;i<P.n;i++)if(P.keep[i])put(P.xs[i],P.ys[i],vv?Math.min(vv[i],4):1);
  }
  let g=gaussBlur(grid,GW,GH);
  const nz=[];for(let i=0;i<g.length;i++)if(g[i]>0)nz.push(g[i]);
  nz.sort((a,b)=>a-b);
  const p99=nz.length?nz[Math.min(nz.length-1,Math.floor(nz.length*.996))]:1;
  for(let i=0;i<g.length;i++)g[i]=Math.min(1,g[i]/p99);
  C.grids[l.id]=g;
  if(l.forms.contours){
   const cs=d3.contours().size([GW,GH]).thresholds(CONTOUR_T)(g);
   C.contours[l.id]=cs.map((c,ci)=>{
    const p=new Path2D();
    c.coordinates.forEach(poly=>poly.forEach(ring=>{
     ring.forEach((pt,j)=>{
      const x=ext[0][0]+pt[0]/GW*exw,y=ext[0][1]+pt[1]/GH*exh;
      j?p.lineTo(x,y):p.moveTo(x,y);
     });p.closePath();
    }));
    return {p,i:ci};
   });
  }
 }
 // shade canvas
 C.shadeCv=document.createElement('canvas');C.shadeCv.width=GW;C.shadeCv.height=GH;
 C.shadeCtx=C.shadeCv.getContext('2d');
 // reference gazetteer (projected, priority-sorted)
 if(B.places){
  const rows=s==='us'?B.places.us:B.places.world;
  const rp=[];
  for(const r of rows){
   const pt=proj([r[3],r[2]]);
   if(!pt)continue;
   rp.push({x:pt[0],y:pt[1],la:r[2],lo:r[3],name:r[0],st:r[1],pop:r[4],cap:r[5],
            score:r[4]+(r[5]?(s==='us'?500000:800000):0)});
  }
  rp.sort((a,b)=>b.score-a.score);
  C.places=rp;
 }
 SC[s]=C;
 return C;
}
function ensureCountyMesh(C){
 if(C.countyMeshPath!==undefined||!B.counties)return;
 try{
  C.countyMeshPath=new Path2D(C.gp(topo.mesh(B.counties,B.counties.objects.counties,(a,b)=>a!==b)));
 }catch(e){C.countyMeshPath=null;}
}

function scopeHas(lid){return byId[lid].scopes.includes(scope);}
function activeIds(){return live.filter(l=>scopeHas(l.id)&&target[l.id]>0).map(l=>l.id);}

// ---------- terrain ----------
function recomputeShade(){
 const C=SC[scope],GW=C.GW,GH=C.GH;
 const E=new Float32Array(GW*GH);let mx=0;
 for(const l of live){
  const g=layerGrid(C,l.id);if(!g)continue;
  const a=alpha[l.id]*(l.weight||0);if(a<=0.01)continue;
  for(let i=0;i<E.length;i++)E[i]+=g[i]*a;
 }
 for(let i=0;i<E.length;i++)if(E[i]>mx)mx=E[i];
 if(mx>0)for(let i=0;i<E.length;i++)E[i]/=mx;
 const img=C.shadeCtx.createImageData(GW,GH);
 const data=img.data,Z=26,lx=-0.577,ly=-0.577,lz=0.577;
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
  const i=y*GW+x;
  const e=E[i];if(e<=0.004)continue;
  const x0=Math.max(0,x-1),x1=Math.min(GW-1,x+1),y0=Math.max(0,y-1),y1=Math.min(GH-1,y+1);
  let nx=-(E[y*GW+x1]-E[y*GW+x0])*Z*.5,ny=-(E[y1*GW+x]-E[y0*GW+x])*Z*.5,nz=1;
  const nl=Math.sqrt(nx*nx+ny*ny+nz*nz);nx/=nl;ny/=nl;nz/=nl;
  const ndl=nx*lx+ny*ly+nz*lz;
  const m=Math.pow(e,.6);
  // compose: mass tint + lit + shadow
  let r=110,g=140,b=190,a=m*.055;
  const lit=Math.max(0,(ndl-.42)*1.8)*m*.14;
  const sh=Math.max(0,(.42-ndl)*1.6)*m*.22;
  // over-composite lit (light blue-white)
  let na=a+lit*(1-a);
  if(na>0){r=(r*a*(1-lit)+208*lit)/na;g=(g*a*(1-lit)+224*lit)/na;b=(b*a*(1-lit)+252*lit)/na;a=na;}
  // over-composite shadow (black)
  na=a+sh*(1-a);
  if(na>0){r=r*a*(1-sh)/na;g=g*a*(1-sh)/na;b=b*a*(1-sh)/na;a=na;}
  const o=i*4;data[o]=r;data[o+1]=g;data[o+2]=b;data[o+3]=Math.min(255,a*255);
 }
 C.shadeCtx.putImageData(img,0,0);
 terrainDirty=false;
}

// ---------- draw ----------
function applyT(ctx){ctx.setTransform(dpr*t.k,0,0,dpr*t.k,dpr*t.x,dpr*t.y);}
function idT(ctx){ctx.setTransform(dpr,0,0,dpr,0,0);}

let hatchPat=null;
function hatch(ctx){
 if(hatchPat)return hatchPat;
 const c=document.createElement('canvas');c.width=8;c.height=8;const x=c.getContext('2d');
 x.strokeStyle='rgba(255,79,154,0.10)';x.lineWidth=1;
 x.beginPath();x.moveTo(-2,10);x.lineTo(10,-2);x.stroke();
 x.beginPath();x.moveTo(-2,4);x.lineTo(4,-2);x.stroke();
 hatchPat=ctx.createPattern(c,'repeat');return hatchPat;
}

function drawBase(){
 const ctx=ctxs.base,C=SC[scope];
 idT(ctx);ctx.clearRect(0,0,W,H);
 ctx.fillStyle='#070a10';ctx.fillRect(0,0,W,H);
 applyT(ctx);
 const lw=x=>x/t.k;
 const bB=refBounds?Math.min(.5,t.k*.035):0; // boundary emphasis grows with zoom
 if(scope==='world'){
  ctx.strokeStyle='rgba(64,86,120,.35)';ctx.lineWidth=lw(1);ctx.stroke(C.paths.sphere);
  ctx.strokeStyle='rgba(38,52,76,.28)';ctx.lineWidth=lw(.5);ctx.stroke(C.paths.grat);
  ctx.fillStyle='#0e131b';ctx.fill(C.paths.land);
  ctx.strokeStyle='rgba(80,98,126,'+(.45+bB*.5)+')';ctx.lineWidth=lw(.6+bB);ctx.stroke(C.paths.land);
  ctx.strokeStyle='rgba(52,66,92,'+(.5+bB*.6)+')';ctx.lineWidth=lw(.45+bB);ctx.stroke(C.paths.borders);
 }else{
  ctx.fillStyle='#0e131b';ctx.fill(C.paths.nation);
  ctx.strokeStyle='rgba(58,74,100,'+(.55+bB*.55)+')';ctx.lineWidth=lw(.55+bB*1.2);ctx.stroke(C.paths.stateMesh);
  ctx.strokeStyle='rgba(96,116,148,'+(.6+bB*.4)+')';ctx.lineWidth=lw(1+bB);ctx.stroke(C.paths.nation);
  if(refBounds&&t.k>=4.5){
   ensureCountyMesh(C);
   if(C.countyMeshPath){ctx.strokeStyle='rgba(96,116,148,.20)';ctx.lineWidth=lw(.5);ctx.stroke(C.countyMeshPath);}
  }
 }
 // county tint layers (static base-space bitmaps, faded by layer alpha)
 if(scope==='us'){
  for(const lT of countyTintLayers()){
   const aT=alpha[lT.id]||0;
   if(aT<=0.02)continue;
   ensureCounties(C);
   const cvT=countyTintFor(C,lT.id);
   if(!cvT)continue;
   const cmT=compareMode;
   const clipT=cmT&&(lT.id===cmT.a||lT.id===cmT.b);
   if(clipT){
    ctx.save();idT(ctx);ctx.beginPath();
    if(lT.id===cmT.a)ctx.rect(0,0,cmT.x*W,H);else ctx.rect(cmT.x*W,0,W-cmT.x*W,H);
    ctx.clip();
   }
   applyT(ctx);
   ctx.globalAlpha=aT;
   ctx.drawImage(cvT,0,0,W,H);
   ctx.globalAlpha=1;
   if(clipT){ctx.restore();applyT(ctx);}
  }
 }
 // desire tint
 const dl=byId['desire-searches'];
 const da=alpha['desire-searches']||0;
 if(da>0.02&&dl.scopes.includes(scope)){
  const dd=D['desire-searches'];
  if(scope==='us'){
   ctx.save();
   for(const st in dd.us){
    const p=C.statePaths[st];if(!p)continue;
    ctx.fillStyle=hexA(dl.accent,.06*da);ctx.fill(p);
   }
   for(const st of dd.dark){
    const p=C.statePaths[st];if(!p)continue;
    ctx.fillStyle=`rgba(3,5,9,${.52*da})`;ctx.fill(p);
    ctx.fillStyle=hatch(ctx);ctx.fill(p);
   }
   ctx.restore();
  }else{
   for(const iso in dd.world){
    const p=C.countryPaths[iso];if(!p)continue;
    ctx.fillStyle=hexA(dl.accent,.10*da);ctx.fill(p);
   }
  }
 }
}

function drawTerrain(){
 const ctx=ctxs.terr,C=SC[scope];
 if(terrainDirty)recomputeShade();
 idT(ctx);ctx.clearRect(0,0,W,H);
 applyT(ctx);
 const ext=C.ext,exw=ext[1][0]-ext[0][0],exh=ext[1][1]-ext[0][1];
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 if(!compareMode){ctx.globalAlpha=1;ctx.drawImage(C.shadeCv,ext[0][0],ext[0][1],exw,exh);}
 const cm2=compareMode;
 for(const l of live){
  const cs=layerContours(C,l.id);if(!cs)continue;
  const a=alpha[l.id];if(a<=0.02)continue;
  const cA=(VIS[l.id]&&VIS[l.id].cA)||.4;
  const clip=cm2&&(l.id===cm2.a||l.id===cm2.b);
  if(clip){
   ctx.save();idT(ctx);ctx.beginPath();
   if(l.id===cm2.a)ctx.rect(0,0,cm2.x*W,H);else ctx.rect(cm2.x*W,0,W-cm2.x*W,H);
   ctx.clip();applyT(ctx);
  }
  ctx.strokeStyle=l.accent;
  for(const c of cs){
   ctx.globalAlpha=a*cA*(.3+.7*c.i/(CONTOUR_T.length-1));
   ctx.lineWidth=(0.5+c.i*0.09)/t.k;
   ctx.stroke(c.p);
  }
  if(clip)ctx.restore();
 }
 ctx.globalAlpha=1;
}

function drawPointsTo(ctx,lid,step){
 // draws layer's points in SCREEN space under current t (ctx pre-set to identity*dpr)
 // step>1 = gesture-time decimation for very large layers (alpha-compensated)
 const C=SC[scope],d=D[lid],L=C.layers[lid];if(!L)return;
 const k=t.k,kk=Math.pow(k,.42);
 const draw=(spr,x,y,r)=>{const sx=x*k+t.x,sy=y*k+t.y;if(sx<-60||sx>W+60||sy<-60||sy>H+60)return;const rr=r*kk;ctx.drawImage(spr,sx-rr,sy-rr,rr*2,rr*2);};
 if(d.kind==='flows'){
  const A=L.fa,Bf=L.fb,hh=d.arcs.hh,am=d.arcmax||1;
  const st2=(step>1&&A.n>6000)?step:1;
  ctx.strokeStyle=byId[lid].accent;
  ctx.lineCap='round';
  for(let i=0;i<A.n;i+=st2){
   if(!A.keep[i]||!Bf.keep[i])continue;
   const ax=A.xs[i]*k+t.x,ay=A.ys[i]*k+t.y,bx=Bf.xs[i]*k+t.x,by=Bf.ys[i]*k+t.y;
   if((ax<-80&&bx<-80)||(ax>W+80&&bx>W+80)||(ay<-80&&by<-80)||(ay>H+80&&by>H+80))continue;
   const f=Math.min(1,hh[i]/am);
   ctx.globalAlpha=(0.07+0.45*Math.pow(f,0.7))*(st2>1?1.6:1);
   ctx.lineWidth=0.5+1.9*f;
   const mx=(ax+bx)/2,my=(ay+by)/2,ddx=bx-ax,ddy=by-ay;
   ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo(mx-ddy*0.16,my+ddx*0.16,bx,by);ctx.stroke();
  }
  ctx.globalAlpha=1;
  return;
 }
 if(d.kind==='memory'){
  const wf=scope==='world'?0.68:1;
  const st2=(step>1&&L.cells.n>30000)?step:1;
  ctx.globalAlpha=Math.min(1,(scope==='world'?0.82:1)*(st2>1?1.7:1));
  const P=L.cells,vv=d.cells.v,ee=d.cells.e;
  for(let i=0;i<P.n;i+=st2){
   if(!P.keep[i])continue;
   const val=era<0?vv[i]:(ee&&ee[i]?ee[i][era]:0);
   if(!val)continue;
   const r=(1.1+Math.log1p(val)*0.62)*wf;
   draw(SPR.memCell,P.xs[i],P.ys[i],Math.min(r,7.5*wf));
  }
  ctx.globalAlpha=scope==='world'?0.82:1;
  const S=L.stars,sv=d.stars.v,sb=d.stars.birth;
  for(let i=0;i<S.n;i++){
   if(!S.keep[i])continue;
   if(era>=0&&!inEra(sb[i]))continue;
   draw(SPR.memStar,S.xs[i],S.ys[i],(1.2+sv[i]*.014)*wf);
  }
  ctx.globalAlpha=1;
 }else{
  const P=L.pts;
  const LZ=lens[lid];
  const lzSkip=LZ?(ii)=>{const arr=d[LZ.field];return arr&&arr[ii]!==LZ.v;}:null;
  if(lid==='loss-crashes'){
   const vv=d.v;
   const st2=(step>1&&P.n>30000)?step:1;
   if(st2>1)ctx.globalAlpha=Math.min(1,1.7);
   for(let i=0;i<P.n;i+=st2){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(SPR.crash,P.xs[i],P.ys[i],Math.min(1.55+(vv[i]-1)*.8,4.2));}
   ctx.globalAlpha=1;
  }else if(lid==='power-datacenters'){
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(SPR.dc,P.xs[i],P.ys[i],2.0);}
  }else if(lid==='power-fortune500'){
   const vv=d.v;
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(SPR.f500,P.xs[i],P.ys[i],1.7+Math.sqrt(Math.max(vv[i],0))/826*7);}
  }else if(lid==='motion-fulfillment'){
   const tt=d.t;
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(SPR.ful,P.xs[i],P.ys[i],tt[i]===2?3.1:tt[i]===1?2.1:2.6);}
  }else if(lid==='omen-names'){
   const ss=d.s;
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(ss[i]?SPR.omenL:SPR.omenD,P.xs[i],P.ys[i],2.0);}
  }else if(lid==='wonder-ufos'){
   const vv=d.v,uw=scope==='world'?0.8:1;
   if(scope==='world')ctx.globalAlpha=0.75;
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(SPR.ufo,P.xs[i],P.ys[i],(1.35+Math.log1p(vv?vv[i]:1)*.6)*uw);}
   ctx.globalAlpha=1;
  }else if(lid==='residue-superfund'){
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(SPR.sf,P.xs[i],P.ys[i],2.0);}
  }else if(lid==='betrayal-ledger'){
   // coins: area follows the amount stolen; a crisp ring makes each one a receipt, not a star
   const vv=d.v,vmax=d.vmaxv||(d.vmaxv=vv.reduce((m,x)=>Math.max(m,x),1));
   ctx.strokeStyle=byId[lid].accent;ctx.lineWidth=1;
   for(let i=0;i<P.n;i++){
    if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;
    const r=2.4+Math.sqrt(Math.max(vv[i],0)/vmax)*7.5;
    draw(SPR.coin,P.xs[i],P.ys[i],r);
    const sx=P.xs[i]*k+t.x,sy=P.ys[i]*k+t.y,rr=r*kk*.5;
    if(sx<-60||sx>W+60||sy<-60||sy>H+60)continue;
    ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(sx,sy,Math.max(1.6,rr),0,Math.PI*2);ctx.stroke();
   }
   ctx.globalAlpha=1;
  }else{
   // registry-only layer: default voice (sized by value when the pack carries one)
   const spr=spriteFor(lid),vv=d.v;
   for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;draw(spr,P.xs[i],P.ys[i],vv?Math.min(1.6+Math.log1p(vv[i])*.55,5):2.0);}
  }
  if(LZ&&LZ.constellation)drawConstellation(ctx,lid,L,lzSkip);
 }
}
// ---------- v0.6: constellations ----------
// With an entity lens active (one operator, one facility class), the filtered members are
// linked into a nearest-neighbour web: the network made visible. Edges are cached per scope.
function constellationEdges(C,lid,LZ,P,lzSkip){
 C.constel=C.constel||{};
 const key=lid+'|'+LZ.field+'|'+LZ.v;
 if(C.constel[key])return C.constel[key];
 const idx=[];
 for(let i=0;i<P.n;i++){if(!P.keep[i])continue;if(lzSkip&&lzSkip(i))continue;idx.push(i);}
 const edges=[];
 if(idx.length>=2&&idx.length<=700){
  const ext=C.ext,maxD=(ext[1][0]-ext[0][0])*0.24,maxD2=maxD*maxD,seen=new Set();
  for(let a=0;a<idx.length;a++){
   const i=idx[a],x=P.xs[i],y=P.ys[i];
   let b1=-1,d1=Infinity,b2=-1,d2=Infinity;
   for(let b=0;b<idx.length;b++){
    if(b===a)continue;const j=idx[b],dx=P.xs[j]-x,dy=P.ys[j]-y,dd=dx*dx+dy*dy;
    if(dd<d1){b2=b1;d2=d1;b1=j;d1=dd;}else if(dd<d2){b2=j;d2=dd;}
   }
   for(const [j,dd] of [[b1,d1],[b2,d2]]){
    if(j<0||dd>maxD2)continue;
    const kk=i<j?i+','+j:j+','+i;if(seen.has(kk))continue;seen.add(kk);
    edges.push([x,y,P.xs[j],P.ys[j],Math.sqrt(dd)/maxD]);
   }
  }
 }
 C.constel[key]=edges;
 return edges;
}
function drawConstellation(ctx,lid,L,lzSkip){
 const C=SC[scope],LZ=lens[lid],P=L.pts;if(!LZ||!P)return;
 const edges=constellationEdges(C,lid,LZ,P,lzSkip);if(!edges.length)return;
 const k=t.k;
 ctx.strokeStyle=byId[lid].accent;ctx.lineCap='round';
 for(const e of edges){
  const ax=e[0]*k+t.x,ay=e[1]*k+t.y,bx=e[2]*k+t.x,by=e[3]*k+t.y;
  if((ax<-80&&bx<-80)||(ax>W+80&&bx>W+80)||(ay<-80&&by<-80)||(ay>H+80&&by>H+80))continue;
  ctx.globalAlpha=.34*(1-e[4]*.6);ctx.lineWidth=.8;
  const mx=(ax+bx)/2,my=(ay+by)/2,ddx=bx-ax,ddy=by-ay;
  ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo(mx-ddy*0.12,my+ddx*0.12,bx,by);ctx.stroke();
 }
 ctx.globalAlpha=1;
}

function bufFor(lid){
 let bm=glowBMs[lid];
 if(!bm)bm=glowBMs[lid]={cvs:[document.createElement('canvas'),document.createElement('canvas')],cur:0,curT:null,prevT:null,prevIdx:1,fadeStart:0};
 const w=Math.round(W*dpr),h=Math.round(H*dpr);
 for(const cv of bm.cvs){if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}}
 return bm;
}
function bakeLayer(lid,full){
 const l=byId[lid];if(!l||!hasGlow(l))return;
 const bm=bufFor(lid);
 bm.cur^=1;
 const cv=bm.cvs[bm.cur],x=cv.getContext('2d');
 x.setTransform(dpr,0,0,dpr,0,0);
 x.clearRect(0,0,W,H);
 x.globalCompositeOperation='lighter';
 drawPointsTo(x,lid,full?1:2);
 bm.prevT=bm.curT;bm.prevIdx=bm.cur^1;
 bm.curT={k:t.k,x:t.x,y:t.y};
 bm.fadeStart=performance.now();
 dirty=true;
}
function bakeGlow(full){
 for(const lid of activeIds())bakeLayer(lid,full!==false);
}
function resetGlowFades(){
 for(const lid in glowBMs){glowBMs[lid].prevT=null;glowBMs[lid].curT=null;}
}

function drawGlow(){
 const ctx=ctxs.glow;
 idT(ctx);ctx.clearRect(0,0,W,H);
 ctx.globalCompositeOperation='lighter';
 ctx.imageSmoothingEnabled=true;
 const now=performance.now();
 const cm=compareMode;
 for(const l of live){
  const lid=l.id;if(!hasGlow(l))continue;
  const a=alpha[lid];if(a<=0.01||!scopeHas(lid))continue;
  const bm=glowBMs[lid];if(!bm||!bm.curT)continue;
  const clip=cm&&(lid===cm.a||lid===cm.b);
  if(clip){
   ctx.save();
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.beginPath();
   if(lid===cm.a)ctx.rect(0,0,cm.x*W,H);else ctx.rect(cm.x*W,0,W-cm.x*W,H);
   ctx.clip();
  }
  const drawBuf=(cv,bt,ga)=>{
   if(!bt||ga<=0.004)return;
   const s=t.k/bt.k,ox=t.x-s*bt.x,oy=t.y-s*bt.y;
   ctx.setTransform(dpr*s,0,0,dpr*s,dpr*ox,dpr*oy);
   ctx.globalAlpha=Math.min(1,ga);
   ctx.drawImage(cv,0,0,W,H);
  };
  const fade=Math.min(1,(now-bm.fadeStart)/220);
  if(fade<1&&bm.prevT){
   const th=fade*Math.PI/2;
   drawBuf(bm.cvs[bm.prevIdx],bm.prevT,a*Math.cos(th));
   drawBuf(bm.cvs[bm.cur],bm.curT,a*Math.sin(th));
  }else{
   drawBuf(bm.cvs[bm.cur],bm.curT,a);
  }
  if(clip)ctx.restore();
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}

// ---------- labels ----------
function haloText(ctx,str,x,y,font,fill,align){
 ctx.font=font;ctx.textAlign=align||'center';ctx.textBaseline='middle';
 ctx.lineWidth=3;ctx.strokeStyle='rgba(5,8,13,.85)';ctx.lineJoin='round';
 ctx.strokeText(str,x,y);ctx.fillStyle=fill;ctx.fillText(str,x,y);
}
function drawLabels(){
 const ctx=ctxs.lab,C=SC[scope];
 idT(ctx);ctx.clearRect(0,0,W,H);
 const occ=new Set();
 const free=(x,y,w)=>{
  for(let dx=-w;dx<=w;dx+=70){const key=Math.round((x+dx)/70)+','+Math.round(y/24);if(occ.has(key))return false;}
  return true;
 };
 const take=(x,y,w)=>{for(let dx=-w;dx<=w;dx+=70){occ.add(Math.round((x+dx)/70)+','+Math.round(y/24));}};
 const S=(x,y)=>[x*t.k+t.x,y*t.k+t.y];
 const desireOn=(alpha['desire-searches']||0)>0.4&&scopeHas('desire-searches');
 // ---- reference: state names (survey-sheet print; desire-labeled states are exempt)
 if(refNames&&scope==='us'){
  const dd=desireOn?D['desire-searches']:null;
  for(const st in C.stateCent){
   if(dd&&dd.us[st])continue; // desire draws its own postal+term there
   const c=C.stateCent[st];
   const [sx,sy]=S(c[0],c[1]);
   if(sx<padLeft()-20||sx>W||sy<95||sy>H-75)continue;
   if(TINY_STATES.has(st)&&t.k<2.1)continue;
   if(t.k<2.2){
    haloText(ctx,st,sx,sy,'500 9.5px "IBM Plex Mono"','rgba(148,160,178,.48)');
   }else{
    const nm=(STATE_NAME[st]||st).toUpperCase();
    haloText(ctx,nm,sx,sy,'500 10.5px "IBM Plex Mono"','rgba(152,164,182,.5)');
   }
   take(sx,sy,60);
  }
 }
 // desire terms
 const da=alpha['desire-searches']||0;
 if(da>0.4&&scopeHas('desire-searches')){
  const dd=D['desire-searches'],ac=byId['desire-searches'].accent;
  if(scope==='us'){
   for(const st in dd.us){
    if(TINY_STATES.has(st)&&t.k<2.1)continue;
    const c=C.stateCent[st];if(!c)continue;
    const [sx,sy]=S(c[0],c[1]);
    if(sx<padLeft()-30||sx>W||sy<90||sy>H-70)continue;
    let term=dd.us[st];if(term.length>22)term=term.slice(0,21)+'…';
    haloText(ctx,st,sx,sy-9,'500 7.5px "IBM Plex Mono"','rgba(138,148,166,'+(.85*da)+')');
    haloText(ctx,term.toLowerCase(),sx,sy+3,'500 10px "IBM Plex Mono"',hexA(ac,.95*da));
    take(sx,sy,70);
   }
  }else{
   for(const iso in dd.world){
    const c=C.countryCent[iso];if(!c)continue;
    const [sx,sy]=S(c[0],c[1]);
    if(sx<padLeft()-30||sx>W||sy<90||sy>H-70)continue;
    if(!free(sx,sy,70))continue;take(sx,sy,70);
    const e=dd.world[iso];
    haloText(ctx,e.country.toUpperCase(),sx,sy-9,'500 7px "IBM Plex Mono"','rgba(138,148,166,'+(.85*da)+')');
    haloText(ctx,String(e.label).replace(/\s*\(\+[\d.,]+%\)\s*$/,'').toLowerCase(),sx,sy+3,'500 9.5px "IBM Plex Mono"',hexA(ac,.95*da));
   }
  }
 }
 // ---- reference: cities (zoom-graded, population-priority)
 if(refNames&&C.places){
  const budget=t.k<1.6?14:t.k<2.5?42:t.k<4?120:t.k<6.5?320:t.k<10?800:C.places.length;
  let shown=0;
  for(let i=0;i<C.places.length&&shown<budget;i++){
   const pl=C.places[i];
   const [sx,sy]=S(pl.x,pl.y);
   if(sx<padLeft()-10||sx>W-14||sy<98||sy>H-78)continue;
   if(!free(sx,sy,55))continue;
   ctx.globalAlpha=.8;
   ctx.strokeStyle='rgba(196,206,222,.5)';ctx.lineWidth=1;
   ctx.beginPath();ctx.arc(sx,sy,pl.cap?3:2.2,0,7);ctx.stroke();
   if(pl.cap){ctx.fillStyle='rgba(196,206,222,.65)';ctx.beginPath();ctx.arc(sx,sy,1.1,0,7);ctx.fill();}
   ctx.globalAlpha=1;
   const big=pl.pop>1000000;
   haloText(ctx,pl.name,sx+7,sy,(big?'500 9.5px':'400 8.5px')+' "IBM Plex Mono"','rgba(184,194,210,'+(big?.68:.55)+')','left');
   take(sx,sy,55);shown++;
  }
 }
 // memory star names
 const ma=alpha['memory-births']||0;
 if(ma>0.5&&scopeHas('memory-births')&&t.k>=2.3){
  const L=C.layers['memory-births'].stars,d=D['memory-births'].stars;
  let shown=0;
  for(let i=0;i<L.n&&shown<26;i++){
   if(!L.keep[i])continue;
   if(era>=0&&!inEra(d.birth[i]))continue;
   const [sx,sy]=S(L.xs[i],L.ys[i]);
   if(sx<padLeft()||sx>W-20||sy<100||sy>H-80)continue;
   if(!free(sx,sy,70))continue;take(sx,sy,70);
   haloText(ctx,d.name[i],sx,sy-9,'italic 600 11px "Fraunces"','rgba(255,222,150,'+(.95*ma)+')');
   shown++;
  }
 }
 // f500 names
 const fa=alpha['power-fortune500']||0;
 if(fa>0.5&&scopeHas('power-fortune500')&&t.k>=3.4){
  const L=C.layers['power-fortune500']?C.layers['power-fortune500'].pts:null;
  if(L){const d=D['power-fortune500'];let shown=0;
   for(let i=0;i<L.n&&shown<16;i++){
    if(!L.keep[i])continue;
    const [sx,sy]=S(L.xs[i],L.ys[i]);
    if(sx<padLeft()||sx>W-20||sy<100||sy>H-80)continue;
    if(!free(sx,sy,60))continue;take(sx,sy,60);
    haloText(ctx,d.name[i],sx,sy+11,'500 9px "Space Grotesk"','rgba(197,182,252,'+(.9*fa)+')');
    shown++;
   }}
 }
 // omen names
 const oa=alpha['omen-names']||0;
 if(oa>0.5&&scopeHas('omen-names')&&t.k>=4.6){
  const L=C.layers['omen-names']?C.layers['omen-names'].pts:null;
  if(L){const d=D['omen-names'];let shown=0;
   for(let i=0;i<L.n&&shown<22;i++){
    if(!L.keep[i])continue;
    const [sx,sy]=S(L.xs[i],L.ys[i]);
    if(sx<padLeft()||sx>W-20||sy<100||sy>H-80)continue;
    if(!free(sx,sy,60))continue;take(sx,sy,60);
    haloText(ctx,d.name[i],sx,sy-8,'400 8.5px "IBM Plex Mono"',d.s[i]?'rgba(242,234,216,.9)':'rgba(255,120,100,.9)');
    shown++;
   }}
 }
 // ledger labels: the archetypes always, the rest as you approach
 const ba=alpha['betrayal-ledger']||0;
 if(ba>0.5&&scopeHas('betrayal-ledger')&&C.layers['betrayal-ledger']){
  const L=C.layers['betrayal-ledger'].pts,d=D['betrayal-ledger'];
  const budget=t.k<1.8?5:t.k<3.2?14:40;let shown=0;
  const ac=byId['betrayal-ledger'].accent;
  for(let i=0;i<L.n&&shown<budget;i++){ // packed in descending amount
   if(!L.keep[i])continue;
   const [sx,sy]=S(L.xs[i],L.ys[i]);
   if(sx<padLeft()||sx>W-20||sy<100||sy>H-80)continue;
   if(!free(sx,sy,70))continue;take(sx,sy,70);
   haloText(ctx,d.name[i].replace(/\s*\(.*\)$/,'')+' · '+money(d.v[i]),sx,sy-11,'500 9px "IBM Plex Mono"',hexA(ac,.92*ba));
   shown++;
  }
 }
 // benchmarks: the recorder's pending pin, and the pin of the citizen stop being read
 const marks=[];
 if(rec&&rec.pin)marks.push({g:rec.pin,label:'STOP '+(rec.stops.length+1)});
 if(tour&&tourIdx!==null&&tour.s[tourIdx]&&tour.s[tourIdx].p)marks.push({g:tour.s[tourIdx].p,label:(tourIdx+1)+' / '+tour.s.length});
 for(const m of marks){
  const p=C.proj(m.g);if(!p)continue;
  const [sx,sy]=S(p[0],p[1]);
  if(sx<-30||sx>W+30||sy<-30||sy>H+30)continue;
  ctx.save();ctx.translate(sx,sy);
  ctx.strokeStyle='rgba(5,8,13,.9)';ctx.lineWidth=4;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(11,7);ctx.lineTo(-11,7);ctx.closePath();ctx.stroke();
  ctx.strokeStyle='#e8b34b';ctx.lineWidth=1.6;ctx.stroke();
  ctx.fillStyle='#e8b34b';ctx.beginPath();ctx.arc(0,1,2.4,0,7);ctx.fill();
  ctx.restore();
  haloText(ctx,m.label,sx,sy+20,'500 8.5px "IBM Plex Mono"','rgba(232,179,75,.95)');
 }
 // hover ring
 if(hoverPt){
  const [sx,sy]=S(hoverPt.x,hoverPt.y);
  ctx.strokeStyle=hoverPt.color;ctx.lineWidth=1;ctx.globalAlpha=.9;
  ctx.beginPath();ctx.arc(sx,sy,7,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
 }
 if(tipPinned)placeTip(tipPinned.content,tipPinned.x,tipPinned.y);
}

// ---------- tween/frame ----------
function tickTween(){
 let moving=false;
 for(const l of live){
  const id=l.id,tg=target[id],a=alpha[id];
  if(Math.abs(tg-a)>0.012){alpha[id]=a+(tg-a)*.16;moving=true;}
  else if(a!==tg){alpha[id]=tg;moving=true;}
 }
 return moving;
}
function frame(){
 requestAnimationFrame(frame);
 const tw=tickTween();
 if(tw)terrainDirty=true;
 const now=performance.now();
 if(needBake&&now-lastBakePump>90){
  lastBakePump=now;needBake=zooming;
  const ids=activeIds().filter(id=>hasGlow(byId[id]));
  if(ids.length){bakeRR=(bakeRR+1)%ids.length;bakeLayer(ids[bakeRR],!zooming);}
 }
 // a layer switched on by any path (toggle, plate, reading, tour, plunge) that has
 // never been painted is painted now — one per frame, so a big switch stays smooth
 if(!zooming){
  for(const lid of activeIds()){
   if(!hasGlow(byId[lid]))continue;
   const bm=glowBMs[lid];
   if(!bm||!bm.curT){bakeLayer(lid,true);break;}
  }
 }
 let fading=false;
 for(const lid in glowBMs){
  const bm=glowBMs[lid];
  if(bm.curT&&bm.prevT&&now-bm.fadeStart<230){fading=true;break;}
 }
 if(!dirty&&!tw&&!fading)return;
 drawBase();drawTerrain();drawGlow();drawLabels();
 dirty=false;
}

// ---------- quadtree/hover ----------
function rebuildQt(){
 const C=SC[scope],items=[];
 for(const lid of activeIds()){
  const l=byId[lid];if(!l.forms.points)continue;
  const L=C.layers[lid];if(!L)continue;
  if(D[lid].kind==='memory'){
   const dd=D[lid],ee=dd.cells.e;
   const P=L.cells;
   for(let i=0;i<P.n;i++){
    if(!P.keep[i])continue;
    const val=era<0?dd.cells.v[i]:(ee&&ee[i]?ee[i][era]:0);
    if(!val)continue;
    items.push({x:P.xs[i],y:P.ys[i],lid,i,kind:'cell'});
   }
   const St=L.stars,sb=dd.stars.birth;
   for(let i=0;i<St.n;i++){
    if(!St.keep[i])continue;
    if(era>=0&&!inEra(sb[i]))continue;
    items.push({x:St.xs[i],y:St.ys[i],lid,i,kind:'star'});
   }
  }else if(L.pts){
   const P=L.pts,LZq=lens[lid],arrq=LZq?D[lid][LZq.field]:null;
   for(let i=0;i<P.n;i++){
    if(!P.keep[i])continue;
    if(arrq&&arrq[i]!==LZq.v)continue;
    items.push({x:P.xs[i],y:P.ys[i],lid,i,kind:'pt'});
   }
  }
 }
 qt=d3.quadtree().x(d=>d.x).y(d=>d.y).addAll(items);
}
function scheduleQt(){clearTimeout(qtTimer);qtTimer=setTimeout(rebuildQt,260);}

const tip=$('#tooltip');
function tipHTML(f){
 const l=byId[f.lid],d=D[f.lid];
 let k=l.title.toUpperCase(),ti='',s='';
 if(f.kind==='star'){
  const st=d.stars;ti='★ '+st.name[f.i];
  s=(st.birth[f.i]?'b. '+st.birth[f.i]:'')+(st.death&&st.death[f.i]?' – d. '+st.death[f.i]:'')+(st.dom[f.i]?' · '+st.dom[f.i]:'');
  if(st.desc&&st.desc[f.i])s+='<br>'+st.desc[f.i];
  s+=`<br>visibility ${st.v[f.i]} / 100`;
 }
 else if(f.kind==='cell'){
  const ee=d.cells.e;
  const v=era<0?d.cells.v[f.i]:(ee&&ee[f.i]?ee[f.i][era]:0);
  ti=fmtInt(v)+' remembered birth'+(v>1?'s':'')+' near here';
  if(era>=0&&d.eras)ti+=' ('+d.eras.labels[era]+')';
  const lab=d.cells.lab[String(f.i)];if(lab)s='brightest: '+lab;
 }
 else if(f.lid==='loss-crashes'){const v=d.v[f.i];ti=v===1?'One person died here':v+' people died here';s=MONTHS[d.m[f.i]]+' 2023 · fatal crash';}
 else if(f.lid==='power-datacenters'){ti=d.name[f.i]||'Unnamed facility';s='data center';}
 else if(f.lid==='power-fortune500'){const v=d.v[f.i];ti='#'+d.rank[f.i]+' '+d.name[f.i];s=d.loc[f.i]+' · $'+(v>=1e6?(v/1e6).toFixed(2)+'T':v>=1000?(v/1000).toFixed(1)+'B':v+'M')+' revenue';}
 else if(f.lid==='motion-fulfillment'){ti=d.name[f.i]||'Amazon facility';s=(d.typeNames[d.t[f.i]]||'')+' · '+d.loc[f.i];}
 else if(f.lid==='omen-names'){ti=d.name[f.i];s=(d.s[f.i]?'light':'dark')+' name · '+d.cls[f.i]+', '+d.st[f.i];}
 else if(f.lid==='wonder-ufos'){const v=d.v?d.v[f.i]:1;ti=v>1?fmtInt(v)+' sightings reported here':'A sighting reported here';const DECS=['1940s','1950s','1960s','1970s','1980s','1990s','2000s','2010s','2010s'];const dc2=d.dec?d.dec[f.i]:-1;s=(dc2>=0?'latest in the '+DECS[dc2]+' · ':'')+'NUFORC testimony';}
 else if(f.lid==='residue-superfund'){ti=d.name[f.i];s=['proposed for the NPL','on the National Priorities List','deleted from the NPL — cleaned enough to leave'][d.st2[f.i]]+' · '+d.state[f.i];}
 else if(f.lid==='betrayal-ledger'){
  ti=money(d.v[f.i])+' — '+esc(d.name[f.i]);
  const cites=(d.cites&&d.cites[f.i])||[];
  s='<b>'+esc(d.who[f.i])+'</b>'+(d.years[f.i]?' · '+esc(d.years[f.i]):'')+
    (d.scheme[f.i]?'<br>'+esc(d.scheme[f.i]):'')+
    (d.outcome[f.i]?'<br><i>'+esc(d.outcome[f.i])+'</i>':'')+
    (cites.length?'<br><span class="tt-cite">receipts · '+cites.map(u=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(hostOf(u))+'</a>').join(' · ')+'</span>':'');
  return {k,ti,s,color:l.accent,wide:true};
 }
 else{ti=(d.name&&d.name[f.i])||l.title;s=l.unit||'';}
 return {k,ti,s,color:f.lid==='omen-names'&&d.s[f.i]?(byId[f.lid].accent2||'#f2ead8'):l.accent};
}
function regionTip(qx,qy){
 const C0=SC[scope];
 if(scope==='us'&&C0.countyBoxes){
  const tls=countyTintLayers().filter(l=>(alpha[l.id]||0)>0.3).reverse();
  if(tls.length){
   idT(hitCtx);
   for(const b of C0.countyBoxes){
    if(qx<b.x0||qx>b.x1||qy<b.y0||qy>b.y1)continue;
    if(hitCtx.isPointInPath(b.p,qx*dpr,qy*dpr)){
     const lines=[];let color=null,anySupp=false;
     for(const lT of tls){
      const e=D[lT.id].counties[b.fips];
      if(e){lines.push('<b>'+e.label+'</b>');if(!color)color=lT.accent;}
      else if(lT.id==='despair-overdoses'||lT.id==='despair-suicide')anySupp=true;
     }
     if(!lines.length&&anySupp)return {k:'COUNTY',ti:b.name,s:'no reportable rate — suppressed or missing<br>(small counts protect privacy)',color:'#5a6577'};
     if(lines.length)return {k:'COUNTY — '+tls.map(l=>l.title.toUpperCase()).join(' × '),ti:b.name,s:lines.join('<br>'),color:color||'#c8d2e2'};
     break;
    }
   }
  }
 }
 const da=alpha['desire-searches']||0;
 if(da<=0.3||!scopeHas('desire-searches'))return null;
 const C=SC[scope],dd=D['desire-searches'],l=byId['desire-searches'];
 idT(hitCtx);
 if(scope==='us'){
  for(const st in C.statePaths){
   if(hitCtx.isPointInPath(C.statePaths[st],qx*dpr,qy*dpr)){
    if(dd.us[st])return {k:'THE GEOGRAPHY OF DESIRE',ti:STATE_NAME[st]||st,s:'top relative search: <b>'+dd.us[st]+'</b>',color:l.accent};
    if(dd.dark.includes(st))return {k:'NO SIGNAL',ti:STATE_NAME[st]||st,s:'Pornhub blocks access here (age-verification law).<br>Desire unmeasured — dark territory.',color:'#5a6577'};
    return null;
   }
  }
 }else{
  for(const iso in C.countryPaths){
   if(hitCtx.isPointInPath(C.countryPaths[iso],qx*dpr,qy*dpr)){
    const e=dd.world[iso];
    return {k:'THE GEOGRAPHY OF DESIRE',ti:e.country,s:(e.kind==='top_category'?'top relative category: ':'signature search: ')+'<b>'+e.label+'</b>',color:l.accent};
   }
  }
 }
 return null;
}
let tipRAF=false;
function onMove(ev){
 const mx=ev.clientX,my=ev.clientY;
 if(tipRAF)return;tipRAF=true;
 requestAnimationFrame(()=>{
  tipRAF=false;
  const qx=(mx-t.x)/t.k,qy=(my-t.y)/t.k;
  // live coordinate readout
  const C=SC[scope];
  try{
   const g=C.proj.invert?C.proj.invert([qx,qy]):null;
   if(g&&isFinite(g[0])&&isFinite(g[1])&&Math.abs(g[1])<=90){
    let txt=Math.abs(g[1]).toFixed(3)+'°'+(g[1]>=0?'N':'S')+'  '+Math.abs(g[0]).toFixed(3)+'°'+(g[0]>=0?'E':'W');
    if(scope==='us'){
     idT(hitCtx);
     for(const st in C.statePaths){
      if(hitCtx.isPointInPath(C.statePaths[st],qx*dpr,qy*dpr)){txt+=' · '+(STATE_NAME[st]||st).toUpperCase();break;}
     }
    }
    if(C.places&&C.places.length){
     let bi=-1,bd=1e9;
     for(let i=0;i<C.places.length;i++){
      const pl=C.places[i];
      if(Math.abs(pl.la-g[1])>2.5||Math.abs(pl.lo-g[0])>3)continue;
      const d=havKm(g[1],g[0],pl.la,pl.lo);
      if(d<bd){bd=d;bi=i;}
     }
     if(bi>=0&&bd<=220)txt+=' · near '+C.places[bi].name+(scope==='us'?', '+C.places[bi].st:' ('+C.places[bi].st+')');
    }
    $('#datum').textContent=txt;
   }
  }catch(e){}
  if(tipPinned){
   // a pinned tooltip holds until the mouse wanders off it; touch never wanders
   if(ev.pointerType==='touch')return;
   const psx=tipPinned.x*t.k+t.x,psy=tipPinned.y*t.k+t.y;
   if(Math.hypot(mx-psx,my-psy)<70)return;
   unpinTip();
  }
  let f=qt?qt.find(qx,qy,14/Math.max(1,t.k)):null;
  let content=f?tipHTML(f):regionTip(qx,qy);
  if(f){hoverPt={x:f.x,y:f.y,color:content.color};dirty=true;}
  else if(hoverPt){hoverPt=null;dirty=true;}
  if(content){
   renderTip(content,false);
   const tw=tip.offsetWidth,th=tip.offsetHeight;
   tip.style.left=Math.min(mx+16,W-tw-14)+'px';
   tip.style.top=Math.min(my+16,H-th-14)+'px';
  }else{tip.style.display='none';tip._c=null;}
 });
}
// ---------- v0.6: tooltips you can hold ----------
function renderTip(content,pinned){
 tip.style.display='block';
 tip.style.borderLeftColor=content.color;
 tip.classList.toggle('wide',!!content.wide);
 tip.classList.toggle('pinned',!!pinned);
 tip.innerHTML='<div class="tt-k" style="color:'+content.color+'">'+content.k+(pinned?'<span class="tt-pin">PINNED · click away to release</span>':'')+'</div><div class="tt-t">'+content.ti+'</div>'+(content.s?'<div class="tt-s">'+content.s+'</div>':'');
 tip._c=content;tip._p=!!pinned;
}
function placeTip(content,x,y,pinned){
 // x,y in base (projected) space; the tooltip rides with the map. The HTML is only
 // rebuilt when the content changes, so links inside a pinned tip stay clickable.
 const sx=x*t.k+t.x,sy=y*t.k+t.y;
 const pin=pinned===undefined?!!tipPinned:pinned;
 if(tip._c!==content||tip._p!==pin)renderTip(content,pin);
 tip.style.display='block';
 const tw=tip.offsetWidth,th=tip.offsetHeight;
 tip.style.left=Math.max(8,Math.min(sx+16,W-tw-14))+'px';
 tip.style.top=Math.max(8,Math.min(sy+14,H-th-14))+'px';
}
function pinTip(content,x,y){
 tipPinned={content,x,y};
 hoverPt={x,y,color:content.color};
 placeTip(content,x,y,true);
 dirty=true;
}
function unpinTip(){
 if(!tipPinned)return;
 tipPinned=null;hoverPt=null;tip.classList.remove('pinned');tip.style.display='none';tip._c=null;dirty=true;
}
function onClick(ev){
 if(ev.target!==undefined&&ev.target.closest&&ev.target.closest('#tooltip'))return;
 const mx=ev.clientX,my=ev.clientY;
 const qx=(mx-t.x)/t.k,qy=(my-t.y)/t.k;
 if(rec){ // composing: a click sets the benchmark for the next stop
  const C=SC[scope];
  const g=C.proj.invert?C.proj.invert([qx,qy]):null;
  if(g&&isFinite(g[0])&&isFinite(g[1])){rec.pin=[+g[0].toFixed(4),+g[1].toFixed(4)];recRender();dirty=true;toast('Benchmark set — it rides with the next captured stop.');}
  return;
 }
 const f=qt?qt.find(qx,qy,(ev.pointerType==='touch'?22:14)/Math.max(1,t.k)):null;
 if(f){pinTip(tipHTML(f),f.x,f.y);return;}
 const rt=regionTip(qx,qy);
 if(rt&&ev.pointerType==='touch'){pinTip(rt,qx,qy);return;}
 unpinTip();
}

// ---------- UI ----------
function updateStatline(){
 const parts=activeIds().map(lid=>{
  if(lid==='memory-births'&&era>=0&&D[lid].eras)return fmtInt(D[lid].eras.totals[era])+' births, '+D[lid].eras.labels[era];
  let s=byId[lid].statline;
  if(lens[lid])s=(s?s+' ':'')+'· lens: '+lens[lid].label;
  return s;
 }).filter(Boolean);
 $('#statline').textContent=parts.join('  ·  ');
}
function updateDatumDefault(){
 $('#datum').textContent=scope==='us'?'DATUM WGS84 → ALBERS EQUAL-AREA':'DATUM WGS84 → EQUAL EARTH';
}
function updateScalebar(){
 try{
  const C=SC[scope],cx=(C.ext[0][0]+C.ext[1][0])/2,cy=(C.ext[0][1]+C.ext[1][1])/2;
  const inv=p=>C.proj.invert((p));
  const a=inv([(cx-t.x)/t.k,(cy-t.y)/t.k]),b=inv([(cx+120-t.x)/t.k,(cy-t.y)/t.k]);
  if(!a||!b||!isFinite(a[0])||!isFinite(b[0]))throw 0;
  const km=d3.geoDistance(a,b)*6371;
  const nice=[5,10,20,50,100,200,500,1000,2000,5000].filter(n=>n<=km).pop()||5;
  $('#sbBar').style.width=(nice/km*120)+'px';
  $('#sbLabel').textContent=nice+' km';
  $('#scalebar').style.visibility='visible';
 }catch(e){$('#scalebar').style.visibility='hidden';}
}

function chipRefresh(){
 document.querySelectorAll('.chip[data-lid]').forEach(ch=>{
  const lid=ch.dataset.lid,l=byId[lid];
  ch.classList.toggle('on',target[lid]>0&&scopeHas(lid));
  ch.classList.toggle('offscope',l.status==='live'&&!scopeHas(lid));
 });
}
function toggleLayer(lid){
 if(byId[lid].status!=='live'||!scopeHas(lid))return;
 target[lid]=target[lid]>0?0:1;
 chipRefresh();updateStatline();scheduleQt();
 if(typeof eraRefresh==='function')eraRefresh();
 if(typeof writeHash==='function')writeHash();
 terrainDirty=true;dirty=true;
}
function buildRail(){
 const rail=$('#rail');rail.innerHTML='';
 let key=1;
 const railOrder=[];
 for(const th of R.themes){
  const lays=R.layers.filter(l=>l.theme===th.id);
  if(!lays.length)continue;
  const h=document.createElement('div');h.className='theme-h';
  h.innerHTML='<span class="tn">'+th.name.toUpperCase()+'</span><span class="tr">'+th.reading+'</span>';
  rail.appendChild(h);
  for(const l of lays){
   const ch=document.createElement('div');ch.className='chip'+(l.status!=='live'?' pending':'');
   ch.dataset.lid=l.id;
   const sub=l.status==='live'?(l.statline||l.unit):'source gated — slot reserved';
   ch.innerHTML='<span class="key">'+(l.status==='live'?key:'')+'</span>'+
    '<span class="dot" style="background:'+l.accent+';color:'+l.accent+'"></span>'+
    '<span class="cbody"><div class="ct">'+l.title+'</div><div class="cs">'+sub+'</div></span>'+
    (l.status==='live'?'<button class="read" data-read="'+l.id+'">READ</button>':'<span class="ptag">PENDING</span>');
   ch.addEventListener('click',ev=>{
    if(ev.target.closest('.read'))return;
    if(l.status!=='live'){openPlate(l.id);return;}
    toggleLayer(l.id);
   });
   rail.appendChild(ch);
   if(l.status==='live'){railOrder.push(l.id);key++;}
  }
 }
 const rh=document.createElement('div');rh.className='theme-h';
 rh.innerHTML='<span class="tn">REFERENCE</span><span class="tr">the sheet beneath the light</span>';
 rail.appendChild(rh);
 const mkRef=(label,get,flip)=>{
  const d=document.createElement('div');d.className='chip refchip';
  d.innerHTML='<span class="key"></span><span class="refbox"></span><span class="cbody"><div class="ct">'+label+'</div></span>';
  const sync=()=>{d.classList.toggle('on',get());d.querySelector('.refbox').textContent=get()?'▣':'▢';};
  d.addEventListener('click',()=>{flip();sync();dirty=true;});
  refSyncs.push(sync);sync();rail.appendChild(d);
 };
 mkRef('Place names & rings — G',()=>refNames,()=>refNames=!refNames);
 mkRef('Boundaries & counties',()=>refBounds,()=>refBounds=!refBounds);
 const note=document.createElement('div');note.className='rail-note';
 note.textContent='Every layer is real, sourced, and dated. Toggle them; the terrain recomputes. The survey is built to grow.';
 rail.appendChild(note);
 rail.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-read]');
  if(b)openPlate(b.dataset.read);
 });
 return railOrder;
}
let railOrder=[];

function openPlate(lid){
 const l=byId[lid],th=themeById[l.theme];
 const inner=$('#plateInner');
 const stats=(l.plateStats||[]).map(s=>'<div class="pl-stat"><div class="v">'+s.value+'</div><div class="l">'+s.label+'</div></div>').join('');
 const srcs=(l.sources||[]).map(s=>'<div>'+(s.url?'<a href="'+s.url+'" target="_blank" rel="noopener noreferrer">'+s.name+'</a>':s.name)+(s.note?' — '+s.note:'')+'</div>').join('');
 inner.innerHTML='<button class="pl-x" id="plateClose">✕ ESC</button>'+
  (l.protocol?'<div class="pl-banner">'+l.protocol+'</div>':'')+
  '<div class="pl-over" style="color:'+l.accent+'">'+th.name.toUpperCase()+' — '+th.reading.toUpperCase()+'</div>'+
  '<div class="pl-title">'+l.title+'</div>'+
  '<div class="pl-unit">'+(l.statline||l.unit)+(l.retrieved?' · surveyed '+String(l.retrieved).slice(0,10):'')+'</div>'+
  '<div class="pl-stats">'+stats+'</div>'+
  '<div class="pl-h" style="color:'+l.accent+'">WHAT</div><div class="pl-body">'+l.essay.what+'</div>'+
  '<div class="pl-h" style="color:'+l.accent+'">HOW</div><div class="pl-body">'+l.essay.how+'</div>'+
  '<div class="pl-h" style="color:'+l.accent+'">WHY</div><div class="pl-body">'+l.essay.why+'</div>'+
  (l.caveat?'<div class="pl-cav"><b>FIELD NOTE</b> — '+l.caveat+'</div>':'')+
  (srcs?'<div class="pl-h" style="color:'+l.accent+'">SOURCES</div><div class="pl-src">'+srcs+'</div>':'')+
  (l.status==='live'&&l.filters&&l.filters.length&&D[l.id]?'<div class="pl-h" style="color:'+l.accent+'">LENSES</div><div class="pl-lens">'+l.filters.map(fl=>'<div class="pl-lensrow"><span class="pl-lenslab">'+fl.label+(fl.constellation?' · members are drawn as a constellation':'')+(fl.seq?' · ▶ steps through time':'')+'</span><button class="lz-chip'+(!lens[l.id]||lens[l.id].field!==fl.field?' on':'')+'" data-lid="'+l.id+'" data-field="'+fl.field+'" data-clear="1">ALL</button>'+fl.values.map(v=>'<button class="lz-chip'+(lens[l.id]&&lens[l.id].field===fl.field&&lens[l.id].v===v[0]?' on':'')+'" data-lid="'+l.id+'" data-field="'+fl.field+'" data-v="'+v[0]+'" data-label="'+esc(v[1])+'"'+(fl.constellation?' data-const="1"':'')+'>'+v[1]+' <span>'+fmtInt(v[2])+'</span></button>').join('')+(fl.seq?'<button class="lz-chip lz-play" data-lid="'+l.id+'" data-field="'+fl.field+'" title="Step through '+esc(fl.label.toLowerCase())+'">'+(lensPlay&&lensPlay.lid===l.id&&lensPlay.field===fl.field?'■':'▶')+'</button>':'')+'</div>').join('')+'</div>':'')+
  (l.status==='live'&&D[l.id]?'<div class="pl-h" style="color:'+l.accent+'">DATA</div><div class="pl-src"><a href="'+GH+'data/staging/'+l.id+'.json" target="_blank" rel="noopener noreferrer">staging JSON</a> · <a href="'+GH+'data/staging/'+l.id+'.provenance.json" target="_blank" rel="noopener noreferrer">provenance</a> · <a href="'+GH+'registry/registry.json" target="_blank" rel="noopener noreferrer">registry entry</a> · <a href="'+GH+'docs/DATA_API.md" target="_blank" rel="noopener noreferrer">data API</a></div>':'')+
  (l.status==='live'?'<div class="pl-solo">SOLO VIEW — other layers dimmed · the audio follows · close to restore</div>':'<div class="pl-solo">'+(l.pendingNote||'')+'</div>');
 $('#plate').style.borderTopColor=l.accent;
 $('#plate').classList.add('open');
 $('#plateClose').addEventListener('click',closePlate);
 inner.querySelectorAll('.lz-chip:not(.lz-play)').forEach(b=>b.addEventListener('click',()=>{
  const bl=b.dataset.lid;
  stopLensPlay();
  if(b.dataset.clear)delete lens[bl];
  else lens[bl]={field:b.dataset.field,v:parseInt(b.dataset.v,10),label:b.dataset.label,constellation:!!b.dataset.const};
  applyLens(bl);
  openPlate(bl);
 }));
 inner.querySelectorAll('.lz-play').forEach(b=>b.addEventListener('click',()=>toggleLensPlay(b.dataset.lid,b.dataset.field)));
 if(l.status==='live'){
  if(!scopeHas(lid)&&l.scopes.includes('us'))switchScope('us');
  if(!plateOpen)savedTargets={...target};
  for(const x of live)target[x.id]=(x.id===lid?1:0);
  chipRefresh();updateStatline();scheduleQt();terrainDirty=true;dirty=true;
 }
 plateOpen=lid;
}
function closePlate(){
 if(!plateOpen)return;
 stopLensPlay();
 $('#plate').classList.remove('open');
 if(savedTargets){for(const k in savedTargets)target[k]=savedTargets[k];savedTargets=null;}
 plateOpen=null;
 chipRefresh();updateStatline();scheduleQt();terrainDirty=true;dirty=true;
}

function buildHero(){
 const total=live.reduce((s,l)=>s+(l.count||0),0);
 $('#hero').innerHTML='<div class="hero-in">'+
  '<div class="hero-over">'+R.meta.sheet+' · SURVEYED '+R.meta.surveyed+'</div>'+
  '<h2 class="hero-title">THE <em>SOUL</em> SURVEY</h2>'+
  '<div class="hero-tag">'+R.meta.tagline.toUpperCase()+'</div>'+
  '<p class="hero-man">'+R.meta.manifesto+'</p>'+
  '<div class="hero-stats">'+live.length+' LAYERS LIVE · '+fmtInt(total)+' COORDINATES OF HUMAN ACTIVITY · ZERO RUNTIME NETWORK CALLS</div>'+
  '<button id="heroEnter">ENTER THE SURVEY</button>'+
  '<div class="hero-hint">hover or tap anything · '+(railOrder.length>9?'1–9, 0':'1–'+railOrder.length)+' layers · R readings · F findings · ? plunge · G place names · E everything · C curated · ♪ audio · U / W sheets</div>'+
  '</div>';
 const go=()=>{
  if($('#hero').classList.contains('gone'))return;
  $('#hero').classList.add('gone');
  maybeOrientation();
 };
 $('#heroEnter').addEventListener('click',go);
 $('#hero').addEventListener('wheel',go,{passive:true});
}
function buildAbout(){
 const rows=live.map(l=>{
  const s=(l.sources||[]).map(x=>x.url?'<a href="'+x.url+'" target="_blank" rel="noopener noreferrer">'+x.name+'</a>':x.name).join('; ');
  return '<div><b style="color:'+l.accent+'">'+l.title+'</b> — '+s+(l.retrieved?' · retrieved '+l.retrieved:'')+'</div>';
 }).join('');
 $('#aboutInner').innerHTML='<button class="pl-x" id="aboutClose">✕ ESC</button>'+
  '<div class="pl-over">'+R.meta.sheet+'</div>'+
  '<div class="ab-title">About the Survey</div>'+
  '<div class="ab-body">'+R.meta.manifesto+'</div>'+
  '<div class="ab-body">Each layer answers three questions — <i>what</i> the data is, <i>how</i> it was measured, and <i>why</i> it says something about us. Density becomes elevation: the hillshade and contour lines are computed from the active layers, so the topography you see is literally the shape of the data. Nothing here is invented; every point traces to a named source with a retrieval date, and two layers (the arsenal, mass layoffs) are deliberately shown as pending rather than faked.</div>'+
  '<div class="ab-h">METHOD</div>'+
  '<div class="ab-body" style="font-size:13px">Point layers render as additive light — where records overlap, the map burns brighter. Weighted density fields drive the shared relief. The page is fully self-contained: basemaps, data, and libraries are baked in at build time and it makes zero runtime network calls (fonts degrade gracefully). Built on a registry architecture: adding a future layer is one data file and one registry entry.</div>'+
  '<div class="ab-h">SOURCES & LICENSES</div><div class="ab-src">'+rows+
  '<div style="margin-top:10px">Basemaps: Natural Earth (public domain). Geocoding &amp; reference places: GeoNames (CC-BY 4.0). Notable-people data: Laouenan et al. (CC-BY-SA 4.0). Map data © OpenStreetMap contributors (ODbL). FARS &amp; GNIS: U.S. public domain.</div></div>'+
  '<div class="ab-h">METHODS</div>'+
  '<div class="ab-body" style="font-size:13px">Each layer is fetched by its own pipeline script into a staging file with a provenance sidecar (method, counts, caveats), then packed — coordinates quantized to ~110 m, giant datasets aggregated to cells — and baked into this single page. Terrain is computed here in your browser: density grids from the active layers, Gaussian-smoothed, contoured, and hillshaded; nothing is pre-rendered. Findings are computed at build time by pipeline/correlate.py (county joins, cell-grid log–log correlations), hand-reviewed, and shipped with their method notes; one deliberately spurious correlation is included as the control. Known limitations live on each plate as a FIELD NOTE. Full pipeline, data, and provenance: <a href="https://github.com/'+R.meta.repo+'" target="_blank" rel="noopener noreferrer">github.com/'+R.meta.repo+'</a> · the raw endpoints are documented as a <a href="'+GH+'docs/DATA_API.md" target="_blank" rel="noopener noreferrer">data API</a>.</div>'+
  '<div class="ab-h">CITIZEN READINGS</div>'+
  '<div class="ab-body" style="font-size:13px">Readings are no longer author-only. From READINGS, <i>compose a reading</i>: frame a view, write a line, capture a stop, set a benchmark by clicking the map, and finish — the whole tour is encoded into the link itself. No server, no account. Anyone who opens the link can answer with a counter-reading. Citizen readings are marked as a reader\'s, never as the survey\'s canon.</div>'+
  '<div class="ab-h">CITE THIS SURVEY</div>'+
  '<div class="ab-cite" id="abCiteText">The Soul Survey (v'+R.meta.version+', '+R.meta.surveyed.toLowerCase()+'). A topographic survey of the collective soul, conducted in objective data. '+R.meta.site+' — Layer vintages: FARS 2023 · CDC MIOV 2024 · Fortune 2025 · Pornhub Insights 2025 · NUFORC 1906–2014 · EPA NPL 2026-07 · USGS GNIS 2026-07 · IRS SOI 2022–23 · NCHS/CHR&amp;R 2018–22 · Social Capital Atlas 2022 · U.S. Religion Census 2020 · Laouenan et al. 2022 (CC-BY-SA).</div>'+
  '<button class="ab-copy" id="abCopy">COPY CITATION</button>'+
  '<div class="ab-h">SURVEY LOG</div>'+
  '<table class="ab-log">'+live.map(l=>'<tr><td>'+l.title+'</td><td>'+(l.retrieved?String(l.retrieved).slice(0,10):'—')+'</td><td>'+(l.statline||l.unit)+'</td></tr>').join('')+
  '<tr><td>Releases</td><td colspan="2">v0.1 first light · v0.2 readings, eras, three layers · v0.3 findings, sound, curation · v0.3.1 reference &amp; zoom crossfade · v0.4 the Index, dossiers, trust kit · v0.5 the sorting, the ledger, lenses &amp; bios · v'+R.meta.version+' the ledger lit, citizen readings, constellations, the plunge, the living log</td></tr></table>'+
  (R.meta.log&&R.meta.log.length?'<div class="ab-h">THE LIVING LOG</div><div class="ab-body" style="font-size:12px;margin-bottom:6px">The survey\'s memory of itself, straight from its history: every refresh, every correction, in public.</div><div class="ab-livelog">'+R.meta.log.map(r=>'<div><span>'+esc(r[0])+'</span>'+esc(r[1])+'</div>').join('')+'</div>':'')+
  '<div class="ab-h">CONTROLS</div>'+
  '<div class="ab-kbd"><b>/</b> search the Index &nbsp; <b>?</b> random plunge &nbsp; <b>1–'+Math.min(10,railOrder.length)+'</b> toggle layers &nbsp; <b>click</b> hold a tooltip &nbsp; <b>G</b> place names &nbsp; <b>R</b> readings &nbsp; <b>F</b> findings &nbsp; <b>E</b> everything &nbsp; <b>C</b> curated &nbsp; <b>U</b>/<b>W</b> sheets &nbsp; <b>scroll</b> zoom &nbsp; <b>ESC</b> close</div>';
 const cp=$('#abCopy');
 if(cp)cp.addEventListener('click',()=>{
  const txt=$('#abCiteText').textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast('Citation copied.'),()=>toast('Select the citation text to copy it.'));
  else toast('Select the citation text to copy it.');
 });
 $('#aboutClose').addEventListener('click',()=>$('#about').classList.remove('open'));
}

function switchScope(s){
 if(s===scope)return;
 scope=s;
 unpinTip();
 buildScope(s);
 resetGlowFades();
 t=d3.zoomIdentity;
 d3.select('#stage').call(zoomB.transform,d3.zoomIdentity);
 $('#scopeUS').classList.toggle('on',s==='us');
 $('#scopeWorld').classList.toggle('on',s==='world');
 chipRefresh();updateStatline();updateDatumDefault();
 bakeGlow();rebuildQt();updateScalebar();
 if(typeof eraRefresh==='function')eraRefresh();
 if(typeof writeHash==='function')writeHash();
 terrainDirty=true;dirty=true;
}

// ---------- v2: era-aware grids ----------
function memGrid(C,er){
 C.eraGrids=C.eraGrids||{};
 if(C.eraGrids[er])return C.eraGrids[er];
 const d=D['memory-births'],L=C.layers['memory-births'];
 const out={grid:null,contours:null};
 if(!d||!L||!d.cells.e){C.eraGrids[er]=out;return out;}
 const ext=C.ext,exw=ext[1][0]-ext[0][0],exh=ext[1][1]-ext[0][1],GW=C.GW,GH=C.GH;
 const grid=new Float32Array(GW*GH),P=L.cells,ee=d.cells.e;
 for(let i=0;i<P.n;i++){
  if(!P.keep[i]||!ee[i])continue;
  const v=ee[i][er];if(!v)continue;
  const gx=Math.floor((P.xs[i]-ext[0][0])/exw*GW),gy=Math.floor((P.ys[i]-ext[0][1])/exh*GH);
  if(gx>=0&&gx<GW&&gy>=0&&gy<GH)grid[gy*GW+gx]+=Math.log1p(v);
 }
 let g=gaussBlur(grid,GW,GH);
 const nz=[];for(let i=0;i<g.length;i++)if(g[i]>0)nz.push(g[i]);
 nz.sort((a,b)=>a-b);
 const p99=nz.length?nz[Math.min(nz.length-1,Math.floor(nz.length*.996))]:1;
 for(let i=0;i<g.length;i++)g[i]=Math.min(1,g[i]/p99);
 out.grid=g;
 const cs=d3.contours().size([GW,GH]).thresholds(CONTOUR_T)(g);
 out.contours=cs.map((c,ci)=>{
  const p=new Path2D();
  c.coordinates.forEach(poly=>poly.forEach(ring=>{
   ring.forEach((pt,j)=>{
    const x=ext[0][0]+pt[0]/GW*exw,y=ext[0][1]+pt[1]/GH*exh;
    j?p.lineTo(x,y):p.moveTo(x,y);
   });p.closePath();
  }));
  return {p,i:ci};
 });
 C.eraGrids[er]=out;
 return out;
}
function layerGrid(C,lid){
 if(lid==='memory-births'&&era>=0){const m=memGrid(C,era);return m.grid;}
 return C.grids[lid];
}
function layerContours(C,lid){
 if(lid==='memory-births'&&era>=0){const m=memGrid(C,era);return m.contours;}
 return C.contours[lid];
}

// ---------- v2: counties ----------
function ensureCounties(C){
 if(C.countyBoxes||C.scope!=='us'||!B.counties)return;
 if(!geo.counties)geo.counties=topo.feature(B.counties,B.counties.objects.counties).features;
 C.countyBoxes=[];
 for(const f of geo.counties){
  const fips=String(f.id).padStart(5,'0');
  const ds=C.gp(f);if(!ds)continue;
  const p=new Path2D(ds);
  const bb=C.gp.bounds(f);
  C.countyBoxes.push({fips,p,name:f.properties.name,x0:bb[0][0],y0:bb[0][1],x1:bb[1][0],y1:bb[1][1]});
 }
}
function countyTintFor(C,lid){
 C.countyTints=C.countyTints||{};
 if(C.countyTints[lid]!==undefined)return C.countyTints[lid];
 const d=D[lid],l=byId[lid];
 if(!d||!C.countyBoxes){C.countyTints[lid]=null;return null;}
 const cv=document.createElement('canvas');cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
 const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);
 if(d.kind==='flows'){
  const vmax=d.vmax||1;
  for(const b of C.countyBoxes){
   const e=d.counties[b.fips];if(!e)continue;
   const norm=Math.min(1,Math.abs(e.v)/vmax);
   x.fillStyle=hexA(e.v>=0?l.accent:(l.accent2||'#c98a7a'),0.04+norm*0.30);
   x.fill(b.p);
  }
 }else{
  const vmax=d.vmax||60;
  for(const b of C.countyBoxes){
   const e=d.counties[b.fips];if(!e)continue;
   const norm=Math.min(1,e.v/vmax);
   x.fillStyle=hexA(l.accent,0.04+norm*0.30);
   x.fill(b.p);
  }
 }
 C.countyTints[lid]=cv;
 return cv;
}
function countyTintLayers(){
 return live.filter(l=>l.forms.tint&&l.forms.regionKind==='county'&&scopeHas(l.id));
}

// ---------- v2: toast ----------
let toastT=null;
function toast(msg,ms){
 const el=$('#toast');el.textContent=msg;el.classList.add('show');
 clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),ms||3400);
}

// ---------- v2: era scrubber ----------
function buildEraBar(){
 const d=D['memory-births'];
 if(!d||!d.eras)return;
 const bar=$('#eraBar');bar.innerHTML='';
 const mk=(label,e)=>{
  const b=document.createElement('button');b.textContent=label;b.dataset.era=e;
  b.addEventListener('click',()=>setEra(parseInt(b.dataset.era,10)));
  bar.appendChild(b);return b;
 };
 mk('ALL TIME',-1);
 d.eras.labels.forEach((lb,i)=>mk(lb,i));
 const play=document.createElement('button');play.className='play';play.textContent='▶';
 play.addEventListener('click',()=>{
  if(eraPlay){clearInterval(eraPlay);eraPlay=null;play.textContent='▶';return;}
  play.textContent='■';let e=era<0?-1:era;
  eraPlay=setInterval(()=>{
   e++;
   if(e>4){setEra(-1);clearInterval(eraPlay);eraPlay=null;play.textContent='▶';return;}
   setEra(e);
  },2100);
 });
 bar.appendChild(play);
 eraRefresh();
}
function eraRefresh(){
 const d=D['memory-births'];
 const show=d&&d.eras&&activeIds().indexOf('memory-births')>=0;
 $('#eraBar').classList.toggle('show',!!show);
 document.querySelectorAll('#eraBar button[data-era]').forEach(b=>{
  b.classList.toggle('on',parseInt(b.dataset.era,10)===era);
 });
}
function setEra(e){
 if(e===era)return;
 era=e;
 eraRefresh();
 bakeGlow();scheduleQt();updateStatline();writeHash();
 terrainDirty=true;dirty=true;
}

// ---------- v2: camera flights ----------
function flyTo(bbox,ms,done){
 // Albers USA returns null for anything off the composite (an ocean corner of a
 // country-wide box), so the box is sampled, not cornered: whatever projects, we fit.
 const C=SC[scope];
 const N=7,pts=[];
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++)pts.push([bbox[0][0]+(bbox[1][0]-bbox[0][0])*i/N,bbox[0][1]+(bbox[1][1]-bbox[0][1])*j/N]);
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,ok=false;
 for(const g of pts){
  const p=C.proj(g);if(!p||!isFinite(p[0])||!isFinite(p[1]))continue;ok=true;
  x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);
 }
 const ext=C.ext,aw=ext[1][0]-ext[0][0],ah=ext[1][1]-ext[0][1];
 let target;
 if(!ok)target=d3.zoomIdentity;
 else{
  const k=Math.max(1,Math.min(26,0.85*Math.min(aw/Math.max(x1-x0,1),ah/Math.max(y1-y0,1))));
  const cx=(x0+x1)/2,cy=(y0+y1)/2,ecx=(ext[0][0]+ext[1][0])/2,ecy=(ext[0][1]+ext[1][1])/2;
  target=k<=1.02?d3.zoomIdentity:d3.zoomIdentity.translate(ecx-k*cx,ecy-k*cy).scale(k);
 }
 d3.select('#stage').transition('fly').duration(REDUCED?0:(ms||2500)).ease(d3.easeCubicInOut)
  .call(zoomB.transform,target).on('end interrupt',()=>{done&&done();});
}
// camera as geography: a centre and a zoom survive any screen size
function camFor(lon,lat,k){
 const C=SC[scope],p=C.proj([lon,lat]);
 if(!p||!isFinite(p[0]))return d3.zoomIdentity;
 k=Math.max(1,Math.min(26,k||1));
 const ext=C.ext,ecx=(ext[0][0]+ext[1][0])/2,ecy=(ext[0][1]+ext[1][1])/2;
 return k<=1.02?d3.zoomIdentity:d3.zoomIdentity.translate(ecx-k*p[0],ecy-k*p[1]).scale(k);
}
function camNow(){
 const C=SC[scope];if(!C||!C.proj.invert)return null;
 const ext=C.ext,ecx=(ext[0][0]+ext[1][0])/2,ecy=(ext[0][1]+ext[1][1])/2;
 const g=C.proj.invert([(ecx-t.x)/t.k,(ecy-t.y)/t.k]);
 if(!g||!isFinite(g[0])||!isFinite(g[1]))return null;
 return {lon:+g[0].toFixed(4),lat:+g[1].toFixed(4),k:+t.k.toFixed(3)};
}
function flyToCam(lon,lat,k,ms,done){
 d3.select('#stage').transition('fly').duration(REDUCED?0:(ms||2200)).ease(d3.easeCubicInOut)
  .call(zoomB.transform,camFor(lon,lat,k)).on('end interrupt',()=>{done&&done();});
}

// ---------- v2: readings ----------
function capBase(kicker,title,body,accent){
 return '<div class="cc-k" style="color:'+(accent||'#e8b34b')+'">'+kicker+'</div>'+
  '<div class="cc-t">'+title+'</div>'+(body?'<div class="cc-x">'+body+'</div>':'');
}
function showCap(html){const c=$('#capCard');c.innerHTML=html;c.classList.add('open');}
function hideCap(){$('#capCard').classList.remove('open');}
function wireCapNav(){
 const p=$('#ccPrev'),n=$('#ccNext'),e=$('#ccEnd');
 if(p)p.addEventListener('click',()=>stepReading(-1));
 if(n)n.addEventListener('click',()=>stepReading(1));
 if(e)e.addEventListener('click',endReading);
}
function capForReading(r,idx){
 const ac=(r.layers&&r.layers.length&&byId[r.layers[0]])?byId[r.layers[0]].accent:'#e8b34b';
 return capBase(r.kicker,r.title,r.text,ac)+
  '<div class="cc-row"><span class="cc-step">READING '+(idx+1)+' OF '+R.readings.length+'</span>'+
  '<span class="cc-nav"><button class="cc-btn" id="ccPrev">◀ PREV</button><button class="cc-btn" id="ccNext">NEXT ▶</button><button class="cc-btn" id="ccEnd">✕ END</button></span></div>';
}
function clearOrient(){orientTimers.forEach(clearTimeout);orientTimers=[];}
function startReading(i){
 const r=R.readings[i];if(!r)return;
 clearOrient();
 if(plateOpen)closePlate();
 $('#readingsMenu').classList.remove('open');
 if(reading===null)readingSaved={scope:scope,targets:{...target},t:{k:t.k,x:t.x,y:t.y},era:era};
 reading=i;
 if(r.special==='orientation'){runOrientation();return;}
 if(r.scope!==scope)switchScope(r.scope);
 if(era!==-1){era=-1;}
 for(const l of live)target[l.id]=(r.layers.indexOf(l.id)>=0?1:0);
 chipRefresh();updateStatline();eraRefresh();scheduleQt();
 terrainDirty=true;dirty=true;
 flyTo(r.bbox,2600);
 showCap(capForReading(r,i));
 wireCapNav();
}
function stepReading(dir){
 if(tourIdx!==null&&tour){startTour((tourIdx+dir+tour.s.length)%tour.s.length);return;}
 if(reading===null)return;
 let j=(reading+dir+R.readings.length)%R.readings.length;
 startReading(j);
}
const NUMWORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
function numWord(n){const w=NUMWORDS[n]||String(n);return w.charAt(0).toUpperCase()+w.slice(1);}
function runOrientation(){
 if(scope!=='us')switchScope('us');
 for(const l of live)target[l.id]=0;
 era=-1;
 chipRefresh();updateStatline();eraRefresh();scheduleQt();terrainDirty=true;dirty=true;
 d3.select('#stage').transition('fly').duration(900).call(zoomB.transform,d3.zoomIdentity);
 const skipRow='<div class="cc-row"><span class="cc-step">ORIENTATION</span><span class="cc-nav"><button class="cc-btn" id="ccEnd">SKIP ▸</button></span></div>';
 showCap(capBase('HOW TO READ THIS MAP','Orientation',R.readings[0].text.replace('{n}',numWord(railOrder.length)))+skipRow);
 wireCapNav();
 railOrder.forEach((lid,ix)=>{
  orientTimers.push(setTimeout(()=>{
   target[lid]=1;
   chipRefresh();updateStatline();scheduleQt();terrainDirty=true;dirty=true;
   const l=byId[lid],th=themeById[l.theme];
   showCap(capBase(th.name.toUpperCase()+' — '+th.reading.toUpperCase(),l.title,l.statline||l.unit,l.accent)+skipRow);
   wireCapNav();
  },1300+ix*1800));
 });
 orientTimers.push(setTimeout(()=>{
  showCap(capBase('THE SOUL SURVEY','The terrain is us.','Toggle layers. Open a reading. Check the findings. Turn on the audio. Every point is real.')+
   '<div class="cc-row"><span class="cc-step"></span><span class="cc-nav"><button class="cc-btn" id="ccEnd">EXPLORE ▸</button></span></div>');
  wireCapNav();
  orientTimers.push(setTimeout(endReading,4200));
 },1300+railOrder.length*1800+600));
}
function endReading(){
 clearOrient();
 if(eraPlay){clearInterval(eraPlay);eraPlay=null;}
 if(readingSaved){
  if(readingSaved.scope!==scope)switchScope(readingSaved.scope);
  for(const k in readingSaved.targets)target[k]=readingSaved.targets[k];
  era=readingSaved.era;
  const s=readingSaved.t;
  d3.select('#stage').transition('fly').duration(1500).ease(d3.easeCubicInOut)
   .call(zoomB.transform,d3.zoomIdentity.translate(s.x,s.y).scale(s.k));
 }
 reading=null;readingSaved=null;findingOpen=null;tourIdx=null;setCompare(null);
 hideCap();
 chipRefresh();updateStatline();eraRefresh();scheduleQt();
 terrainDirty=true;dirty=true;writeHash();
}
function maybeOrientation(){
 if(tour){startTour(0);return;}
 if(hashHadState)return;
 startReading(0);
}
function buildReadingsMenu(){
 const m=$('#readingsMenu');m.innerHTML='';
 if(tour){
  const it=document.createElement('div');it.className='rm-item citizen';
  it.innerHTML='<div class="rk">A CITIZEN READING · '+tour.s.length+' STOP'+(tour.s.length>1?'S':'')+' · FROM THE LINK</div><div class="rt">'+esc(tour.t)+'</div>';
  it.addEventListener('click',()=>startTour(0));
  m.appendChild(it);
 }
 R.readings.forEach((r,i)=>{
  const it=document.createElement('div');it.className='rm-item';
  it.innerHTML='<div class="rk">'+r.kicker+'</div><div class="rt">'+r.title+'</div>';
  it.addEventListener('click',()=>startReading(i));
  m.appendChild(it);
 });
 const mk=(k,tt,fn)=>{const it=document.createElement('div');it.className='rm-item special';it.innerHTML='<div class="rk">'+k+'</div><div class="rt">'+tt+'</div>';it.addEventListener('click',fn);m.appendChild(it);};
 mk('COMPOSE · NO SERVER, NO ACCOUNT','✎ Record your own reading',()=>startRecording(null));
 mk('SERENDIPITY · PRESS ?','⚄ Random plunge',plunge);
}

// ---------- v2: locate ----------
function havKm(la1,lo1,la2,lo2){
 const R6=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
 const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
 return R6*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function nearestOf(la,lo,lats,lons){
 let bi=-1,bd=1e9;
 for(let i=0;i<lats.length;i++){
  const d=havKm(la,lo,lats[i],lons[i]);
  if(d<bd){bd=d;bi=i;}
 }
 return {i:bi,km:bd};
}
function locateMe(){
 if(!navigator.geolocation){toast('Geolocation is unavailable in this frame — open the shared link in its own tab.');return;}
 toast('Surveying your position…',8000);
 navigator.geolocation.getCurrentPosition(pos=>{
  const la=pos.coords.latitude,lo=pos.coords.longitude;
  const usProj=buildScope('us').proj([lo,la]);
  if(usProj){if(scope!=='us')switchScope('us');}
  else{buildScope('world');if(scope!=='world')switchScope('world');}
  openDossier(la,lo,'Your Position');
  toast('Position found — dossier drawn.');
 },err=>{
  toast('Location unavailable — permission denied or blocked in this frame. Try the shared link in its own tab.');
 },{timeout:12000,maximumAge:600000});
}

// ---------- v2: export sheet ----------
function exportSheet(){
 hoverPt=null;
 drawBase();drawTerrain();drawGlow();drawLabels();
 const off=document.createElement('canvas');off.width=Math.round(W*dpr);off.height=Math.round(H*dpr);
 const x=off.getContext('2d');
 x.fillStyle='#070a10';x.fillRect(0,0,off.width,off.height);
 x.drawImage(cvs.base,0,0);x.drawImage(cvs.terr,0,0);x.drawImage(cvs.glow,0,0);x.drawImage(cvs.lab,0,0);
 x.setTransform(dpr,0,0,dpr,0,0);
 x.strokeStyle='rgba(170,188,214,.4)';x.lineWidth=1;x.strokeRect(14,14,W-28,H-28);
 x.textAlign='left';x.textBaseline='top';
 x.fillStyle='#8a94a6';x.font='500 10px "IBM Plex Mono"';
 x.fillText(R.meta.sheet+' · SURVEYED '+R.meta.surveyed,34,30);
 x.fillStyle='#e8e4d8';x.font='900 30px "Fraunces"';x.fillText('THE SOUL SURVEY',32,44);
 x.fillStyle='#8a94a6';x.font='400 9.5px "IBM Plex Mono"';x.fillText(R.meta.tagline.toUpperCase(),34,82);
 x.textBaseline='middle';
 let ly=H-44;
 const ids=activeIds();
 for(let i=ids.length-1;i>=0;i--){
  const l=byId[ids[i]];
  x.fillStyle=l.accent;x.beginPath();x.arc(38,ly,3.5,0,7);x.fill();
  x.fillStyle='#c9cfda';x.font='500 9.5px "IBM Plex Mono"';
  x.fillText(l.title.toUpperCase()+'  —  '+(l.statline||l.unit),50,ly);
  ly-=17;
 }
 const dnow=new Date();
 x.textAlign='right';
 x.fillStyle='#8a94a6';x.font='400 9px "IBM Plex Mono"';
 x.fillText('SHEET RENDERED '+dnow.toISOString().slice(0,10)+' · '+(scope==='us'?'ALBERS EQUAL-AREA':'EQUAL EARTH')+' · SOULMAP',W-34,H-56);
 x.fillStyle='#5a6577';x.font='400 8px "IBM Plex Mono"';
 x.fillText('© OPENSTREETMAP CONTRIBUTORS · GEONAMES CC-BY · LAOUENAN ET AL. CC-BY-SA · NHTSA FARS · USGS GNIS · EPA · CDC · NUFORC',W-34,H-40);
 off.toBlob(b=>{
  if(!b){toast('Export failed — canvas too large?');return;}
  const url=URL.createObjectURL(b);
  const inFrame=(function(){try{return window.self!==window.top;}catch(e){return true;}})();
  if(inFrame){
   const w=window.open(url,'_blank');
   toast(w?'Sheet rendered — save the image from the new tab.':'Popup blocked — allow popups to export the sheet.');
  }else{
   const a=document.createElement('a');a.href=url;a.download='soul-survey-'+scope+'-'+dnow.toISOString().slice(0,10)+'.png';
   document.body.appendChild(a);a.click();a.remove();
   toast('Sheet exported.');
  }
  setTimeout(()=>URL.revokeObjectURL(url),90000);
 },'image/png');
}

// ---------- v2: permalinks ----------
// codec v2: the camera is geography (c=lon,lat & k), so a link opens on the same place
// on any screen; a lens rides along (z=); a citizen reading rides along (t=).
// v1 links (pixel x/y) still open.
function currentHash(noTour){
 const l=railOrder.map(id=>target[id]>0?1:0).join('');
 const cam=camNow();
 let h='#s='+scope+'&l='+l+'&e='+era+'&k='+t.k.toFixed(3);
 if(cam)h+='&c='+cam.lon+','+cam.lat; else h+='&x='+t.x.toFixed(1)+'&y='+t.y.toFixed(1);
 const zl=Object.keys(lens).find(id=>lens[id]&&scopeHas(id)&&target[id]>0);
 if(zl)h+='&z='+encodeURIComponent(zl+':'+lens[zl].field+':'+lens[zl].v);
 if(tourParam&&!noTour)h+='&t='+tourParam;
 return h;
}
function writeHash(){
 clearTimeout(hashTimer);
 hashTimer=setTimeout(()=>{try{history.replaceState(null,'',currentHash());}catch(e){}},300);
}
let pendingHashT=null,pendingLens=null;
function parseHash(){
 try{
  const h=location.hash.replace(/^#/,'');
  if(!h)return false;
  const q={};h.split('&').forEach(kv=>{const i=kv.indexOf('=');const k=i<0?kv:kv.slice(0,i);q[k]=decodeURIComponent(i<0?'':kv.slice(i+1));});
  if(q.t){const tr=decodeTour(q.t);if(tr){tour=tr;tourParam=q.t;}}
  if(!q.s||(q.s!=='us'&&q.s!=='world'))return tour?{bits:''}:false;
  scope=q.s;
  if(q.e!==undefined){const e=parseInt(q.e,10);if(e>=-1&&e<=4)era=e;}
  const k=parseFloat(q.k);
  if(q.c){
   const c=q.c.split(',').map(Number);
   if(c.length===2&&isFinite(c[0])&&isFinite(c[1]))pendingGeo={lon:c[0],lat:c[1],k:isFinite(k)?k:1};
  }else if(q.k){
   const xx=parseFloat(q.x),yy=parseFloat(q.y);
   if(isFinite(k)&&isFinite(xx)&&isFinite(yy))pendingHashT=d3.zoomIdentity.translate(xx,yy).scale(Math.max(1,Math.min(26,k)));
  }
  if(q.z){const z=q.z.split(':');if(z.length===3)pendingLens={lid:z[0],field:z[1],v:parseInt(z[2],10)};}
  return {bits:q.l||''};
 }catch(e){return false;}
}
function applyPendingLens(){
 if(!pendingLens)return;
 const l=byId[pendingLens.lid];
 if(l&&l.status==='live'&&l.filters){
  const fl=l.filters.find(f=>f.field===pendingLens.field);
  const val=fl&&fl.values.find(v=>v[0]===pendingLens.v);
  if(fl&&val)lens[l.id]={field:fl.field,v:val[0],label:val[1],constellation:!!fl.constellation};
 }
 pendingLens=null;
}

// ---------- v3: findings + split compare ----------
let findingOpen=null,compareMode=null;
function setCompare(cm){
 compareMode=cm;
 const h=$('#splitHandle');
 if(cm){h.style.display='block';h.style.left=(cm.x*100)+'%';}
 else h.style.display='none';
 terrainDirty=true;dirty=true;
}
function buildFindingsMenu(){
 if(!R.findings)return;
 const m=$('#findingsMenu');m.innerHTML='';
 const d=document.createElement('div');d.className='fm-disc';d.textContent=R.findings.disclaimer;m.appendChild(d);
 R.findings.findings.forEach(f=>{
  const it=document.createElement('div');it.className='fm-card'+(f.spurious||f.lesson?' spur':'');
  const tag=f.tag||(f.spurious?'SPURIOUS — ON PURPOSE':'');
  it.innerHTML='<div class="fm-stat">'+f.stat+'</div><div class="fm-body"><div class="fm-t">'+f.title+(tag?' <span class="fm-tag">'+tag+'</span>':'')+'</div><div class="fm-s">'+f.statLabel+'</div></div>';
  it.addEventListener('click',()=>applyFinding(f));
  m.appendChild(it);
 });
}
function findingCap(f){
 const ac=f.spurious?'#8a94a6':(byId[f.layers[0]]?byId[f.layers[0]].accent:'#e8b34b');
 return '<div class="cc-k" style="color:'+ac+'">FINDING'+(f.spurious?' — EPISTEMIC CONTROL':f.lesson?' — A LESSON IN CONFOUNDING':'')+'</div>'+
  '<div class="cc-t">'+f.title+'</div>'+
  '<div class="cc-stat" style="color:'+ac+'">'+f.stat+' <span>'+f.statLabel.toUpperCase()+'</span></div>'+
  '<div class="cc-x">'+f.body+'</div>'+
  '<div class="cc-meth">METHOD — '+f.method+'</div>'+
  '<div class="cc-meth" style="opacity:.7">'+R.findings.disclaimer+'</div>'+
  '<div class="cc-row"><span class="cc-step">FINDINGS · COMPUTED AT BUILD · pipeline/correlate.py</span><span class="cc-nav">'+
  (f.layers.length===2?'<button class="cc-btn" id="ccSplit">⇆ SPLIT</button>':'')+
  '<button class="cc-btn" id="ccEnd">✕ END</button></span></div>';
}
function applyFinding(f){
 clearOrient();
 if(plateOpen)closePlate();
 $('#findingsMenu').classList.remove('open');
 if(reading===null&&!findingOpen)readingSaved={scope:scope,targets:{...target},t:{k:t.k,x:t.x,y:t.y},era:era};
 reading=null;findingOpen=f.id;setCompare(null);
 if(f.scope!==scope)switchScope(f.scope);
 era=-1;
 for(const l of live)target[l.id]=(f.layers.indexOf(l.id)>=0?1:0);
 chipRefresh();updateStatline();eraRefresh();scheduleQt();terrainDirty=true;dirty=true;
 if(f.bbox)flyTo(f.bbox,2400);
 else d3.select('#stage').transition('fly').duration(1500).ease(d3.easeCubicInOut).call(zoomB.transform,d3.zoomIdentity);
 showCap(findingCap(f));
 const e=$('#ccEnd');if(e)e.addEventListener('click',endReading);
 const s=$('#ccSplit');if(s)s.addEventListener('click',()=>setCompare(compareMode?null:{a:f.layers[0],b:f.layers[1],x:0.52}));
}

// ---------- v3: audio ----------
let AU=null,audioOn=false,audioTimer=null,omenTimer=null;
const AUDIO_BASE={'memory-births':.17,'loss-crashes':.2,'power-datacenters':.09,'motion-fulfillment':.07,'power-fortune500':.05,'wonder-ufos':.05,'despair-overdoses':.08,'desire-searches':.06,'residue-superfund':.05,'omen-names':.6,
 'motion-sorting':.07,'company-socialcapital':.05,'faith-altar':.06,'despair-suicide':.045,'betrayal-ledger':.5};
// plucked voices: short events whose rate follows the density under the viewport
const PLUCKS={
 'omen-names':{p:.22,freqs:[220,261.63,329.63,392,523.25],type:'triangle',dec:1.25,ratio:0},          // the names, as bells
 'betrayal-ledger':{p:.10,freqs:[880,987.77,1174.66,1318.51,1760],type:'sine',dec:.85,ratio:2.76}     // coins, inharmonic
};
function mkNoise(ctx){
 const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
 let last=0;
 for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+0.03*w)/1.03;d[i]=last*3.2;}
 const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;return src;
}
function buildAudio(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx)throw new Error('no audio');
 const ctx=new Ctx();
 const comp=ctx.createDynamicsCompressor();comp.threshold.value=-26;comp.ratio.value=8;
 const master=ctx.createGain();master.gain.value=0;
 master.connect(comp);comp.connect(ctx.destination);
 const V={};
 const osc=(fr,ty)=>{const o=ctx.createOscillator();o.type=ty||'sine';o.frequency.value=fr;o.start();return o;};
 const lfoGain=(node,fr,depth,base)=>{const l=osc(fr);const lg=ctx.createGain();lg.gain.value=depth;l.connect(lg);lg.connect(node.gain);node.gain.value=base;};
 const voice=(build)=>{
  const g=ctx.createGain();g.gain.value=0;
  const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(pan){g.connect(pan);pan.connect(master);}else g.connect(master);
  build(g);
  return {g,pan};
 };
 V['memory-births']=voice(g=>{const a=osc(146.83),b=osc(220);a.detune.value=-5;b.detune.value=6;const gg=ctx.createGain();a.connect(gg);b.connect(gg);gg.connect(g);lfoGain(gg,.07,.16,.5);});
 V['loss-crashes']=voice(g=>{const o=osc(55);const gg=ctx.createGain();o.connect(gg);gg.connect(g);lfoGain(gg,.85,.4,.5);});
 V['power-datacenters']=voice(g=>{const o=osc(98,'sawtooth');const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=420;o.connect(f);f.connect(g);});
 V['motion-fulfillment']=voice(g=>{const n=mkNoise(ctx);const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=820;f.Q.value=8;const gg=ctx.createGain();n.connect(f);f.connect(gg);gg.connect(g);lfoGain(gg,2.3,.45,.5);n.start();});
 V['power-fortune500']=voice(g=>{osc(293.66).connect(g);});
 V['wonder-ufos']=voice(g=>{const o=osc(1567);const gg=ctx.createGain();o.connect(gg);gg.connect(g);lfoGain(gg,5.1,.45,.5);setInterval(()=>{try{o.detune.linearRampToValueAtTime((Math.random()*2-1)*90,ctx.currentTime+1.4);}catch(e){}},1600);});
 V['despair-overdoses']=voice(g=>{const a=osc(233.08),b=osc(246.94);const gg=ctx.createGain();gg.gain.value=.5;a.connect(gg);b.connect(gg);gg.connect(g);});
 V['desire-searches']=voice(g=>{const n=mkNoise(ctx);const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=520;f.Q.value=3.5;n.connect(f);f.connect(g);const l=osc(.06);const lg=ctx.createGain();lg.gain.value=320;l.connect(lg);lg.connect(f.frequency);n.start();});
 V['residue-superfund']=voice(g=>{const o=osc(311.13,'triangle');const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;o.connect(f);f.connect(g);});
 V['omen-names']=voice(g=>{});
 // v0.6 voices
 V['motion-sorting']=voice(g=>{const n=mkNoise(ctx);const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=240;const gg=ctx.createGain();n.connect(f);f.connect(gg);gg.connect(g);lfoGain(gg,.11,.45,.5);n.start();});   // the country breathing in and out
 V['company-socialcapital']=voice(g=>{const a=osc(261.63),b=osc(329.63),c=osc(392);const gg=ctx.createGain();gg.gain.value=.33;a.connect(gg);b.connect(gg);c.connect(gg);gg.connect(g);lfoGain(gg,.05,.1,.33);}); // a warm triad: company
 V['faith-altar']=voice(g=>{const a=osc(130.81),b=osc(196),c=osc(261.63);const gg=ctx.createGain();gg.gain.value=.3;a.connect(gg);b.connect(gg);c.connect(gg);const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=700;gg.connect(f);f.connect(g);lfoGain(gg,.16,.08,.3);}); // an organ, far off
 V['despair-suicide']=voice(g=>{const o=osc(41.2);const gg=ctx.createGain();o.connect(gg);gg.connect(g);lfoGain(gg,.045,.35,.45);});   // the quiet hours: barely there
 V['betrayal-ledger']=voice(g=>{});
 return {ctx,master,V};
}
function viewportDensity(lid){
 const C=SC[scope];
 const g=layerGrid(C,lid);
 if(!g)return 0.45;
 const ext=C.ext;
 const x0=(padLeft()-t.x)/t.k,y0=(96-t.y)/t.k,x1=(W-44-t.x)/t.k,y1=(H-84-t.y)/t.k;
 const exw=ext[1][0]-ext[0][0],exh=ext[1][1]-ext[0][1];
 const gx0=Math.max(0,Math.floor((x0-ext[0][0])/exw*C.GW)),gx1=Math.min(C.GW-1,Math.ceil((x1-ext[0][0])/exw*C.GW));
 const gy0=Math.max(0,Math.floor((y0-ext[0][1])/exh*C.GH)),gy1=Math.min(C.GH-1,Math.ceil((y1-ext[0][1])/exh*C.GH));
 if(gx1<gx0||gy1<gy0)return 0;
 let s=0,n=0,cx=0;
 for(let y=gy0;y<=gy1;y+=2)for(let x=gx0;x<=gx1;x+=2){const v=g[y*C.GW+x];s+=v;n++;if(v>0)cx+=v*x;}
 const mean=n?s/n:0;
 const panx=s>0?((cx/s)-(gx0+gx1)/2)/Math.max(1,(gx1-gx0)/2):0;
 return {mean:Math.min(1,mean*2.2),pan:Math.max(-1,Math.min(1,panx))};
}
function updateAudio(){
 if(!AU||!audioOn)return;
 for(const l of live){
  const v=AU.V[l.id];if(!v)continue;
  const a=alpha[l.id]||0;
  let dens=0,pan=0;
  if(a>0.02&&scopeHas(l.id)){
   const r=viewportDensity(l.id);
   if(typeof r==='number')dens=r;else{dens=r.mean;pan=r.pan;}
  }
  const gt=Math.pow(dens,0.7)*a*(AUDIO_BASE[l.id]||.06);
  try{
   v.g.gain.setTargetAtTime(gt,AU.ctx.currentTime,.4);
   if(v.pan)v.pan.pan.setTargetAtTime(pan*.75,AU.ctx.currentTime,.6);
  }catch(e){}
 }
}
function pluckTick(){
 if(!AU||!audioOn)return;
 for(const lid in PLUCKS){
  const cfg=PLUCKS[lid],a=alpha[lid]||0;
  if(a<=0.05||!byId[lid]||!scopeHas(lid))continue;
  const r=viewportDensity(lid);
  const dens=typeof r==='number'?r:r.mean;
  if(Math.random()>cfg.p+dens*0.6)continue;
  const ctx=AU.ctx,v=AU.V[lid];if(!v)continue;
  const f0=cfg.freqs[Math.floor(Math.random()*cfg.freqs.length)];
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001,ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(.9,ctx.currentTime+.02);
  g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+cfg.dec);
  g.connect(v.g);
  const o=ctx.createOscillator();o.type=cfg.type;o.frequency.value=f0;o.connect(g);o.start();o.stop(ctx.currentTime+cfg.dec+.1);
  if(cfg.ratio){const o2=ctx.createOscillator();o2.type='sine';o2.frequency.value=f0*cfg.ratio;const g2=ctx.createGain();g2.gain.value=.3;o2.connect(g2);g2.connect(g);o2.start();o2.stop(ctx.currentTime+cfg.dec+.1);}
 }
}
function audioToggle(){
 if(!AU){
  try{AU=buildAudio();}catch(e){toast('Audio is unavailable in this browser or frame.');return;}
 }
 audioOn=!audioOn;
 $('#audioBtn').classList.toggle('on',audioOn);
 if(audioOn){
  try{AU.ctx.resume();}catch(e){}
  AU.master.gain.setTargetAtTime(.6,AU.ctx.currentTime,.5);
  if(!audioTimer)audioTimer=setInterval(updateAudio,300);
  if(!omenTimer)omenTimer=setInterval(pluckTick,620);
  updateAudio();
  toast('The survey is singing — pan the map, toggle layers, change eras.');
 }else{
  AU.master.gain.setTargetAtTime(0.0,AU.ctx.currentTime,.3);
  toast('Audio off.');
 }
}

// ---------- v4: THE INDEX ----------
const REDUCED=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let INDEX=null,idxResults=[],idxSel=0;
function buildIndex(){
 if(INDEX)return INDEX;
 const E=[];
 const push=(label,sub,o)=>{if(label)E.push(Object.assign({label:String(label),l:String(label).toLowerCase(),sub},o));};
 if(B.places){
  for(const r of B.places.us)push(r[0],r[1]+' · place',{type:'place',scope:'us',la:r[2],lo:r[3],pop:r[4]});
  for(const r of B.places.world)push(r[0],r[1]+' · place',{type:'place',scope:'world',la:r[2],lo:r[3],pop:r[4]});
 }
 const dm=D['memory-births'];
 if(dm)for(let i=0;i<dm.stars.name.length;i++)push(dm.stars.name[i],(dm.stars.birth[i]?'b. '+dm.stars.birth[i]+' · ':'')+(dm.stars.dom[i]||'memory'),{type:'star',lid:'memory-births',i,scope:'any',la:dm.stars.lat[i],lo:dm.stars.lon[i],pop:(dm.stars.v[i]||0)*20000});
 const sf=D['residue-superfund'];
 if(sf)for(let i=0;i<sf.name.length;i++)push(sf.name[i],'Superfund · '+sf.state[i],{type:'pt',lid:'residue-superfund',i,scope:'us',la:sf.lat[i],lo:sf.lon[i],pop:120000});
 const f5=D['power-fortune500'];
 if(f5)for(let i=0;i<f5.name.length;i++)push(f5.name[i],'#'+f5.rank[i]+' · '+f5.loc[i],{type:'pt',lid:'power-fortune500',i,scope:'us',la:f5.lat[i],lo:f5.lon[i],pop:(f5.v[i]||0)*3});
 const am=D['motion-fulfillment'];
 if(am)for(let i=0;i<am.name.length;i++)push(am.name[i],(am.typeNames[am.t[i]]||'')+' · '+am.loc[i],{type:'pt',lid:'motion-fulfillment',i,scope:'us',la:am.lat[i],lo:am.lon[i],pop:100000});
 const om=D['omen-names'];
 if(om)for(let i=0;i<om.name.length;i++)push(om.name[i],(om.s[i]?'light':'dark')+' omen · '+om.st[i],{type:'pt',lid:'omen-names',i,scope:'us',la:om.lat[i],lo:om.lon[i],pop:80000});
 const bl=D['betrayal-ledger'];
 if(bl)for(let i=0;i<bl.name.length;i++){
  push(bl.name[i],money(bl.v[i])+' · '+(bl.who[i]||'').split(';')[0].split(',')[0]+' · ledger',{type:'pt',lid:'betrayal-ledger',i,scope:'us',la:bl.lat[i],lo:bl.lon[i],pop:900000+bl.v[i]/40});
  const who=(bl.who[i]||'').split(';')[0].split(',')[0].trim();
  if(who)push(who,bl.name[i]+' · '+money(bl.v[i])+' · convicted',{type:'pt',lid:'betrayal-ledger',i,scope:'us',la:bl.lat[i],lo:bl.lon[i],pop:900000});
 }
 const dc=D['power-datacenters'];
 if(dc)for(let i=0;i<dc.name.length;i++)if(dc.name[i])push(dc.name[i],'data center',{type:'pt',lid:'power-datacenters',i,scope:'any',la:dc.lat[i],lo:dc.lon[i],pop:30000});
 const uf=D['wonder-ufos'];
 if(uf&&uf.v){
  const Cu=buildScope('us'),top=[];
  for(let i=0;i<uf.v.length;i++)if(uf.v[i]>=60)top.push(i);
  top.sort((a,b)=>uf.v[b]-uf.v[a]);
  for(const i of top.slice(0,60)){
   let near='';
   if(Cu.places){let bd=1e9;for(let j=0;j<Math.min(Cu.places.length,600);j++){const pl=Cu.places[j];if(Math.abs(pl.la-uf.lat[i])>1.5||Math.abs(pl.lo-uf.lon[i])>1.8)continue;const dd=havKm(uf.lat[i],uf.lon[i],pl.la,pl.lo);if(dd<bd){bd=dd;near=pl.name+', '+pl.st;}}}
   push(fmtInt(uf.v[i])+' sightings'+(near?' near '+near:''),'densest sky · NUFORC',{type:'pt',lid:'wonder-ufos',i,scope:'any',la:uf.lat[i],lo:uf.lon[i],pop:200000+uf.v[i]*300});
  }
 }
 try{
  // counties by spherical centroid: no projection, no outlines, no wait
  if(!geo.counties)geo.counties=topo.feature(B.counties,B.counties.objects.counties).features;
  for(const f of geo.counties){
   const fips=String(f.id).padStart(5,'0'),st=FIPS_POSTAL[fips.slice(0,2)];if(!st)continue;
   const g=d3.geoCentroid(f);if(!g||!isFinite(g[0])||!isFinite(g[1]))continue;
   push(f.properties.name+', '+st,'county',{type:'county',scope:'us',fips,la:g[1],lo:g[0],pop:150000});
  }
 }catch(e){}
 for(const st in STATE_NAME)push(STATE_NAME[st],'state',{type:'state',st,scope:'us',pop:5000000});
 for(const l of live)push(l.title,'layer · '+themeById[l.theme].name,{type:'layer',lid:l.id,pop:3000000});
 R.readings.forEach((r,i)=>push(r.title,'reading',{type:'reading',ri:i,pop:3000000}));
 if(R.findings)R.findings.findings.forEach(f=>push(f.title,'finding · '+f.stat,{type:'finding',f,pop:3000000}));
 INDEX=E;
 return E;
}
function searchIndex(q){
 q=q.trim().toLowerCase();
 if(q.length<2)return [];
 const out=[];
 for(const e of buildIndex()){
  const ix=e.l.indexOf(q);
  if(ix<0)continue;
  let s=(ix===0?3:(e.l.charCodeAt(ix-1)===32?2:1))+Math.min(1.6,(e.pop||0)/6e6);
  out.push([s,e]);
 }
 out.sort((a,b)=>b[0]-a[0]);
 return out.slice(0,8).map(x=>x[1]);
}
function showTipAt(content,p){
 // arrivals from the Index, the plunge, and the tour hold their tooltip in place
 pinTip(content,p[0],p[1]);
}
function selectEntry(e){
 if(pickMode&&e.la!=null){
  const A=pickMode.A;
  pickMode=null;
  closeIndex();
  $('#idxHint').textContent='↑↓ select · ENTER go · ▤ field dossier on places · ESC close';
  renderDossierDiff(A,computeDossier(e.la,e.lo,e.label));
  return;
 }
 closeIndex();
 if(e.type==='layer'){openPlate(e.lid);return;}
 if(e.type==='reading'){startReading(e.ri);return;}
 if(e.type==='finding'){applyFinding(e.f);return;}
 let sc=e.scope;
 if(sc==='any')sc=buildScope('us').proj([e.lo,e.la])?'us':'world';
 if(sc==='us'&&e.type==='place'&&!buildScope('us').proj([e.lo,e.la]))sc='world';
 if(sc!==scope)switchScope(sc);
 if(e.lid&&!target[e.lid]&&scopeHas(e.lid)){
  target[e.lid]=1;
  chipRefresh();updateStatline();eraRefresh();scheduleQt();terrainDirty=true;bakeGlow(true);
 }
 let la=e.la,lo=e.lo;
 if(e.type==='state'){
  const c=SC[scope].stateCent[e.st];
  if(c&&SC[scope].proj.invert){const g=SC[scope].proj.invert(c);if(g){lo=g[0];la=g[1];}}
 }
 const dLo=e.type==='state'?3.4:0.55,dLa=e.type==='state'?2.4:0.38;
 flyTo([[lo-dLo,la-dLa],[lo+dLo,la+dLa]],2200,()=>{
  const C=SC[scope],p=C.proj([lo,la]);
  if(!p)return;
  if(e.type==='star'||e.type==='pt'){
   const f={lid:e.lid,i:e.i,kind:e.type==='star'?'star':'pt'};
   const content=tipHTML(f);
   hoverPt={x:p[0],y:p[1],color:content.color};dirty=true;
   showTipAt(content,p);
  }else{
   hoverPt={x:p[0],y:p[1],color:'#c8d2e2'};dirty=true;
   showTipAt({k:e.type==='state'?'REFERENCE — STATE':e.type==='county'?'REFERENCE — COUNTY':'REFERENCE',ti:esc(e.label),s:esc(e.sub),color:'#c8d2e2'},p);
  }
 });
}
function renderIdx(res){
 idxResults=res;idxSel=0;
 const box=$('#idxResults');
 box.innerHTML=res.length?'':'<div class="ix-empty">Type a town, a county, a person, a company, a facility code, a buried site, an omen, a betrayal, a state, a layer, a reading, a finding. Everything named in the survey is indexed — '+fmtInt(buildIndex().length)+' entries, all local.</div>';
 res.forEach((e,i)=>{
  const d=document.createElement('div');
  d.className='ix-row'+(i===idxSel?' sel':'');
  d.innerHTML='<span class="ix-l">'+esc(e.label)+'</span><span class="ix-s">'+esc(e.sub)+'</span>'+(e.type==='place'||e.type==='county'?'<button class="ix-dossier" title="Open field dossier" aria-label="Open field dossier">▤</button>':'');
  d.addEventListener('click',ev=>{
   if(ev.target.closest('.ix-dossier')){closeIndex();openDossier(e.la,e.lo,e.label);return;}
   selectEntry(e);
  });
  box.appendChild(d);
 });
}
function idxHighlight(){
 document.querySelectorAll('.ix-row').forEach((r,i)=>r.classList.toggle('sel',i===idxSel));
}
function openIndex(){
 // focus first, build second: keystrokes typed during the first build queue into the
 // input instead of landing on the map as layer hotkeys
 $('#indexOverlay').classList.add('open');
 const inp=$('#idxInput');inp.value='';
 inp.focus();
 renderIdx([]);
}
function closeIndex(){
 $('#indexOverlay').classList.remove('open');
 if(pickMode){pickMode=null;$('#idxHint').textContent='↑↓ select · ENTER go · ▤ field dossier on places · ESC close';}
}

// ---------- v4: FIELD DOSSIER ----------
let rateRank=null;
function getRateRank(){
 if(rateRank)return rateRank;
 const dd=D['despair-overdoses'];
 rateRank={};
 if(dd){
  const arr=Object.entries(dd.counties).sort((a,b)=>b[1].v-a[1].v);
  arr.forEach(([fips],i)=>rateRank[fips]=i+1);
  rateRank.__n=arr.length;
 }
 return rateRank;
}
function doRow(lid,html){
 const l=byId[lid];
 return '<div class="do-row"><span class="dot" style="background:'+(l?l.accent:'#c8d2e2')+'"></span><span>'+html+'</span></div>';
}
function openDossier(la,lo,label){
 const usOk=!!buildScope('us').proj([lo,la]);
 if(usOk&&scope!=='us')switchScope('us');
 flyTo([[lo-1.2,la-0.85],[lo+1.2,la+0.85]],2200);
 renderDossier(computeDossier(la,lo,label));
}
function computeDossier(la,lo,label){
 const usOk=!!buildScope('us').proj([lo,la]);
 const secs=[];
 // THE GROUND
 let ground='';
 let stName='',countyName='',countyFips=null;
 if(usOk){
  const C=buildScope('us');
  const p=C.proj([lo,la]);
  idT(hitCtx);
  for(const st in C.statePaths){if(hitCtx.isPointInPath(C.statePaths[st],p[0]*dpr,p[1]*dpr)){stName=STATE_NAME[st]||st;
   const dd=D['desire-searches'];
   if(dd){
    if(dd.us[st])ground+=doRow('desire-searches','State’s signature search: <b>'+dd.us[st]+'</b>');
    else if(dd.dark.indexOf(st)>=0)ground+=doRow('desire-searches','Desire: <b>unmeasured</b> — access blocked here (dark state)');
   }
   break;}}
  ensureCounties(C);
  if(C.countyBoxes){
   for(const b of C.countyBoxes){
    if(p[0]<b.x0||p[0]>b.x1||p[1]<b.y0||p[1]>b.y1)continue;
    if(hitCtx.isPointInPath(b.p,p[0]*dpr,p[1]*dpr)){countyName=b.name;countyFips=b.fips;break;}
   }
  }
  if(countyFips){
   const dd=D['despair-overdoses'];
   const e=dd&&dd.counties[countyFips];
   const rr=getRateRank();
   if(e)ground=doRow('despair-overdoses','Overdose mortality: <b>'+e.v+' per 100k (2024)</b> — rank '+(rr[countyFips]||'—')+' of '+fmtInt(rr.__n||0)+' counties')+ground;
   else ground=doRow('despair-overdoses','Overdose mortality: <b>suppressed</b> (small counts protect privacy)')+ground;
   // v0.6: the quiet layers answer too — rates for a place, never points for people
   const ds=D['despair-suicide'];
   if(ds){const e2=ds.counties[countyFips];ground+=doRow('despair-suicide','Suicide mortality: <b>'+(e2?esc(e2.label.split(' — ')[0])+' (2018–2022, age-adjusted)':'suppressed — kept dark by law and by principle')+'</b> · if you need it, call or text <b>988</b>');}
   const ec=D['company-socialcapital'];
   if(ec){const e2=ec.counties[countyFips];if(e2)ground+=doRow('company-socialcapital','Economic connectedness: <b>'+esc(e2.label.split(' — ')[0].replace(/^EC /,''))+'</b> (1.0 = class-blind friendship)');}
   const fa=D['faith-altar'];
   if(fa){const e2=fa.counties[countyFips];if(e2){const parts=e2.label.split(' — ');ground+=doRow('faith-altar','The altar: <b>'+esc(parts[0])+'</b>'+(parts[2]?' · '+esc(parts[2]):''));}}
   const ms=D['motion-sorting'];
   if(ms){const e2=ms.counties[countyFips];if(e2)ground+=doRow('motion-sorting','The sorting: <b>'+esc(e2.label.split(' — ')[0].replace(' hh',' households'))+'</b> (2022–23, tax filers)');}
  }
 }
 if(ground)secs.push(['THE GROUND',ground]);
 // THE LEDGER
 const blg=D['betrayal-ledger'];
 if(blg&&usOk){
  const n=nearestOf(la,lo,blg.lat,blg.lon);
  if(n.i>=0)secs.push(['THE LEDGER',doRow('betrayal-ledger','Nearest betrayal on the ledger: <b>'+esc(blg.name[n.i])+' — '+money(blg.v[n.i])+'</b> · '+esc((blg.who[n.i]||'').split(';')[0])+' · '+Math.round(n.km)+' km')]);
 }
 // THE LIGHT
 let light='';
 const dm=D['memory-births'];
 if(dm){
  const n=nearestOf(la,lo,dm.stars.lat,dm.stars.lon);
  if(n.i>=0)light+=doRow('memory-births','Most notable neighbor: <b>'+dm.stars.name[n.i]+'</b>'+(dm.stars.birth[n.i]?' (b. '+dm.stars.birth[n.i]+')':'')+' · '+Math.round(n.km)+' km');
  let births=0;
  for(let i=0;i<dm.cells.lat.length;i++){
   if(Math.abs(dm.cells.lat[i]-la)>0.7||Math.abs(dm.cells.lon[i]-lo)>0.9)continue;
   if(havKm(la,lo,dm.cells.lat[i],dm.cells.lon[i])<=50)births+=dm.cells.v[i];
  }
  light+=doRow('memory-births','Remembered births within 50 km: <b>'+fmtInt(births)+'</b>');
 }
 if(light)secs.push(['THE LIGHT',light]);
 // THE MACHINES
 let mach='';
 const dc=D['power-datacenters'];
 if(dc){const n=nearestOf(la,lo,dc.lat,dc.lon);if(n.i>=0)mach+=doRow('power-datacenters','Nearest data center: <b>'+(dc.name[n.i]||'unnamed facility')+'</b> · '+Math.round(n.km)+' km');}
 const f5=D['power-fortune500'];
 if(f5&&usOk){const n=nearestOf(la,lo,f5.lat,f5.lon);if(n.i>=0)mach+=doRow('power-fortune500','Nearest throne: <b>#'+f5.rank[n.i]+' '+f5.name[n.i]+'</b> · '+Math.round(n.km)+' km');}
 const am=D['motion-fulfillment'];
 if(am&&usOk){const n=nearestOf(la,lo,am.lat,am.lon);if(n.i>=0)mach+=doRow('motion-fulfillment','Nearest Amazon node: <b>'+am.name[n.i]+'</b> ('+(am.typeNames[am.t[n.i]]||'')+') · '+Math.round(n.km)+' km');}
 if(mach)secs.push(['THE MACHINES',mach]);
 // THE TOLL
 let toll='';
 const cr=D['loss-crashes'];
 if(cr&&usOk){
  let c=0,dth=0;
  for(let i=0;i<cr.lat.length;i++){
   if(Math.abs(cr.lat[i]-la)>0.45||Math.abs(cr.lon[i]-lo)>0.6)continue;
   if(havKm(la,lo,cr.lat[i],cr.lon[i])<=40){c++;dth+=cr.v[i];}
  }
  toll+=doRow('loss-crashes','Fatal crashes within 40 km (2023): <b>'+fmtInt(c)+'</b> · <b>'+fmtInt(dth)+' deaths</b>');
 }
 const sf=D['residue-superfund'];
 if(sf&&usOk){const n=nearestOf(la,lo,sf.lat,sf.lon);if(n.i>=0)toll+=doRow('residue-superfund','Nearest buried ground: <b>'+sf.name[n.i]+'</b> ('+['proposed','on the NPL','deleted'][sf.st2[n.i]]+') · '+Math.round(n.km)+' km');}
 const uf=D['wonder-ufos'];
 if(uf){
  let s=0;
  for(let i=0;i<uf.lat.length;i++){
   if(Math.abs(uf.lat[i]-la)>0.7||Math.abs(uf.lon[i]-lo)>0.9)continue;
   if(havKm(la,lo,uf.lat[i],uf.lon[i])<=50)s+=uf.v?uf.v[i]:1;
  }
  toll+=doRow('wonder-ufos','Sightings reported within 50 km: <b>'+fmtInt(s)+'</b> (1906–2014)');
 }
 if(toll)secs.push(['THE TOLL & THE SKY',toll]);
 // THE OMENS
 let omens='';
 const om=D['omen-names'];
 if(om&&usOk){
  let bd=1e9,bi=-1,ld=1e9,li=-1;
  for(let i=0;i<om.lat.length;i++){
   const d=havKm(la,lo,om.lat[i],om.lon[i]);
   if(om.s[i]===0){if(d<bd){bd=d;bi=i;}}else{if(d<ld){ld=d;li=i;}}
  }
  if(bi>=0)omens+=doRow('omen-names','Nearest dark name: <b>'+om.name[bi]+'</b> · '+Math.round(bd)+' km');
  if(li>=0)omens+=doRow('omen-names','Nearest light name: <b>'+om.name[li]+'</b> · '+Math.round(ld)+' km');
 }
 if(omens)secs.push(['THE OMENS',omens]);

 const title=label||'Your Position';
 const coords=Math.abs(la).toFixed(3)+'°'+(la>=0?'N':'S')+'  '+Math.abs(lo).toFixed(3)+'°'+(lo>=0?'E':'W')+(countyName?' · '+countyName+(stName?' — '+stName.toUpperCase():''):stName?' · '+stName.toUpperCase():'');
 return {title,coords,secs};
}
function renderDossier(d){
 window.__dossier=d;
 $('#dossierInner').innerHTML='<button class="pl-x" id="doClose">✕ ESC</button>'+
  '<div class="do-over">FIELD DOSSIER — '+R.meta.sheet+'</div>'+
  '<div class="do-title">'+d.title+'</div>'+
  '<div class="do-coords">'+d.coords+'</div>'+
  d.secs.map(s=>'<div class="do-h">'+s[0]+'</div>'+s[1]).join('')+
  '<div class="do-actions"><button class="cc-btn" id="doCompare">⇄ COMPARE</button><button class="cc-btn" id="doExport">⤓ EXPORT DOSSIER</button><button class="cc-btn" id="doClose2">CLOSE</button></div>';
 $('#dossier').classList.add('open');
 const close=()=>$('#dossier').classList.remove('open');
 $('#doClose').addEventListener('click',close);
 $('#doClose2').addEventListener('click',close);
 $('#doExport').addEventListener('click',exportDossier);
 $('#doCompare').addEventListener('click',()=>{
  pickMode={A:d};
  $('#dossier').classList.remove('open');
  openIndex();
  $('#idxHint').textContent='PICK THE SECOND PLACE — any town, star, or site with coordinates · ESC cancels';
 });
}
function renderDossierDiff(A,B){
 window.__dossier=null;
 const names=[];
 A.secs.concat(B.secs).forEach(s=>{if(names.indexOf(s[0])<0)names.push(s[0]);});
 const find=(d,n)=>{const s=d.secs.find(x=>x[0]===n);return s?s[1]:'<div class="do-row"><span class="dot" style="background:#5a6577"></span><span>— not surveyed here</span></div>';};
 $('#dossierInner').innerHTML='<button class="pl-x" id="doClose">✕ ESC</button>'+
  '<div class="do-over">FIELD DOSSIER — FACE TO FACE</div>'+
  '<div class="dd-grid"><div><div class="do-title" style="font-size:21px">'+A.title+'</div><div class="do-coords">'+A.coords+'</div></div>'+
  '<div><div class="do-title" style="font-size:21px">'+B.title+'</div><div class="do-coords">'+B.coords+'</div></div></div>'+
  names.map(n=>'<div class="do-h">'+n+'</div><div class="dd-grid"><div>'+find(A,n)+'</div><div>'+find(B,n)+'</div></div>').join('')+
  '<div class="do-actions"><button class="cc-btn" id="doClose2">CLOSE</button></div>';
 $('#dossier').classList.add('open');
 const close=()=>$('#dossier').classList.remove('open');
 $('#doClose').addEventListener('click',close);
 $('#doClose2').addEventListener('click',close);
}
function exportDossier(){
 const d=window.__dossier;if(!d)return;
 const Wd=1080,pad=70;
 const rows=[];
 d.secs.forEach(s=>{
  rows.push(['h',s[0]]);
  const tmp=document.createElement('div');tmp.innerHTML=s[1];
  tmp.querySelectorAll('.do-row').forEach(r=>{
   const dot=r.querySelector('.dot');
   rows.push(['r',r.textContent.trim(),dot?dot.style.background:'#c8d2e2']);
  });
 });
 const Hd=250+rows.reduce((a,r)=>a+(r[0]==='h'?58:34),0)+120;
 const off=document.createElement('canvas');off.width=Wd*2;off.height=Hd*2;
 const x=off.getContext('2d');x.scale(2,2);
 x.fillStyle='#070a10';x.fillRect(0,0,Wd,Hd);
 x.strokeStyle='rgba(170,188,214,.4)';x.strokeRect(16,16,Wd-32,Hd-32);
 x.textBaseline='top';x.textAlign='left';
 x.fillStyle='#8a94a6';x.font='500 11px "IBM Plex Mono"';x.fillText('FIELD DOSSIER — '+R.meta.sheet+' · SURVEYED '+R.meta.surveyed,pad,60);
 x.fillStyle='#e8e4d8';x.font='italic 700 40px "Fraunces"';x.fillText(d.title,pad-2,84);
 x.fillStyle='#8a94a6';x.font='400 11px "IBM Plex Mono"';x.fillText(d.coords,pad,140);
 let y=196;
 for(const r of rows){
  if(r[0]==='h'){
   x.strokeStyle='rgba(148,166,196,.16)';x.beginPath();x.moveTo(pad,y);x.lineTo(Wd-pad,y);x.stroke();
   x.fillStyle='#e8b34b';x.font='500 11px "IBM Plex Mono"';x.fillText(r[1],pad,y+16);y+=58;
  }else{
   x.fillStyle=r[2];x.beginPath();x.arc(pad+5,y+8,4,0,7);x.fill();
   x.fillStyle='#c9cfda';x.font='400 13px "IBM Plex Mono"';x.fillText(r[1],pad+22,y);y+=34;
  }
 }
 x.fillStyle='#5a6577';x.font='400 9px "IBM Plex Mono"';
 x.fillText('THE SOUL SURVEY · WHERE, NOT WHY · SOURCES: NHTSA FARS · CDC · EPA · USGS GNIS · NUFORC · OSM (ODbL) · GEONAMES (CC-BY) · LAOUENAN ET AL. (CC-BY-SA)',pad,Hd-70);
 off.toBlob(b=>{
  if(!b){toast('Export failed.');return;}
  const url=URL.createObjectURL(b);
  const inFrame=(function(){try{return window.self!==window.top;}catch(e){return true;}})();
  if(inFrame){const w=window.open(url,'_blank');toast(w?'Dossier rendered — save it from the new tab.':'Popup blocked — allow popups to export.');}
  else{const a=document.createElement('a');a.href=url;a.download='soul-survey-dossier.png';document.body.appendChild(a);a.click();a.remove();toast('Dossier exported.');}
  setTimeout(()=>URL.revokeObjectURL(url),90000);
 },'image/png');
}

// ======================================================================
// ---------- v0.6: CITIZEN READINGS — the survey becomes a medium ----------
// A reading is a sequence of stops. A stop is a camera, a sheet, the layer bits, an
// era, a lens, an optional benchmark, and a caption. The whole thing is encoded into
// the link: no server, no account, nothing to moderate, nothing to lose.
// ======================================================================
function b64uEncode(str){
 const b=new TextEncoder().encode(str);let s='';
 for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64uDecode(s){
 s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';
 const bin=atob(s),b=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);
 return new TextDecoder().decode(b);
}
function encodeTour(tr){return b64uEncode(JSON.stringify(tr));}
function decodeTour(str){
 // everything from the link is untrusted: clamp, coerce, drop what does not parse
 try{
  const o=JSON.parse(b64uDecode(str));
  if(!o||!Array.isArray(o.s)||!o.s.length||o.s.length>60)return null;
  const stops=[];
  for(const st of o.s){
   if(!st||!Array.isArray(st.c)||st.c.length!==2)continue;
   const lon=+st.c[0],lat=+st.c[1];if(!isFinite(lon)||!isFinite(lat)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
   stops.push({c:[lon,lat],k:Math.max(1,Math.min(26,+st.k||1)),s:st.s==='world'?'world':'us',
    l:String(st.l||'').replace(/[^01]/g,'').slice(0,64),e:(st.e>=-1&&st.e<=4)?Math.round(+st.e):-1,
    z:(st.z&&typeof st.z==='object'&&st.z.lid&&st.z.field!=null)?{lid:String(st.z.lid).slice(0,40),field:String(st.z.field).slice(0,20),v:Math.round(+st.z.v)}:null,
    p:(Array.isArray(st.p)&&st.p.length===2&&isFinite(+st.p[0])&&isFinite(+st.p[1]))?[+st.p[0],+st.p[1]]:null,
    x:String(st.x||'').slice(0,600)});
  }
  if(!stops.length)return null;
  return {v:1,t:String(o.t||'').slice(0,120),s:stops};
 }catch(e){return null;}
}
function captureStop(caption,keepPin){
 const cam=camNow()||{lon:0,lat:0,k:1};
 const zl=Object.keys(lens).find(id=>lens[id]&&scopeHas(id)&&target[id]>0);
 return {c:[cam.lon,cam.lat],k:cam.k,s:scope,l:railOrder.map(id=>target[id]>0?1:0).join(''),e:era,
  z:zl?{lid:zl,field:lens[zl].field,v:lens[zl].v}:null,
  p:(rec&&rec.pin)?rec.pin.slice():(keepPin||null),x:(caption||'').slice(0,600)};
}
function applyStop(st,ms,done){
 if(st.s!==scope)switchScope(st.s);
 for(let i=0;i<railOrder.length;i++)target[railOrder[i]]=(st.l&&st.l[i]==='1'&&scopeHas(railOrder[i]))?1:0;
 era=st.e;
 for(const id in lens)delete lens[id];
 if(st.z&&byId[st.z.lid]&&byId[st.z.lid].filters){
  const fl=byId[st.z.lid].filters.find(f=>f.field===st.z.field);
  const val=fl&&fl.values.find(v=>v[0]===st.z.v);
  if(fl&&val)lens[st.z.lid]={field:fl.field,v:val[0],label:val[1],constellation:!!fl.constellation};
 }
 chipRefresh();updateStatline();eraRefresh();scheduleQt();terrainDirty=true;dirty=true;
 bakeGlow(true);
 flyToCam(st.c[0],st.c[1],st.k,ms,done);
}
// ---- the recorder ----
function startRecording(seed){
 if(reading!==null||tourIdx!==null)endReading();
 if(plateOpen)closePlate();
 unpinTip();
 $('#readingsMenu').classList.remove('open');
 rec={title:seed?('Re: '+(seed.t||'a citizen reading')).slice(0,120):'',stops:seed?seed.s.map(s=>Object.assign({},s)):[],pin:null,cur:-1,draft:''};
 recRender();
 $('#recCard').classList.add('open');
 toast(seed?'Counter-reading: the stops are yours to keep, cut, or answer.':'Composing. Frame a view, write a line, capture it. Click the map to set a benchmark.',5200);
}
function stopRecording(){rec=null;$('#recCard').classList.remove('open');dirty=true;}
function recRender(){
 if(!rec)return;
 const c=$('#recCard');
 const prev=$('#recCap');if(prev)rec.draft=prev.value;
 const editing=rec.cur>=0;
 const chips=rec.stops.map((s,i)=>'<span class="rc-stop'+(i===rec.cur?' cur':'')+'" data-i="'+i+'" title="'+esc(s.x||'(no caption)')+'">'+(i+1)+(s.p?' ▲':'')+'<button class="rc-x" data-del="'+i+'" aria-label="Remove stop '+(i+1)+'">✕</button></span>').join('');
 c.innerHTML='<div class="rc-head"><span class="rc-dot"></span><span class="rc-k">COMPOSING A CITIZEN READING · '+(editing?'EDITING STOP '+(rec.cur+1):'STOP '+(rec.stops.length+1))+(rec.pin?' · BENCHMARK SET ▲':'')+'</span><button class="cc-btn rc-discard" id="recDiscard">✕ DISCARD</button></div>'+
  '<input id="recTitle" class="rc-title" maxlength="120" placeholder="Name this reading" value="'+esc(rec.title)+'">'+
  '<textarea id="recCap" class="rc-cap" maxlength="600" rows="2" placeholder="What should the reader see here? Frame the view — layers, era, lens, zoom — then capture.">'+esc(rec.draft)+'</textarea>'+
  '<div class="rc-row"><div class="rc-stops">'+(chips||'<span class="rc-empty">no stops yet · a reading needs at least one</span>')+'</div>'+
  '<span class="cc-nav"><button class="cc-btn" id="recPin" title="A benchmark marks one exact spot for the reader">'+(rec.pin?'▲ CLEAR BENCHMARK':'▲ BENCHMARK · CLICK THE MAP')+'</button>'+
  (editing?'<button class="cc-btn" id="recNew">+ NEW STOP INSTEAD</button>':'')+
  '<button class="cc-btn rc-cap-btn" id="recCapture">'+(editing?'⊕ UPDATE STOP '+(rec.cur+1):'⊕ CAPTURE THIS VIEW')+'</button>'+
  '<button class="cc-btn rc-finish" id="recFinish"'+(rec.stops.length?'':' disabled')+'>▣ FINISH &amp; SHARE</button></span></div>';
 $('#recTitle').addEventListener('input',ev=>{rec.title=ev.target.value;});
 $('#recDiscard').addEventListener('click',()=>{if(rec.stops.length&&!window.confirm('Discard this reading and its '+rec.stops.length+' stop'+(rec.stops.length>1?'s':'')+'?'))return;stopRecording();toast('Discarded.');});
 $('#recPin').addEventListener('click',()=>{if(rec.pin){rec.pin=null;recRender();dirty=true;}else toast('Click anywhere on the map to set the benchmark.');});
 const nb=$('#recNew');if(nb)nb.addEventListener('click',()=>{rec.cur=-1;rec.draft='';recRender();});
 $('#recCapture').addEventListener('click',()=>{
  const cap=$('#recCap').value.trim();
  if(rec.cur>=0){const old=rec.stops[rec.cur];rec.stops[rec.cur]=captureStop(cap,old.p);toast('Stop '+(rec.cur+1)+' updated.');}
  else{rec.stops.push(captureStop(cap,null));toast('Stop '+rec.stops.length+' captured.');}
  rec.pin=null;rec.cur=-1;rec.draft='';
  const ta=$('#recCap');if(ta)ta.value='';
  recRender();dirty=true;
 });
 $('#recFinish').addEventListener('click',recFinish);
 c.querySelectorAll('.rc-x').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();rec.stops.splice(parseInt(b.dataset.del,10),1);rec.cur=-1;recRender();dirty=true;}));
 c.querySelectorAll('.rc-stop').forEach(s=>s.addEventListener('click',()=>{
  const i=parseInt(s.dataset.i,10);rec.cur=i;rec.draft=rec.stops[i].x||'';rec.pin=null;
  const ta=$('#recCap');if(ta)ta.value=rec.draft;
  applyStop(rec.stops[i],1400);recRender();
 }));
}
function recFinish(){
 if(!rec||!rec.stops.length)return;
 const tr={v:1,t:(rec.title||'').trim().slice(0,120)||'A citizen reading',s:rec.stops.map(s=>Object.assign({},s))};
 const enc=encodeTour(tr);
 tour=tr;tourParam=enc;tourIdx=null;
 stopRecording();
 buildReadingsMenu();
 try{history.replaceState(null,'',currentHash());}catch(e){}
 openShare(location.href.split('#')[0]+currentHash(),tr);
}
// ---- the share card (the embed kit) ----
function openShare(url,tr){
 const sc=$('#shareCard');
 const embed='<iframe src="'+url+'" width="100%" height="720" style="border:0;background:#070a10" loading="lazy" title="THE SOUL SURVEY'+(tr?' — '+tr.t.replace(/"/g,'\''):'')+'"></iframe>';
 sc.innerHTML='<div id="shareInner"><button class="pl-x" id="shareClose">✕ ESC</button>'+
  '<div class="pl-over">'+(tr?'A CITIZEN READING · '+tr.s.length+' STOP'+(tr.s.length>1?'S':''):'THIS EXACT VIEW')+' — SHARE</div>'+
  '<div class="ab-title" style="font-size:24px">'+(tr?esc(tr.t):'Link to exactly this')+'</div>'+
  '<div class="ab-body" style="font-size:13px">No server, no account. '+(tr?'The whole reading — every stop, caption, and benchmark — lives inside this link.':'The sheet, camera, layers, era, and lens live inside this link; it opens on the same place on any screen.')+' Anyone who opens it can answer with a counter-reading.</div>'+
  '<input class="sh-url" id="shareUrl" readonly value="'+esc(url)+'" aria-label="Share link">'+
  '<div class="do-actions" style="justify-content:flex-start"><button class="cc-btn" id="shareCopy">⧉ COPY LINK</button><button class="cc-btn" id="shareEmbed">⧉ COPY EMBED</button><a class="cc-btn" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">↗ OPEN IN ITS OWN TAB</a></div>'+
  '<div class="pl-h" style="color:var(--gold)">EMBED</div><textarea class="sh-embed" id="shareEmbedText" readonly rows="3" aria-label="Embed snippet">'+esc(embed)+'</textarea>'+
  '<div class="pl-cav"><b>ATTRIBUTION</b> — an embed carries the survey\'s own masthead, sources, and licenses; keep them visible. '+(url.length>1800?'This link is long ('+fmtInt(url.length)+' characters) — fine for browsers and most chat apps; shorten captions if a platform truncates it.':'')+'</div></div>';
 sc.classList.add('open');
 const copy=(txt,msg)=>{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast(msg),()=>toast('Select the text to copy it.'));else toast('Select the text to copy it.');};
 $('#shareClose').addEventListener('click',()=>sc.classList.remove('open'));
 $('#shareCopy').addEventListener('click',()=>copy(url,'Link copied.'));
 $('#shareEmbed').addEventListener('click',()=>copy(embed,'Embed snippet copied.'));
 $('#shareUrl').addEventListener('focus',ev=>ev.target.select());
 $('#shareEmbedText').addEventListener('focus',ev=>ev.target.select());
}
// ---- playback ----
function startTour(i){
 if(!tour||!tour.s[i])return;
 clearOrient();
 if(plateOpen)closePlate();
 if(rec)stopRecording();
 $('#readingsMenu').classList.remove('open');
 if(reading===null&&tourIdx===null&&!findingOpen)readingSaved={scope:scope,targets:{...target},t:{k:t.k,x:t.x,y:t.y},era:era};
 reading=null;findingOpen=null;setCompare(null);
 tourIdx=i;
 unpinTip();
 applyStop(tour.s[i],2400);
 showCap(tourCap(i));
 wireCapNav();
 const fk=$('#ccFork');if(fk)fk.addEventListener('click',()=>{const seed=tour;endReading();startRecording(seed);});
 writeHash();
}
function tourCap(i){
 const st=tour.s[i],n=tour.s.length;
 const body=st.x?esc(st.x).replace(/\n/g,'<br>'):'<i style="opacity:.6">no caption for this stop</i>';
 return '<div class="cc-k" style="color:#e8b34b">A CITIZEN READING · STOP '+(i+1)+' OF '+n+(st.p?' · ▲ BENCHMARK':'')+'</div>'+
  '<div class="cc-t">'+esc(tour.t)+'</div><div class="cc-x">'+body+'</div>'+
  '<div class="cc-row"><span class="cc-step">RECORDED BY A READER · NOT THE SURVEY\'S CANON</span>'+
  '<span class="cc-nav"><button class="cc-btn" id="ccPrev">◀ PREV</button><button class="cc-btn" id="ccNext">NEXT ▶</button><button class="cc-btn" id="ccFork" title="Load these stops into the recorder and answer">✎ COUNTER-READING</button><button class="cc-btn" id="ccEnd">✕ END</button></span></div>';
}
// ---------- v0.6: THE PLUNGE ----------
let plungeN=0;
function plunge(){
 const E=buildIndex(),pools={};
 for(const e of E){if(!e.lid||(e.type!=='pt'&&e.type!=='star'))continue;(pools[e.lid]=pools[e.lid]||[]).push(e);}
 const keys=Object.keys(pools);if(!keys.length)return;
 const lid=keys[Math.floor(Math.random()*keys.length)];
 let arr=pools[lid];
 if(lid==='memory-births')arr=arr.slice().sort((a,b)=>b.pop-a.pop).slice(0,250);
 if(lid==='power-fortune500')arr=arr.slice().sort((a,b)=>b.pop-a.pop).slice(0,80);
 if(lid==='power-datacenters')arr=arr.filter(e=>!/^(unnamed|data center)$/i.test(e.label));
 const e=arr[Math.floor(Math.random()*arr.length)];if(!e)return;
 plungeN++;
 if(reading!==null||tourIdx!==null||findingOpen)endReading();
 if(plateOpen)closePlate();
 $('#readingsMenu').classList.remove('open');$('#findingsMenu').classList.remove('open');
 selectEntry(e);
 toast('PLUNGE № '+plungeN+' — '+byId[lid].title.toUpperCase()+' · press ? again',3800);
}
// ---------- v0.6: lenses that step through time ----------
function refreshLensChips(lid){
 const L=lens[lid];
 document.querySelectorAll('.lz-chip[data-lid="'+lid+'"]').forEach(b=>{
  if(b.classList.contains('lz-play'))return;
  const on=b.dataset.clear?(!L||L.field!==b.dataset.field):(!!L&&L.field===b.dataset.field&&L.v===parseInt(b.dataset.v,10));
  b.classList.toggle('on',on);
 });
}
function applyLens(lid){bakeLayer(lid,true);scheduleQt();updateStatline();refreshLensChips(lid);writeHash();dirty=true;}
function stopLensPlay(){
 if(!lensPlay)return;
 clearInterval(lensPlay.timer);
 const b=document.querySelector('.lz-play[data-lid="'+lensPlay.lid+'"][data-field="'+lensPlay.field+'"]');if(b)b.textContent='▶';
 lensPlay=null;
}
function toggleLensPlay(lid,field){
 if(lensPlay&&lensPlay.lid===lid&&lensPlay.field===field){stopLensPlay();return;}
 stopLensPlay();
 const fl=(byId[lid].filters||[]).find(f=>f.field===field);if(!fl)return;
 const b=document.querySelector('.lz-play[data-lid="'+lid+'"][data-field="'+field+'"]');if(b)b.textContent='■';
 let idx=-1;
 const step=()=>{
  idx++;
  if(idx>=fl.values.length){delete lens[lid];applyLens(lid);stopLensPlay();toast(fl.label+' — the whole span, restored.');return;}
  const v=fl.values[idx];
  lens[lid]={field,v:v[0],label:v[1],constellation:!!fl.constellation};
  applyLens(lid);
 };
 lensPlay={lid,field,timer:setInterval(step,1150)};
 step();
}

// ======================================================================
// ---------- v0.6: THE PRINT ATLAS — the survey as a physical object ----------
// Composed in the page from the live engine, one solo render per layer, then handed
// to the browser's print dialog (which saves to PDF). No network, no server.
// ======================================================================
function renderSnapshot(sc,ids){
 // put the engine into a still pose and photograph the map area of the four canvases
 if(sc!==scope){scope=sc;buildScope(sc);}
 t=d3.zoomIdentity;era=-1;
 for(const k in lens)delete lens[k];
 for(const l of live){const on=ids.indexOf(l.id)>=0&&l.scopes.includes(sc)?1:0;target[l.id]=on;alpha[l.id]=on;}
 hoverPt=null;terrainDirty=true;
 for(const lid of ids){
  if(!byId[lid]||!hasGlow(byId[lid])||!byId[lid].scopes.includes(sc))continue;
  bakeLayer(lid,true);glowBMs[lid].prevT=null;
 }
 drawBase();drawTerrain();drawGlow();drawLabels();
 const C=SC[scope],e=C.ext,pad=14;
 const x0=Math.max(0,e[0][0]-pad),y0=Math.max(0,e[0][1]-pad),x1=Math.min(W,e[1][0]+pad),y1=Math.min(H,e[1][1]+pad);
 const off=document.createElement('canvas');off.width=Math.round((x1-x0)*dpr);off.height=Math.round((y1-y0)*dpr);
 const g=off.getContext('2d');
 g.fillStyle='#070a10';g.fillRect(0,0,off.width,off.height);
 for(const k of ['base','terr','glow','lab'])g.drawImage(cvs[k],x0*dpr,y0*dpr,off.width,off.height,0,0,off.width,off.height);
 return off.toDataURL('image/jpeg',0.9);
}
function atlasPlateHTML(l,img){
 const th=themeById[l.theme];
 const stats=(l.plateStats||[]).map(s=>'<div class="at-stat"><b>'+s.value+'</b><span>'+s.label+'</span></div>').join('');
 const srcs=(l.sources||[]).map(s=>'<div>'+esc(s.name)+(s.url?' — <span class="at-url">'+esc(s.url)+'</span>':'')+'</div>').join('');
 return '<section class="at-page at-plate"><div class="at-plate-map">'+
   (img?'<img src="'+img+'" alt="'+esc(l.title)+' — solo render">':'')+
   '<div class="at-run">PLATE · '+esc(th.name.toUpperCase())+' — '+esc(th.reading.toUpperCase())+'</div></div>'+
  '<div class="at-plate-text">'+
   (l.protocol?'<div class="at-protocol">'+l.protocol+'</div>':'')+
   '<div class="at-kicker" style="color:'+l.accent+'">'+esc(th.name.toUpperCase())+'</div>'+
   '<h2>'+l.title+'</h2><div class="at-unit">'+(l.statline||l.unit)+(l.retrieved?' · surveyed '+String(l.retrieved).slice(0,10):'')+'</div>'+
   (stats?'<div class="at-stats">'+stats+'</div>':'')+
   '<h3>WHAT</h3><p>'+l.essay.what+'</p><h3>HOW</h3><p>'+l.essay.how+'</p><h3>WHY</h3><p>'+l.essay.why+'</p>'+
   (l.caveat?'<div class="at-note"><b>FIELD NOTE</b> — '+l.caveat+'</div>':'')+
   (srcs?'<h3>SOURCES</h3><div class="at-src">'+srcs+'</div>':'')+
  '</div></section>';
}
let atlasBusy=false;
function composeAtlas(){
 if(atlasBusy)return;atlasBusy=true;
 if(rec){toast('Finish or discard the reading you are composing first.');atlasBusy=false;return;}
 if(reading!==null||tourIdx!==null||findingOpen)endReading();
 if(plateOpen)closePlate();
 stopLensPlay();unpinTip();
 const saved={scope,targets:{...target},alpha:{...alpha},t:{k:t.k,x:t.x,y:t.y},era,lens:JSON.parse(JSON.stringify(lens))};
 const today=new Date().toISOString().slice(0,10);
 const pages=[],jobs=[];
 const usIds=CURATED.filter(id=>byId[id]&&byId[id].scopes.includes('us')&&byId[id].status==='live');
 // the sheets mirror the views the live map opens with; every layer still gets its own plate
 const worldIds=CURATED.filter(id=>byId[id]&&byId[id].scopes.includes('world')&&byId[id].status==='live');
 jobs.push(()=>{pages.push({k:'sheet',n:1,title:'The Human Signal — Conterminous United States',ids:usIds,img:renderSnapshot('us',usIds)});});
 jobs.push(()=>{pages.push({k:'sheet',n:2,title:'The Human Signal — The World',ids:worldIds,img:renderSnapshot('world',worldIds)});});
 for(const l of live)jobs.push(()=>{pages.push({k:'plate',l,img:renderSnapshot(l.scopes.includes('us')?'us':'world',[l.id])});});
 let i=0;
 toast('Composing the atlas — '+jobs.length+' renders…',20000);
 const step=()=>{
  try{jobs[i]();}catch(e){err(e);}
  i++;
  if(i<jobs.length){toast('Composing the atlas — render '+(i+1)+' of '+jobs.length+'…',20000);setTimeout(step,30);return;}
  finishAtlas(pages,saved,today);
 };
 setTimeout(step,60);
}
function finishAtlas(pages,saved,today){
 // restore the reader's view exactly
 if(saved.scope!==scope){scope=saved.scope;buildScope(scope);}
 for(const k in saved.targets)target[k]=saved.targets[k];
 for(const k in saved.alpha)alpha[k]=saved.alpha[k];
 era=saved.era;for(const k in lens)delete lens[k];Object.assign(lens,saved.lens);
 $('#scopeUS').classList.toggle('on',scope==='us');$('#scopeWorld').classList.toggle('on',scope==='world');
 resetGlowFades();
 d3.select('#stage').call(zoomB.transform,d3.zoomIdentity.translate(saved.t.x,saved.t.y).scale(saved.t.k));
 chipRefresh();updateStatline();updateDatumDefault();eraRefresh();scheduleQt();terrainDirty=true;dirty=true;bakeGlow(true);
 const M=R.meta,sheets=pages.filter(p=>p.k==='sheet'),plates=pages.filter(p=>p.k==='plate');
 const legend=ids=>ids.map(id=>'<span><i style="background:'+byId[id].accent+'"></i>'+byId[id].title+' — '+(byId[id].statline||byId[id].unit)+'</span>').join('');
 const fnd=R.findings?R.findings.findings.map(f=>'<div class="at-finding'+(f.spurious||f.lesson?' at-control':'')+'"><div class="at-fstat">'+f.stat+'</div><div><div class="at-ft">'+f.title+(f.tag||f.spurious?' <small>'+(f.tag||'SPURIOUS — ON PURPOSE')+'</small>':'')+'</div><div class="at-fs">'+f.statLabel+'</div><p>'+f.body+'</p><div class="at-meth">METHOD — '+f.method+'</div></div></div>').join(''):'';
 const pending=R.layers.filter(l=>l.status!=='live');
 let html='<section class="at-page at-cover"><div class="at-over">'+esc(M.sheet)+' · SURVEYED '+esc(M.surveyed)+'</div>'+
  '<h1>THE <em>SOUL</em> SURVEY</h1><div class="at-tag">'+esc(M.tagline.toUpperCase())+'</div>'+
  '<p class="at-man">'+M.manifesto+'</p>'+
  '<div class="at-contents"><div><b>'+sheets.length+'</b>sheets</div><div><b>'+plates.length+'</b>plates</div><div><b>'+(R.findings?R.findings.findings.length:0)+'</b>findings</div><div><b>'+pending.length+'</b>pending slots</div></div>'+
  '<div class="at-colo">THE PRINT ATLAS · v'+esc(M.version)+' · RENDERED '+today+' · '+esc(M.site)+'</div></section>';
 for(const s of sheets)html+='<section class="at-page at-sheet"><div class="at-run">SHEET '+s.n+' · '+esc(s.title.toUpperCase())+'</div><img src="'+s.img+'" alt="'+esc(s.title)+'"><div class="at-legend">'+legend(s.ids)+'</div></section>';
 for(const p of plates)html+=atlasPlateHTML(p.l,p.img);
 if(fnd)html+='<section class="at-page at-findings"><div class="at-run">FINDINGS · COMPUTED AT BUILD · HAND-REVIEWED</div><h2>Findings</h2><div class="at-disc">'+R.findings.disclaimer+'</div>'+fnd+'</section>';
 html+='<section class="at-page at-colophon"><div class="at-run">COLOPHON</div><h2>Method, sources, and the slots still empty</h2>'+
  '<p>Every layer is a real dataset with coordinates. Density becomes elevation: the relief on each sheet is computed from the layers shown, Gaussian-smoothed, contoured, and hillshaded in the browser that printed this atlas. Point layers render as additive light. Coordinates are quantized to about 110 m and giant datasets are aggregated to cells. Every staging file ships with a provenance sidecar naming its source, retrieval date, method, and caveats.</p>'+
  (pending.length?'<h3>PENDING SLOTS — SHOWN EMPTY RATHER THAN FAKED</h3>'+pending.map(l=>'<p><b>'+l.title+'.</b> '+(l.pendingNote||'Source gated; slot reserved.')+'</p>').join(''):'')+
  '<h3>LICENSES</h3><p>Basemaps: Natural Earth (public domain). Reference places: GeoNames (CC-BY 4.0). Notable people: Laouenan et al., <i>Scientific Data</i> 2022 (CC-BY-SA 4.0). Data centers: © OpenStreetMap contributors (ODbL). Social Capital Atlas: Meta custom permissive license, no re-identification. U.S. Religion Census: facts reproduced with attribution. FARS, GNIS, EPA, CDC, IRS SOI: U.S. public data. Full table: DATA_LICENSES.md in the repository.</p>'+
  '<h3>CITE</h3><p class="at-cite">The Soul Survey (v'+esc(M.version)+', '+esc(M.surveyed.toLowerCase())+'). A topographic survey of the collective soul, conducted in objective data. '+esc(M.site)+' — source: github.com/'+esc(M.repo)+'</p>'+
  '<div class="at-colo">WHERE, NOT WHY.</div></section>';
 let el=$('#atlas');if(!el){el=document.createElement('div');el.id='atlas';document.body.appendChild(el);}
 el.innerHTML=html;
 atlasBusy=false;
 const imgs=[...el.querySelectorAll('img')];
 Promise.all(imgs.map(im=>im.decode?im.decode().catch(()=>{}):Promise.resolve())).then(()=>{
  toast('Atlas ready — '+(pages.length+3)+' pages. Choose “Save as PDF” in the print dialog to keep it.',6000);
  document.dispatchEvent(new CustomEvent('atlas:ready',{detail:{pages:pages.length+3}}));
  if(!window.__ATLAS_NOPRINT__)setTimeout(()=>window.print(),250);
 });
}

// ---------- zoom ----------
const zoomB=d3.zoom().scaleExtent([1,26]).clickDistance(6).on('zoom',ev=>{
 t=ev.transform;dirty=true;needBake=true;zooming=true;
 clearTimeout(zoomEndT);
 zoomEndT=setTimeout(()=>{zooming=false;bakeGlow(true);},170);
}).on('end',()=>{updateScalebar();writeHash();});

// ---------- init ----------
function init(){
 sizeCanvases();
 buildSprites();
 railOrder=buildRail();
 const hp=parseHash();
 if(hp){hashHadState=true;}
 buildScope(scope);
 applyPendingLens();
 buildHero();
 buildAbout();
 buildEraBar();
 buildReadingsMenu();
 buildFindingsMenu();
 $('#mhSheet').textContent=R.meta.sheet+' · '+R.meta.surveyed;
 $('#mhTitle').innerHTML='THE <em>SOUL</em> SURVEY';
 $('#mhTagline').textContent=R.meta.tagline;
 $('#scopeUS').classList.toggle('on',scope==='us');
 $('#scopeWorld').classList.toggle('on',scope==='world');
 $('#scopeUS').addEventListener('click',()=>switchScope('us'));
 $('#scopeWorld').addEventListener('click',()=>switchScope('world'));
 $('#aboutBtn').addEventListener('click',()=>$('#about').classList.add('open'));
 $('#about').addEventListener('click',ev=>{if(ev.target.id==='about')$('#about').classList.remove('open');});
 $('#readingsBtn').addEventListener('click',ev=>{ev.stopPropagation();$('#findingsMenu').classList.remove('open');$('#readingsMenu').classList.toggle('open');});
 $('#findingsBtn').addEventListener('click',ev=>{ev.stopPropagation();$('#readingsMenu').classList.remove('open');$('#findingsMenu').classList.toggle('open');});
 document.addEventListener('click',ev=>{if(!ev.target.closest('.mh-menu-wrap')){$('#readingsMenu').classList.remove('open');$('#findingsMenu').classList.remove('open');}});
 $('#locateBtn').addEventListener('click',locateMe);
 $('#exportBtn').addEventListener('click',exportSheet);
 $('#atlasBtn').addEventListener('click',composeAtlas);
 $('#audioBtn').addEventListener('click',audioToggle);
 $('#indexBtn').addEventListener('click',openIndex);
 $('#shareBtn').addEventListener('click',()=>openShare(location.href.split('#')[0]+currentHash(true),null));
 $('#shareCard').addEventListener('click',ev=>{if(ev.target.id==='shareCard')$('#shareCard').classList.remove('open');});
 $('#indexOverlay').addEventListener('click',ev=>{if(ev.target.id==='indexOverlay')closeIndex();});
 $('#dossier').addEventListener('click',ev=>{if(ev.target.id==='dossier')$('#dossier').classList.remove('open');});
 const idxInp=$('#idxInput');
 idxInp.addEventListener('input',()=>renderIdx(searchIndex(idxInp.value)));
 idxInp.addEventListener('keydown',ev=>{
  if(ev.key==='ArrowDown'){ev.preventDefault();if(idxResults.length){idxSel=(idxSel+1)%idxResults.length;idxHighlight();}}
  else if(ev.key==='ArrowUp'){ev.preventDefault();if(idxResults.length){idxSel=(idxSel-1+idxResults.length)%idxResults.length;idxHighlight();}}
  else if(ev.key==='Enter'){if(idxResults[idxSel])selectEntry(idxResults[idxSel]);}
  else if(ev.key==='Escape'){closeIndex();}
 });
 $('#railToggle').addEventListener('click',()=>$('#rail').classList.toggle('open'));
 const sh=$('#splitHandle');let shDrag=false;
 sh.addEventListener('pointerdown',ev=>{shDrag=true;try{sh.setPointerCapture(ev.pointerId);}catch(e){}});
 sh.addEventListener('pointermove',ev=>{if(!shDrag||!compareMode)return;compareMode.x=Math.max(.12,Math.min(.88,ev.clientX/W));sh.style.left=(compareMode.x*100)+'%';dirty=true;});
 window.addEventListener('pointerup',()=>{shDrag=false;});
 if(hp&&hp.bits){
  for(let i=0;i<railOrder.length&&i<hp.bits.length;i++)target[railOrder[i]]=hp.bits[i]==='1'?1:0;
  for(const l of live){alpha[l.id]=target[l.id];}
 }
 const stage=$('#stage');
 d3.select(stage).call(zoomB).on('dblclick.zoom',null);
 if(pendingHashT)d3.select(stage).call(zoomB.transform,pendingHashT);
 else if(pendingGeo){d3.select(stage).call(zoomB.transform,camFor(pendingGeo.lon,pendingGeo.lat,pendingGeo.k));pendingGeo=null;}
 stage.addEventListener('pointermove',onMove);
 stage.addEventListener('click',onClick);
 stage.addEventListener('pointerdown',()=>{
  if(reading!==null&&R.readings[reading]&&R.readings[reading].special){
   clearOrient();
   endReading();
  }
 });
 stage.addEventListener('pointerleave',()=>{if(!tipPinned){tip.style.display='none';hoverPt=null;dirty=true;}updateDatumDefault();});
 window.addEventListener('keydown',ev=>{
  if(ev.target&&(ev.target.tagName==='INPUT'||ev.target.tagName==='TEXTAREA')){
   if(ev.key==='Escape')closeIndex();
   return;
  }
  if(ev.key==='/'){ev.preventDefault();openIndex();return;}
  if(ev.key==='?'){ev.preventDefault();plunge();return;}
  if(ev.key==='Escape'){
   // the recorder is deliberately NOT closed by ESC: a composed reading is work
   if($('#shareCard').classList.contains('open'))$('#shareCard').classList.remove('open');
   else if($('#indexOverlay').classList.contains('open'))closeIndex();
   else if($('#dossier').classList.contains('open'))$('#dossier').classList.remove('open');
   else if($('#about').classList.contains('open'))$('#about').classList.remove('open');
   else if(tipPinned)unpinTip();
   else if(reading!==null||findingOpen||tourIdx!==null)endReading();
   else if($('#capCard').classList.contains('open'))hideCap();
   else if(plateOpen)closePlate();
   else{$('#hero').classList.add('gone');}
   return;
  }
  let n=parseInt(ev.key,10);
  if(ev.key==='0')n=10;
  if(n>=1&&n<=railOrder.length){toggleLayer(railOrder[n-1]);return;}
  if(ev.key==='u'||ev.key==='U')switchScope('us');
  if(ev.key==='w'||ev.key==='W')switchScope('world');
  if(ev.key==='r'||ev.key==='R'){$('#findingsMenu').classList.remove('open');$('#readingsMenu').classList.toggle('open');}
  if(ev.key==='f'||ev.key==='F'){$('#readingsMenu').classList.remove('open');$('#findingsMenu').classList.toggle('open');}
  const setAll=v=>{for(const l of live)target[l.id]=v&&scopeHas(l.id)?1:0;chipRefresh();updateStatline();eraRefresh();scheduleQt();terrainDirty=true;dirty=true;writeHash();};
  if(ev.key==='e'||ev.key==='E')setAll(1);
  if(ev.key==='n'||ev.key==='N')setAll(0);
  if(ev.key==='g'||ev.key==='G'){refNames=!refNames;refSyncs.forEach(fn=>fn());dirty=true;}
  if(ev.key==='c'||ev.key==='C'){for(const l of live)target[l.id]=CURATED.indexOf(l.id)>=0&&scopeHas(l.id)?1:0;chipRefresh();updateStatline();eraRefresh();scheduleQt();terrainDirty=true;dirty=true;writeHash();}
 });
 if(hashHadState)$('#hero').classList.add('gone');
 let rsT=null;
 window.addEventListener('resize',()=>{
  clearTimeout(rsT);
  rsT=setTimeout(()=>{
   sizeCanvases();
   for(const k in SC)delete SC[k];
   for(const k in glowBMs)delete glowBMs[k];
   hatchPat=null;
   buildScope(scope);
   bakeGlow();rebuildQt();updateScalebar();
   terrainDirty=true;dirty=true;
  },220);
 });
 chipRefresh();updateStatline();updateDatumDefault();eraRefresh();
 bakeGlow();rebuildQt();updateScalebar();
 $('#stage').classList.add('ready');
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{dirty=true;bakeGlow();});
 frame();
 // a citizen reading that arrived in the link plays itself (the hero is skipped)
 if(tour&&hashHadState)setTimeout(()=>startTour(0),700);
}
try{init();}catch(e){err(e);}
})();
