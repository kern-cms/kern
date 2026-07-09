#!/usr/bin/env node
import { run } from "../src/cli.js";

run()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    process.stderr.write(`Onverwachte fout: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
