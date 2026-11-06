/* Almacenamiento privado de Mi Diario Web: todo permanece en este navegador. */
(() => {
  const DB_NAME = "mi-diario-local";
  const DB_VERSION = 1;
  const STORE_NAME = "diary";
  const RECORD_KEY = "principal";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
    });
  }

  async function load() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => {
        const value = request.result;
        resolve(value && Array.isArray(value.pages) && value.pages.length
          ? value
          : { version: 1, pages: [{ id: "pagina-1", date: new Date().toISOString(), title: "", content: "" }] });
      };
      request.onerror = () => reject(request.error || new Error("No se pudo leer el diario."));
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function save(data) {
    if (!data || !Array.isArray(data.pages)) throw new Error("Formato de diario no válido.");
    const safeData = {
      version: 1,
      pages: data.pages.map((page, index) => ({
        id: String(page.id || `pagina-${index + 1}`),
        date: String(page.date || new Date().toISOString()),
        title: String(page.title || ""),
        content: String(page.content || "")
      }))
    };
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(safeData, RECORD_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { const error = tx.error; db.close(); reject(error || new Error("No se pudo guardar el diario.")); };
      tx.onabort = () => { const error = tx.error; db.close(); reject(error || new Error("Se canceló el guardado.")); };
    });
  }

  async function exportFile(data) {
    const blob = new Blob([JSON.stringify({ version: 1, pages: data.pages }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mi-diario-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function importFile(file) {
    if (!file) throw new Error("No seleccionaste ningún archivo.");
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      throw new Error("El archivo no contiene páginas válidas de Mi Diario.");
    }
    return {
      version: 1,
      pages: parsed.pages.map((page, index) => ({
        id: String(page.id || `pagina-${index + 1}`),
        date: String(page.date || new Date().toISOString()),
        title: String(page.title || ""),
        content: String(page.content || "")
      }))
    };
  }

  // Pedir al navegador que conserve el almacenamiento cuando sea posible.
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  // Registrar la caché offline de la PWA desde un archivo permitido por CSP.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("No se pudo activar el modo sin conexión:", error));
    });
  }

  window.diaryAPI = { load, save, exportFile, importFile };
})();
