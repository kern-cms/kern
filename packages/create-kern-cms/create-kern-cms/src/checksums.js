// Parses the `<sha256>  <filename>` format `bun run release:checksums` writes (which is also
// what plain `sha256sum` produces and `sha256sum -c` consumes — see
// packages/server/src/scripts/generate-checksums.ts).
export function parseChecksums(text) {
  const checksums = new Map();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    // sha256sum optionally prefixes the filename with "*" for binary mode; tolerate that plus
    // any run of whitespace between the hash and the filename.
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (!match) {
      continue;
    }
    checksums.set(match[2], match[1].toLowerCase());
  }
  return checksums;
}

export class ChecksumMismatchError extends Error {
  constructor(fileName, expected, actual) {
    super(
      `Checksum-mismatch voor ${fileName}: verwacht ${expected}, gekregen ${actual}. De download is verwijderd — dit kan een corrupte download of een gemanipuleerd bestand betekenen.`,
    );
    this.name = "ChecksumMismatchError";
    this.fileName = fileName;
    this.expected = expected;
    this.actual = actual;
  }
}

export function verifyChecksum(fileName, actualSha256, checksums) {
  const expected = checksums.get(fileName);
  if (!expected) {
    throw new Error(`Geen checksum gevonden voor "${fileName}" in checksums.txt.`);
  }
  if (expected !== actualSha256.toLowerCase()) {
    throw new ChecksumMismatchError(fileName, expected, actualSha256);
  }
}
