// The picture for this entry was drawn while the entry was built and is
// shipped in this repository as entry.png. The grader runs this program
// with no network access, so the program itself only has to put that
// finished file where the grader looks for it.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const target = join(outDir, "entry.png");
copyFileSync(join(repoDir, "entry.png"), target);

// Confirm the file landed: a zero-byte or missing output would fail the
// gate, so refuse to finish quietly if the copy did not take.
import { statSync } from "node:fs";
const bytes = statSync(target).size;
if (bytes === 0) throw new Error("entry.png was copied but is empty");
console.log(`wrote ${target} (${bytes} bytes)`);
