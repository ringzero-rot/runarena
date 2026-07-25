# -*- coding: utf-8 -*-
"""
Copy the web app into the Android project's assets so it can be bundled into the
APK (served offline via WebViewAssetLoader). Re-run after changing the web app,
then rebuild in Android Studio.

    python scripts/sync_android.py
"""
import os, shutil, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'www')

# Runtime web app only (no legacy/, scripts/, supabase/, android/, .git ...).
ITEMS = ['index.html', 'sw.js', 'manifest.webmanifest', 'src', 'assets']

if os.path.exists(WWW):
    shutil.rmtree(WWW)
os.makedirs(WWW)

copied = 0
for it in ITEMS:
    src = os.path.join(ROOT, it)
    dst = os.path.join(WWW, it)
    if os.path.isdir(src):
        shutil.copytree(src, dst)
        copied += sum(len(f) for _, _, f in os.walk(dst))
    elif os.path.isfile(src):
        shutil.copy2(src, dst)
        copied += 1

print('synced %d files -> android/app/src/main/assets/www' % copied)
