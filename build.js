// GitHub'da fayllar papkasiz turadi. Deploy paytida sayt uchun kerakli papkalarni "dist" ichida yig'amiz.
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FILES = {
  'student-index.html': 'index.html',
  'login.html': 'login.html',
  'lesson.html': 'lesson.html',
  'admin.html': 'admin/index.html',
  'app.css': 'css/app.css',
  'admin.css': 'css/admin.css',
  'common.js': 'js/common.js',
  'lesson.js': 'js/lesson.js',
  'admin.js': 'js/admin.js',
};

rmSync('dist', { recursive: true, force: true });
for (const [from, to] of Object.entries(FILES)) {
  const target = join('dist', to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
}
console.log(`dist tayyor: ${Object.keys(FILES).length} ta fayl`);
