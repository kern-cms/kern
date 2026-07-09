export class ArgError extends Error {}

export function parseArgs(argv) {
  const result = { help: false, version: false, force: false, noInit: false, targetDir: null };
  for (const arg of argv) {
    switch (arg) {
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      case "--force":
        result.force = true;
        break;
      case "--no-init":
        result.noInit = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new ArgError(`Onbekende optie: "${arg}"`);
        }
        if (result.targetDir !== null) {
          throw new ArgError(`Meerdere doelmappen opgegeven: "${result.targetDir}" en "${arg}".`);
        }
        result.targetDir = arg;
    }
  }
  return result;
}
