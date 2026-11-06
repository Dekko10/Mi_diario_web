const pageList = document.getElementById("pageList");
const pageTitle = document.getElementById("pageTitle");
const pageContent = document.getElementById("pageContent");
const pageDate = document.getElementById("pageDate");
const pageCounter = document.getElementById("pageCounter");
const topPageNumber = document.getElementById("topPageNumber");
const wordCount = document.getElementById("wordCount");
const saveIndicator = document.getElementById("saveIndicator");
const saveStatus = document.getElementById("saveStatus");
const prevButton = document.getElementById("prevPage");
const nextButton = document.getElementById("nextPage");
const tagFilter = document.getElementById("tagFilter");
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearch");
const searchSummary = document.getElementById("searchSummary");
const habitsList = document.getElementById("habitsList");
const habitForm = document.getElementById("habitForm");
const habitName = document.getElementById("habitName");
const habitDuration = document.getElementById("habitDuration");

let habits = [];

const TAGS = {
  YO: "yo", OBS: "obs", IDEA: "idea", CONSEJO: "consejo", ANALISI: "analisi",
  ACCION: "accion", PREGUNTA: "pregunta", PLAN: "plan", DESCU: "descu"
};

let diary = { version: 1, pages: [] };
let currentIndex = 0;
let saveTimer = null;
let saveQueue = Promise.resolve();
let draggedPageId = null;
let pendingHighlight = "";

function makePage() {
  return {
    id: `pagina-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    date: new Date().toISOString(),
    title: "",
    content: ""
  };
}

// =========================
// SISTEMA DE HÁBITOS
// =========================

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function habitDate(startDate, offset) {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return localDateString(date);
}

async function persistHabits() {
  try {
    await window.diaryAPI.saveHabits(habits);
  } catch (error) {
    console.error("Error guardando hábitos:", error);
    alert("No se pudieron guardar los hábitos.");
  }
}

function renderHabits() {
  habitsList.innerHTML = "";

  if (!habits.length) {
    const empty = document.createElement("div");
    empty.className = "habits-empty";
    empty.textContent = "Todavía no tienes hábitos. Pulsa + para crear el primero.";
    habitsList.appendChild(empty);
    return;
  }

  habits.forEach(habit => {
    const card = document.createElement("section");
    card.className = "habit-card";

    const header = document.createElement("div");
    header.className = "habit-card-header";

    const name = document.createElement("div");
    name.className = "habit-name";
    name.textContent = habit.name;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "habit-delete";
    deleteButton.textContent = "×";
    deleteButton.title = "Eliminar hábito";

    deleteButton.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar el hábito "${habit.name}" y su progreso?`)) return;

      habits = habits.filter(item => item.id !== habit.id);
      await persistHabits();
      renderHabits();
    });

    header.append(name, deleteButton);
    card.appendChild(header);

    const completed = new Set(habit.completed || []);

    const progress = document.createElement("div");
    progress.className = "habit-progress";
    progress.textContent = `${completed.size} de ${habit.duration} días completados`;
    card.appendChild(progress);

    const dots = document.createElement("div");
    dots.className = "habit-dots";

    const today = localDateString();

    for (let i = 0; i < habit.duration; i++) {
      const date = habitDate(habit.startDate, i);
      const isCompleted = completed.has(date);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `habit-day${isCompleted ? " completed" : ""}`;
      dot.title = `Día ${i + 1}: ${date}`;
      dot.setAttribute("aria-label", `Día ${i + 1}, ${isCompleted ? "completado" : "pendiente"}`);
      dot.setAttribute("aria-pressed", String(isCompleted));
      dot.disabled = date > today;

      dot.addEventListener("click", async () => {
        const current = new Set(habit.completed || []);

        if (current.has(date)) {
          current.delete(date);
        } else {
          current.add(date);
        }

        habit.completed = [...current].sort();
        await persistHabits();
        renderHabits();
      });

      dots.appendChild(dot);
    }

    card.appendChild(dots);
    habitsList.appendChild(card);
  });
}

