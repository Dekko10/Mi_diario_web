
/* Almacenamiento privado de Mi Diario Web */
(() => {
  const DB_NAME = "mi-diario-local";
  const DB_VERSION = 2;
  const STORE_NAME = "diary";
  const HABITS_STORE = "habits";
  const RECORD_KEY = "principal";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }

        if (!db.objectStoreNames.contains(HABITS_STORE)) {
          db.createObjectStore(HABITS_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function load() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);

      request.onsuccess = () => {
        const value = request.result;

        resolve(value && Array.isArray(value.pages)
          ? value
          : { version: 1, pages: [] });
      };

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function save(data) {
    if (!data || !Array.isArray(data.pages)) {
      throw new Error("Formato de diario no válido.");
    }

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

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };

      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function loadHabits() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(HABITS_STORE, "readonly");
      const request = tx.objectStore(HABITS_STORE).get("principal");

      request.onsuccess = () => {
        resolve(Array.isArray(request.result) ? request.result : []);
      };

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function saveHabits(habits) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(HABITS_STORE, "readwrite");
      tx.objectStore(HABITS_STORE).put(habits, "principal");

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };

      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function exportFile(data) {
    const habits = await loadHabits();

    const backup = {
      version: 2,
      pages: data.pages || [],
      habits
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `mi-diario-${new Date().toISOString().slice(0, 10)}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function importFile(file) {
    if (!file) throw new Error("No seleccionaste ningún archivo.");

    const parsed = JSON.parse(await file.text());

    if (!parsed || !Array.isArray(parsed.pages)) {
      throw new Error("El archivo no contiene páginas válidas.");
    }

    return {
      version: 2,
      pages: parsed.pages,
      habits: Array.isArray(parsed.habits) ? parsed.habits : []
    };
  }

  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(error => console.warn("Error al activar modo sin conexión:", error));
    });
  }

  window.diaryAPI = {
    load,
    save,
    loadHabits,
    saveHabits,
    exportFile,
    importFile
  };
})();


  window.diaryAPI = { load, save, exportFile, importFile };
})();
