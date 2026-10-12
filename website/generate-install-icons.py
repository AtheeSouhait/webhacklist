#!/usr/bin/env python3
"""Reproduce PNGs using selected read-only inputs and bounded offline Docker.

No host browser, package install, download or writable output mount. --check
verifies the published assets without changing them. Image must already exist.
"""
import argparse, base64, hashlib, json, struct, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools/references"))
from refslib import toolbox

def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--check",action="store_true"); args=parser.parse_args()
    website=ROOT/"website"
    selected={"install-192.png":192,"install-512.png":512,"install-maskable-512.png":512,"apple-touch-icon.png":180}
    purposes={"install-192.png":"any","install-512.png":"any","install-maskable-512.png":"maskable","apple-touch-icon.png":"apple"}
    command=["docker","run",*toolbox.run_args()]
    for flag,value in (("--network","none"),("--memory","1g"),("--pids-limit","512"),("--tmpfs","/tmp:rw,noexec,nosuid,size=128m")):
        command[command.index(flag)+1]=value
    for name in ("brand-mark.svg","install-icons.mjs"):
        command += ["-v",str(website/name)+":/inputs/"+name+":ro"]
    command += ["webseclist-browser-tests:cross-browser-1.55.0","node","/inputs/install-icons.mjs"]
    result=toolbox._run_container(command,timeout=90,output_limit=1024*1024)
    if result.returncode: sys.stderr.buffer.write(result.stderr); return result.returncode
    rows=[json.loads(line) for line in result.stdout.splitlines()]
    if len(rows)!=5 or rows[0].get("kind")!="provenance": raise RuntimeError("Unexpected icon envelope")
    source_hash=hashlib.sha256((website/"brand-mark.svg").read_bytes()).hexdigest()
    if rows[0].get("source_sha256")!=source_hash: raise RuntimeError("SVG source hash mismatch")
    metadata={**rows[0],"generator_sha256":hashlib.sha256((website/"install-icons.mjs").read_bytes()).hexdigest(),"icons":[]}; metadata.pop("kind")
    accepted={}
    for row in rows[1:]:
        name=row.get("name")
        if row.get("kind")!="icon" or name not in selected or name in accepted: raise RuntimeError("Unexpected fixed icon name")
        size=selected[name]; data=base64.b64decode(row["data"],validate=True)
        if not data.startswith(b"\x89PNG\r\n\x1a\n") or data[12:16]!=b"IHDR" or not 100<len(data)<128*1024 or struct.unpack(">II",data[16:24])!=(size,size): raise RuntimeError("Invalid PNG envelope")
        if row["width"]!=size or row["height"]!=size or row["bytes"]!=len(data) or row["sha256"]!=hashlib.sha256(data).hexdigest() or row["transparent"]!=0 or not size*size*.03<row["painted"]<size*size*.3: raise RuntimeError("Invalid rendered-content report")
        if row["purpose"]!=purposes[name]: raise RuntimeError("Unexpected icon purpose")
        if purposes[name]=="maskable" and row["outsideSafe"]!=0: raise RuntimeError("Unsafe maskable artwork")
        accepted[name]=data; metadata["icons"].append({k:v for k,v in row.items() if k not in ("kind","data")})
    if set(accepted)!=set(selected): raise RuntimeError("Incomplete fixed icon set")
    accepted["install-icons.json"]=(json.dumps(metadata,indent=2)+"\n").encode()
    for name,data in accepted.items():
        destination=website/name
        if destination.is_symlink(): raise RuntimeError("Refusing symlink output")
        if args.check:
            if not destination.is_file() or destination.read_bytes()!=data: raise RuntimeError("Stale asset: "+name)
        else:
            temporary=destination.with_suffix(destination.suffix+".tmp")
            if temporary.is_symlink(): raise RuntimeError("Refusing symlink temporary output")
            temporary.write_bytes(data); temporary.replace(destination)
        print(("Verified " if args.check else "Generated ")+name+": "+str(len(data))+" bytes; sha256 "+hashlib.sha256(data).hexdigest())
    return 0
if __name__=="__main__": sys.exit(main())
