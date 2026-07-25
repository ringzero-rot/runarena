# Keep JS-facing WebView members if any @JavascriptInterface is added later.
-keepattributes JavascriptInterface
-keep class com.runarena.app.** { *; }