// Mostrar y ocultar el formulario.
document.getElementById("addHabitButton").addEventListener("click", () => {
  habitForm.hidden = !habitForm.hidden;

  if (!habitForm.hidden) habitName.focus();
});

document.getElementById("cancelHabit").addEventListener("click", () => {
  habitForm.reset();
  habitDuration.value = 30;
  habitForm.hidden = true;
});

// Crear un hábito.
habitForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = habitName.value.trim();
  const duration = Number(habitDuration.value);

  if (!name || !Number.isInteger(duration) || duration < 1 || duration > 365) {
    alert("Escribe un nombre y una duración entre 1 y 365 días.");
    return;
  }

  habits.push({
    id: `habito-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    name,
    duration,
    startDate: localDateString(),
    completed: []
  });

  await persistHabits();
  renderHabits();

  habitForm.reset();
  habitDuration.value = 30;
  habitForm.hidden = true;
});
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function createEntryLine(text = "") {
  const line = document.createElement("div");
  line.className = "editor-line tag-entry";
  if (text) line.textContent = text;
  else line.innerHTML = "<br>";
  return line;
}

function createCategoryLine(tag) {
  const line = document.createElement("div");
  line.className = `editor-line category-line category-${TAGS[tag]}`;
  line.dataset.category = tag;
  line.innerHTML = "<br>";
  return line;
}

function createTagLine(tag) {
  const line = document.createElement("div");
  line.className = `tag-line tag-${TAGS[tag]}`;
  line.contentEditable = "false";
  line.textContent = `[${tag}]`;
  return line;
}

function getTag(text) {
  const normalized = text.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TAGS, normalized) ? normalized : null;
}

function placeCaret(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  pageContent.focus();
}

function getCurrentLine() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  let node = selection.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.(".editor-line") || null;
}

function cleanContentHTML(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "";
  wrapper.querySelectorAll(".search-highlight").forEach(mark => mark.replaceWith(...mark.childNodes));
  return wrapper.innerHTML;
}

function updatePlaceholder() {
  const hasText = pageContent.textContent.trim().length > 0;
  pageContent.classList.toggle("is-empty", !hasText);
}

function updateWordCount() {
  const text = `${pageTitle.value} ${pageContent.innerText || pageContent.textContent}`.trim();
  const count = text ? text.split(/\s+/).length : 0;
  wordCount.textContent = `${count} ${count === 1 ? "palabra" : "palabras"}`;
  updatePlaceholder();
}

function updateCurrentPage() {
  const page = diary.pages[currentIndex];
  if (!page) return;
  page.title = pageTitle.value;
  page.content = cleanContentHTML(pageContent.innerHTML);
  updateWordCount();
  renderPageList();
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveIndicator.textContent = "Guardando…";
  saveStatus.textContent = "Guardando tus escritos";
  saveTimer = setTimeout(() => saveDiary(), 450);
}

function saveDiary() {
  clearTimeout(saveTimer);
  const page = diary.pages[currentIndex];
  if (page) {
    page.title = pageTitle.value;
    page.content = cleanContentHTML(pageContent.innerHTML);
  }
  const snapshot = JSON.parse(JSON.stringify(diary));
  saveQueue = saveQueue.then(async () => {
    try {
      await window.diaryAPI.save(snapshot);
      saveIndicator.textContent = "Guardado";
      saveStatus.textContent = "Tus escritos están guardados";
    } catch (error) {
      console.error(error);
      saveIndicator.textContent = "Error al guardar";
      saveStatus.textContent = "No se pudo guardar";
    }
  });
  return saveQueue;
}

function renderSavedContent(content) {
  pageContent.innerHTML = "";
  if (!content) {
    pageContent.appendChild(createEntryLine());
    updatePlaceholder();
    return;
  }
  if (content.includes("editor-line") || content.includes("tag-line")) {
    pageContent.innerHTML = content;
  } else {
    content.split(/\r?\n/).forEach(text => pageContent.appendChild(createEntryLine(text)));
  }
  updatePlaceholder();
}

function showPage(index, highlight = "") {
  if (index < 0 || index >= diary.pages.length) return;
  currentIndex = index;
  const page = diary.pages[index];
  pageTitle.value = page.title || "";
  renderSavedContent(page.content || "");
  pageDate.textContent = formatDate(page.date);
  pageCounter.textContent = `${currentIndex + 1} / ${diary.pages.length}`;
  topPageNumber.textContent = `Página ${currentIndex + 1}`;
  prevButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === diary.pages.length - 1;
  updateWordCount();
  renderPageList();
  if (highlight) requestAnimationFrame(() => highlightMatch(highlight));
}

function getPageText(page) {
  const holder = document.createElement("div");
  holder.innerHTML = page.content || "";
  holder.querySelectorAll(".search-highlight").forEach(el => el.replaceWith(...el.childNodes));
  return holder.textContent || "";
}

function getPageTags(page) {
  const holder = document.createElement("div");
  holder.innerHTML = page.content || "";
  const found = new Set();
  holder.querySelectorAll(".tag-line").forEach(line => {
    const tag = (line.textContent || "").replace(/[\[\]\s]/g, "").toUpperCase();
    if (Object.prototype.hasOwnProperty.call(TAGS, tag)) found.add(tag);
  });
  // Compatibilidad con páginas guardadas como texto plano.
  const plain = holder.textContent || page.content || "";
  Object.keys(TAGS).forEach(tag => {
    if (new RegExp(`(?:^|\\n)\\s*\\[?${tag}\\]?\\s*(?:\\n|$)`, "i").test(plain)) found.add(tag);
  });
  return found;
}

function makeSnippet(page, query) {
  const title = page.title || "";
  const text = getPageText(page).replace(/\s+/g, " ").trim();
  const source = title.toLowerCase().includes(query.toLowerCase()) ? title : text;
  if (!source) return "Sin contenido";
  const position = source.toLowerCase().indexOf(query.toLowerCase());
  if (position < 0) return source.slice(0, 95);
  const start = Math.max(0, position - 38);
  const end = Math.min(source.length, position + query.length + 55);
  return `${start > 0 ? "…" : ""}${source.slice(start, end)}${end < source.length ? "…" : ""}`;
}

function appendHighlightedSnippet(container, snippet, query) {
  const lower = snippet.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) { container.textContent = snippet; return; }
  container.append(document.createTextNode(snippet.slice(0, index)));
  const mark = document.createElement("mark");
  mark.textContent = snippet.slice(index, index + query.length);
  container.append(mark, document.createTextNode(snippet.slice(index + query.length)));
}

function pageMatches(page, selectedTag, query) {
  if (selectedTag && !getPageTags(page).has(selectedTag)) return false;
  if (!query) return true;
  const combined = `${page.title || ""}\n${getPageText(page)}`.toLocaleLowerCase();
  return combined.includes(query.toLocaleLowerCase());
}

function renderPageList() {
  pageList.innerHTML = "";
  const selectedTag = tagFilter.value;
  const query = searchInput.value.trim();
  const matches = diary.pages.map((page, index) => ({ page, index }))
    .filter(({ page }) => pageMatches(page, selectedTag, query));

  if (query) {
    searchSummary.textContent = `${matches.length} ${matches.length === 1 ? "coincidencia" : "coincidencias"}`;
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "empty-results";
      empty.textContent = "No se encontraron resultados. Prueba otra palabra o etiqueta.";
      pageList.appendChild(empty);
      return;
    }
    matches.forEach(({ page, index }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      const title = document.createElement("span");
      title.className = "search-result-title";
      title.textContent = page.title.trim() || `Página ${index + 1}`;
      const snippet = document.createElement("span");
      snippet.className = "search-result-snippet";
      appendHighlightedSnippet(snippet, makeSnippet(page, query), query);
      button.append(title, snippet);
      button.addEventListener("click", async () => {
        await saveDiary();
        const targetIndex = diary.pages.findIndex(item => item.id === page.id);
        showPage(targetIndex, query);
      });
      pageList.appendChild(button);
    });
    return;
  }

  searchSummary.textContent = selectedTag ? `${matches.length} ${matches.length === 1 ? "página" : "páginas"}` : "";
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-results";
    empty.textContent = "No hay páginas con esta etiqueta.";
    pageList.appendChild(empty);
    return;
  }

  matches.forEach(({ page, index }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.draggable = true;
    button.className = `page-item${index === currentIndex ? " active" : ""}`;
    const number = document.createElement("span");
    number.className = "page-index";
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = page.title.trim() || `Página ${index + 1}`;
    button.append(number, label);
    button.addEventListener("click", async () => {
      const targetIndex = diary.pages.findIndex(item => item.id === page.id);
      if (targetIndex === -1 || targetIndex === currentIndex) return;
      await saveDiary();
      showPage(targetIndex);
    });
    button.addEventListener("dragstart", event => {
      draggedPageId = page.id;
      event.dataTransfer.setData("text/plain", page.id);
      event.dataTransfer.effectAllowed = "move";
      button.classList.add("dragging");
    });
    button.addEventListener("dragend", () => {
      draggedPageId = null;
      button.classList.remove("dragging");
      document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    });
    button.addEventListener("dragover", event => { event.preventDefault(); button.classList.add("drag-over"); });
    button.addEventListener("dragleave", () => button.classList.remove("drag-over"));
    button.addEventListener("drop", async event => {
      event.preventDefault();
      button.classList.remove("drag-over");
      const fromId = event.dataTransfer.getData("text/plain");
      const toId = page.id;
      if (!fromId || fromId === toId || selectedTag || query) return;
      await saveDiary();
      const from = diary.pages.findIndex(item => item.id === fromId);
      const to = diary.pages.findIndex(item => item.id === toId);
      if (from === -1 || to === -1) return;
      const selectedId = diary.pages[currentIndex].id;
      const [movedPage] = diary.pages.splice(from, 1);
      diary.pages.splice(to, 0, movedPage);
      currentIndex = diary.pages.findIndex(item => item.id === selectedId);
      showPage(currentIndex);
      await saveDiary();
    });
    pageList.appendChild(button);
  });
}

function removeSearchHighlights() {
  pageContent.querySelectorAll(".search-highlight").forEach(mark => mark.replaceWith(...mark.childNodes));
}

function highlightMatch(query) {
  if (!query) return;
  removeSearchHighlights();
  const walker = document.createTreeWalker(pageContent, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest(".tag-line, .search-highlight")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const lowerQuery = query.toLocaleLowerCase();
  let found = null;
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const index = text.toLocaleLowerCase().indexOf(lowerQuery);
    if (index === -1) continue;
    const before = node.splitText(index);
    const after = before.splitText(query.length);
    const mark = document.createElement("span");
    mark.className = "search-highlight";
    mark.textContent = before.nodeValue;
    before.replaceWith(mark);
    found = mark;
    break;
  }
  if (found) {
    found.scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (pageTitle.value.toLocaleLowerCase().includes(lowerQuery)) {
    pageTitle.focus();
    const start = pageTitle.value.toLocaleLowerCase().indexOf(lowerQuery);
    pageTitle.setSelectionRange(start, start + query.length);
  }
}

pageContent.addEventListener("input", () => {
  const line = getCurrentLine();
  if (line?.classList.contains("tag-entry")) {
    const text = line.innerText.trim();
    const valid = getTag(text);
    const possible = Object.keys(TAGS).some(tag => tag.startsWith(text.toUpperCase()));
    line.classList.toggle("invalid-tag", text.length > 0 && !valid && !possible);
  }
  updateCurrentPage();
});

pageContent.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  const line = getCurrentLine();
  if (!line) return;
  const text = line.innerText.trim();
  const tag = getTag(text);
  if (tag) {
    const marker = createTagLine(tag);
    const contentLine = createCategoryLine(tag);
    line.replaceWith(marker);
    marker.after(contentLine);
    placeCaret(contentLine);
    updateCurrentPage();
    return;
  }
  if (line.classList.contains("tag-entry")) {
    line.classList.add("invalid-tag");
    return;
  }
  const category = line.dataset.category;
  if (!category) return;
  const nextLine = createCategoryLine(category);
  line.after(nextLine);
  placeCaret(nextLine);
  updateCurrentPage();
});

pageContent.addEventListener("paste", event => {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text);
});

tagFilter.addEventListener("change", renderPageList);
searchInput.addEventListener("input", renderPageList);
clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  renderPageList();
  searchInput.focus();
});

// Nueva página
document.getElementById("newPage").addEventListener("click", async () => {
  await saveDiary();
  diary.pages.push(makePage());
  tagFilter.value = "";
  searchInput.value = "";
  showPage(diary.pages.length - 1);
  pageTitle.focus();
  scheduleSave();
});

prevButton.addEventListener("click", async () => {
  if (currentIndex > 0) { await saveDiary(); showPage(currentIndex - 1); }
});
nextButton.addEventListener("click", async () => {
  if (currentIndex < diary.pages.length - 1) { await saveDiary(); showPage(currentIndex + 1); }
});
pageTitle.addEventListener("input", updateCurrentPage);

document.getElementById("deletePage").addEventListener("click", async () => {
  const isLastPage = diary.pages.length === 1;
  const message = isLastPage
    ? "Esta es la única página. ¿Quieres borrar su contenido?"
    : "¿Estás seguro de que quieres eliminar esta página? Esta acción no se puede deshacer.";
  if (!confirm(message)) return;
  await saveDiary();
  if (isLastPage) { diary.pages[0] = makePage(); currentIndex = 0; }
  else { diary.pages.splice(currentIndex, 1); currentIndex = Math.min(currentIndex, diary.pages.length - 1); }
  showPage(currentIndex);
  await saveDiary();
});

// Exportar una copia JSON del diario actual.
document.getElementById("exportDiary").addEventListener("click", async () => {
  await saveDiary();
  const backup = {
    version: 2,
    pages: diary.pages,
    habits
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mi-diario-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

// Importar reemplaza el diario local; se pide confirmación antes de hacerlo.
const importFile = document.getElementById("importFile");
document.getElementById("importDiary").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported || !Array.isArray(imported.pages)) throw new Error("El archivo no tiene el formato de Mi Diario.");
    if (!confirm(`El archivo contiene ${imported.pages.length} páginas. Importar reemplazará el diario guardado en este dispositivo. ¿Continuar?`)) return;
    await saveDiary();
    diary = {
      version: imported.version || 1,
      pages: imported.pages.map(page => ({
        id: page.id || makePage().id,
        date: page.date || new Date().toISOString(),
        title: page.title || "",
        content: page.content || ""

      }))
    };
    habits = Array.isArray(imported.habits) ? imported.habits : [];
    await window.diaryAPI.saveHabits(habits);
    renderHabits();
    if (!diary.pages.length) diary.pages.push(makePage());
    currentIndex = 0;
    tagFilter.value = "";
    searchInput.value = "";
    showPage(0);
    await saveDiary();
    alert("Diario importado correctamente.");
  } catch (error) {
    console.error(error);
    alert(`No se pudo importar el archivo: ${error.message}`);
  } finally {
    importFile.value = "";
  }
});

window.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveDiary();
  }
});

(async function init() {
  try {
    diary = await window.diaryAPI.load();
    habits = await window.diaryAPI.loadHabits();
    renderHabits();
    if (!diary || !Array.isArray(diary.pages) || diary.pages.length === 0) diary = { version: 1, pages: [makePage()] };
    diary.pages = diary.pages.map(page => ({
      id: page.id || makePage().id,
      date: page.date || new Date().toISOString(),
      title: page.title || "",
      content: page.content || ""
    }));
    showPage(0);
  } catch (error) {
    console.error(error);
    diary = { version: 1, pages: [makePage()] };
    showPage(0);
    saveIndicator.textContent = "Error al abrir";
    saveStatus.textContent = "No se pudo abrir el diario";
  }
})();
