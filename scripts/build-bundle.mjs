#!/usr/bin/env node
// Build a ZIP of every doc, written to public/playbook-bundle.zip.
// Run as: pnpm build:bundle (called by Vercel build via "build" script chain if wired).
//
// Pure Node 22 ESM; uses native zlib. No external deps.

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { existsSync, statSync } from "node:fs";
import { deflateRawSync, crc32 } from "node:zlib";

const ROOT = process.cwd();
const CONTENT = join(ROOT, "content", "docs");
const SCRIPTS = join(ROOT, "content", "docs", "scripts");
const OUT_DIR = join(ROOT, "public");
const OUT = join(OUT_DIR, "playbook-bundle.zip");
const ROOT_FILES = ["README.md", "CONTRIBUTING.md", "LICENSE"];

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

async function collect() {
  const files = [];
  if (existsSync(CONTENT)) {
    for await (const f of walk(CONTENT)) {
      files.push({
        absPath: f,
        zipPath: join("playbook", relative(ROOT, f)),
      });
    }
  }
  for (const name of ROOT_FILES) {
    const p = join(ROOT, name);
    if (existsSync(p)) {
      files.push({ absPath: p, zipPath: join("playbook", name) });
    }
  }
  return files;
}

// ---- Minimal ZIP writer (PKZIP local + central, store/deflate, no dependency) ----

function localHeader({ fileName, crc, compressedSize, uncompressedSize, method }) {
  const nameBuf = Buffer.from(fileName, "utf8");
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);   // signature
  h.writeUInt16LE(20, 4);            // version needed
  h.writeUInt16LE(0x0800, 6);        // flags (UTF-8 file name)
  h.writeUInt16LE(method, 8);        // 0 = store, 8 = deflate
  h.writeUInt16LE(0, 10);            // mod time
  h.writeUInt16LE(0, 12);            // mod date
  h.writeUInt32LE(crc, 14);          // crc-32
  h.writeUInt32LE(compressedSize, 18);
  h.writeUInt32LE(uncompressedSize, 22);
  h.writeUInt16LE(nameBuf.length, 26);
  h.writeUInt16LE(0, 28);
  return Buffer.concat([h, nameBuf]);
}

function centralHeader({ fileName, crc, compressedSize, uncompressedSize, method, offset }) {
  const nameBuf = Buffer.from(fileName, "utf8");
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4);            // version made by
  h.writeUInt16LE(20, 6);            // version needed
  h.writeUInt16LE(0x0800, 8);        // flags
  h.writeUInt16LE(method, 10);
  h.writeUInt16LE(0, 12);
  h.writeUInt16LE(0, 14);
  h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(compressedSize, 20);
  h.writeUInt32LE(uncompressedSize, 24);
  h.writeUInt16LE(nameBuf.length, 28);
  h.writeUInt16LE(0, 30);
  h.writeUInt16LE(0, 32);
  h.writeUInt16LE(0, 34);
  h.writeUInt16LE(0, 36);
  h.writeUInt32LE(0, 38);            // external attrs
  h.writeUInt32LE(offset, 42);
  return Buffer.concat([h, nameBuf]);
}

function endOfCentral({ count, centralSize, centralOffset }) {
  const h = Buffer.alloc(22);
  h.writeUInt32LE(0x06054b50, 0);
  h.writeUInt16LE(0, 4);
  h.writeUInt16LE(0, 6);
  h.writeUInt16LE(count, 8);
  h.writeUInt16LE(count, 10);
  h.writeUInt32LE(centralSize, 12);
  h.writeUInt32LE(centralOffset, 16);
  h.writeUInt16LE(0, 20);
  return h;
}

async function build() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  const files = await collect();
  files.sort((a, b) => a.zipPath.localeCompare(b.zipPath));

  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const data = await readFile(f.absPath);
    const compressed = deflateRawSync(data);
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const local = localHeader({
      fileName: f.zipPath,
      crc,
      compressedSize: payload.length,
      uncompressedSize: data.length,
      method,
    });
    parts.push(local, payload);
    central.push(
      centralHeader({
        fileName: f.zipPath,
        crc,
        compressedSize: payload.length,
        uncompressedSize: data.length,
        method,
        offset,
      }),
    );
    offset += local.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = endOfCentral({
    count: files.length,
    centralSize: centralBuf.length,
    centralOffset: offset,
  });

  const zip = Buffer.concat([...parts, centralBuf, eocd]);
  await writeFile(OUT, zip);

  const bytes = zip.length;
  console.log(`playbook-bundle.zip: ${files.length} files, ${(bytes / 1024).toFixed(1)} KB → ${relative(ROOT, OUT)}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
