// First-party raster generator; run only in the approved offline browser image.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
export const iconSpecs = [
  {name:"install-192.png",size:192,scale:.78,purpose:"any"},
  {name:"install-512.png",size:512,scale:.78,purpose:"any"},
  // The entire SVG square fits the central 80%-diameter safe circle.
  {name:"install-maskable-512.png",size:512,scale:.56,purpose:"maskable"},
  {name:"apple-touch-icon.png",size:180,scale:.78,purpose:"apple"}
];
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export async function renderIcon(page, svg, spec) {
  const result = await page.evaluate(async ({svg,size,scale}) => {
    const image=new Image(); image.src="data:image/svg+xml;base64,"+btoa(svg); await image.decode();
    const canvas=document.createElement("canvas"); canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.fillStyle="#0c0e15"; ctx.fillRect(0,0,size,size);
    const inset=size*(1-scale)/2; ctx.drawImage(image,inset,inset,size*scale,size*scale);
    const pixels=ctx.getImageData(0,0,size,size).data;
    let painted=0,transparent=0,outsideSafe=0;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const i=(y*size+x)*4;
      if(pixels[i+3]!==255) transparent++;
      if(pixels[i]!==12 || pixels[i+1]!==14 || pixels[i+2]!==21) {
        painted++;
        if(Math.hypot(x+.5-size/2,y+.5-size/2)>size*.4) outsideSafe++;
      }
    }
    return {data:canvas.toDataURL("image/png").split(",")[1],painted,transparent,outsideSafe};
  },{svg,...spec});
  const bytes=Buffer.from(result.data,"base64");
  assert.ok(bytes.length<128*1024 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  assert.equal(bytes.readUInt32BE(16),spec.size); assert.equal(bytes.readUInt32BE(20),spec.size);
  assert.ok(result.painted>spec.size*spec.size*.03 && result.painted<spec.size*spec.size*.3,"visible brand content");
  assert.equal(result.transparent,0,"opaque launcher background");
  if(spec.purpose==="maskable") assert.equal(result.outsideSafe,0,"maskable safe circle");
  return {name:spec.name,width:spec.size,height:spec.size,purpose:spec.purpose,bytes:bytes.length,sha256:sha256(bytes),painted:result.painted,transparent:result.transparent,outsideSafe:result.outsideSafe,data:result.data};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {chromium}=await import("/opt/browser-tests/node_modules/playwright/index.mjs");
  const info=JSON.parse(await readFile("/opt/browser-tests/node_modules/playwright/package.json","utf8")); assert.equal(info.version,"1.55.0");
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage(), svg=await readFile("/inputs/brand-mark.svg","utf8");
    console.log(JSON.stringify({kind:"provenance",source_sha256:sha256(svg),renderer:"Chromium "+browser.version(),playwright:info.version}));
    for(const spec of iconSpecs) {
      const first=await renderIcon(page,svg,spec), second=await renderIcon(page,svg,spec);
      assert.equal(first.data,second.data,"repeat render is byte-identical");
      console.log(JSON.stringify({kind:"icon",...first}));
    }
  } finally {await browser.close();}
}
