import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const file = process.argv[2];
if (!file) throw new Error('no arguments');

const workspaceRootDir = path.dirname(fileURLToPath(import.meta.url)) + '/src';
const relativePath = file.substring(workspaceRootDir.length + 1);
const relativePathJs = relativePath.replace(/\.ts$/, '.js');

execSync(`node node_modules\\@swc\\cli\\bin\\swc.js ${file} -o dist/${relativePathJs} -s`);
