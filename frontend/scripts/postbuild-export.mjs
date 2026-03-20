import {existsSync, rmSync} from 'node:fs';
import path from 'node:path';

const blogEnabled = process.env.NEXT_PUBLIC_SHOW_BLOG !== 'false';
const buildDir = path.resolve(process.cwd(), 'build');
const blogDir = path.join(buildDir, 'blog');

if (blogEnabled || !existsSync(blogDir)) {
  process.exit(0);
}

rmSync(blogDir, {recursive: true, force: true});
