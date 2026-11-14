/**
 * Lazy-loaded external libraries for QMC Music Media Archive.
 * Avoids blocking initial page load with heavy scanner / spreadsheet bundles
 * until the user actually opens Barcode Scanner or Excel Import/Export.
 */
(function (global) {
  const _scriptPromises = new Map();

  function loadExternalScriptOnce(src, globalCheckFn) {
    if (typeof globalCheckFn === 'function' && globalCheckFn()) {
      return Promise.resolve();
    }
    if (_scriptPromises.has(src)) {
      return _scriptPromises.get(src);
    }
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (typeof globalCheckFn === 'function' && globalCheckFn()) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => {
          _scriptPromises.delete(src);
          reject(new Error(`Failed to load script: ${src}`));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        _scriptPromises.delete(src);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
    _scriptPromises.set(src, promise);
    return promise;
  }

  global.ensureHtml5QrcodeLoaded = function ensureHtml5QrcodeLoaded() {
    return loadExternalScriptOnce(
      'https://unpkg.com/html5-qrcode',
      () => typeof global.Html5Qrcode !== 'undefined'
    );
  };

  global.ensureXlsxLoaded = function ensureXlsxLoaded() {
    return loadExternalScriptOnce(
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      () => typeof global.XLSX !== 'undefined'
    );
  };
})(typeof window !== 'undefined' ? window : globalThis);

