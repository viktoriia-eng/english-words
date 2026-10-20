import { useEffect, useState } from "react";
import "./Admin.css";

/*
  Кабінет вчителя: .../?admin
  Кнопка «Зберегти на сайт» записує JSON-файли прямо в GitHub-репозиторій,
  після чого GitHub Actions сам оновлює сайт (приблизно за 1 хвилину).
*/

/* ====== НАЛАШТУВАННЯ: впиши свої значення ====== */
const OWNER = "viktoriia-eng";
const REPO = "english-words";
const BRANCH = "main";
/* =============================================== */

const BASE = import.meta.env.BASE_URL;
const ID_RE = /^[a-z0-9_-]+$/;
const TOKEN_KEY = "gh_token";

/* ---------- token + GitHub ---------- */

const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const askToken = () => {
  const t = prompt("Встав GitHub токен (він зберігається лише в цьому браузері):");
  if (t && t.trim()) {
    try {
      localStorage.setItem(TOKEN_KEY, t.trim());
    } catch {
      /* сховище недоступне */
    }
  }
  return getToken();
};

const forgetToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* сховище недоступне */
  }
};

// base64 з підтримкою кирилиці
const toBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

const apiUrl = (path) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;

async function saveToGithub(path, text, message) {
  const token = getToken() || askToken();
  if (!token) throw new Error("Немає токену");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  // щоб оновити існуючий файл, потрібен його sha
  let sha;
  const get = await fetch(`${apiUrl(path)}?ref=${BRANCH}`, { headers, cache: "no-store" });
  if (get.ok) {
    sha = (await get.json()).sha;
  } else if (get.status === 401 || get.status === 403) {
    forgetToken();
    throw new Error("Токен недійсний або без прав. Спробуй ще раз.");
  }

  const put = await fetch(apiUrl(path), {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message,
      content: toBase64(text),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    if (put.status === 401 || put.status === 403) forgetToken();
    let m = "Помилка GitHub";
    try {
      m = (await put.json()).message || m;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
}

/* ---------- helpers ---------- */

// Якщо є токен, читаємо свіжий файл напряму з GitHub (без затримки Pages)
async function getJson(path) {
  const token = getToken();
  if (token) {
    try {
      const r = await fetch(`${apiUrl("public/data/" + path)}?ref=${BRANCH}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.raw+json",
        },
        cache: "no-store",
      });
      if (r.ok) return await r.json();
    } catch {
      /* пробуємо зі сайту */
    }
  }
  const r = await fetch(`${BASE}data/${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("not found");
  return r.json();
}

async function translate(text) {
  const r = await fetch(
      `https://api.mymemory.translated.net/get?langpair=en|uk&q=${encodeURIComponent(text)}`
  );
  const j = await r.json();
  const t = j?.responseData?.translatedText || "";
  return /MYMEMORY WARNING/i.test(t) ? "" : t;
}

const hasWord = (words, en) => words.some((w) => w.en.toLowerCase() === en.toLowerCase());

const draftKey = (id) => `draft:${id}`;
function readDraft(id) {
  try {
    const v = localStorage.getItem(draftKey(id));
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function writeDraft(id, data) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(data));
  } catch {
    /* сховище недоступне */
  }
}
function clearDraft(id) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    /* сховище недоступне */
  }
}

function downloadFile(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- component ---------- */

export default function Admin() {
  const [students, setStudents] = useState([]);
  const [studentsDirty, setStudentsDirty] = useState(false);
  const [id, setId] = useState("");
  const [data, setData] = useState({ name: "", words: [] });
  const [dirty, setDirty] = useState(false);

  const [en, setEn] = useState("");
  const [uk, setUk] = useState("");
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // список учнів
  useEffect(() => {
    getJson("students.json")
        .then((d) => {
          const list = d.students || [];
          setStudents(list);
          if (list[0]) setId(list[0].id);
        })
        .catch(() => setMsg("Не знайдено public/data/students.json"));
  }, []);

  // дані вибраного учня (чернетка має пріоритет над файлом)
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const draft = readDraft(id);
    if (draft) {
      setData(draft);
      setDirty(true);
      return;
    }
    setDirty(false);
    getJson(`${id}.json`)
        .then((d) => alive && setData(d))
        .catch(() => {
          const s = students.find((x) => x.id === id);
          if (alive) setData({ name: s?.name || id, words: [] });
        });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setWords = (words) => {
    const next = { ...data, words };
    setData(next);
    setDirty(true);
    writeDraft(id, next);
  };

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3500);
  };

  /* --- слова --- */

  const runTranslate = async () => {
    const text = en.trim();
    if (!text || busy) return;
    setBusy(true);
    setMsg("Перекладаю…");
    try {
      const t = await translate(text);
      setUk(t);
      setMsg(t ? "" : "Не вдалося перекласти, впиши вручну");
    } catch {
      setMsg("Не вдалося перекласти, впиши вручну");
    }
    setBusy(false);
  };

  const addWord = () => {
    const e = en.trim();
    const u = uk.trim();
    if (!e || !u) return flash("Потрібні слово і переклад");
    if (hasWord(data.words, e)) return flash("Таке слово вже є");
    setWords([...data.words, { en: e, uk: u }]);
    setEn("");
    setUk("");
  };

  const editUk = (i, value) => setWords(data.words.map((w, k) => (k === i ? { ...w, uk: value } : w)));
  const removeWord = (i) => setWords(data.words.filter((_, k) => k !== i));

  // тема учня: "pink" записується у його JSON, без галочки поля theme немає
  const setPinkTheme = (on) => {
    const { theme, ...rest } = data; // eslint-disable-line no-unused-vars
    const next = on ? { ...rest, theme: "pink" } : rest;
    setData(next);
    setDirty(true);
    writeDraft(id, next);
  };

  /* --- учні --- */

  const addStudent = () => {
    const sid = newId.trim().toLowerCase();
    const name = newName.trim();
    if (!ID_RE.test(sid)) return flash("ID: лише латиниця, цифри, - та _");
    if (!name) return flash("Вкажи ім'я");
    if (students.some((s) => s.id === sid)) return flash("Такий ID вже є");
    setStudents([...students, { id: sid, name }]);
    setStudentsDirty(true);
    setNewId("");
    setNewName("");
    setId(sid);
  };

  const clearCurrentDraft = () => {
    clearDraft(id);
    const keep = id;
    setId("");
    setTimeout(() => setId(keep), 0);
  };

  /* --- експорт / збереження --- */

  const studentJson = JSON.stringify(data, null, 2);
  const studentsJson = JSON.stringify({ students }, null, 2);
  const link = `${window.location.origin}${BASE}?s=${id}`;

  const doCopy = async (text, label) =>
      flash((await copyText(text)) ? `${label} скопійовано` : "Не вдалося скопіювати");

  const saveAll = async () => {
    if (busy) return;
    setBusy(true);
    setMsg("Зберігаю в GitHub…");
    try {
      if (studentsDirty) {
        await saveToGithub("public/data/students.json", studentsJson, "Оновлено список учнів");
        setStudentsDirty(false);
      }
      await saveToGithub(`public/data/${id}.json`, studentJson, `Оновлено слова: ${id}`);
      clearDraft(id);
      setDirty(false);
      flash("Збережено! Сайт оновиться приблизно за хвилину ✅");
    } catch (e) {
      flash("Помилка: " + e.message);
    }
    setBusy(false);
  };

  const hasChanges = dirty || studentsDirty;

  return (
      <div className="app">
        <div className="wrap">
          <header className="hero">
            <div className="hero__logo">🧑‍🏫</div>
            <h1>Кабінет вчителя</h1>
          </header>

          {msg && <div className="toast">{msg}</div>}

          {/* Учень */}
          <section className="card">
            <h2>Учень</h2>
            <label className="field">
              <span>Оберіть учня</span>
              <select value={id} onChange={(e) => setId(e.target.value)}>
                {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </select>
            </label>

            {id && (
                <>
                  <label className="check">
                    <input
                        type="checkbox"
                        checked={data.theme === "pink"}
                        onChange={(e) => setPinkTheme(e.target.checked)}
                    />
                    <span>🌸 Рожева тема для цього учня</span>
                  </label>

                  <p className="muted small">Посилання учня:</p>
                  <code className="code">{link}</code>
                  <div>
                    <button className="btn btn--ghost" onClick={() => doCopy(link, "Посилання")}>Копіювати посилання</button>
                    <a className="btn btn--ghost btn--link" href={link} target="_blank" rel="noreferrer">Відкрити</a>
                  </div>
                </>
            )}

            <details className="more">
              <summary>➕ Додати нового учня</summary>
              <label className="field">
                <span>ID для посилання (латиницею)</span>
                <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ivan" />
              </label>
              <label className="field">
                <span>Ім'я (без прізвища)</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Іван" />
              </label>
              <button className="btn" onClick={addStudent}>Додати учня</button>
            </details>
          </section>

          {id && (
              <>
                {/* Одне слово */}
                <section className="card">
                  <h2>Додати слово</h2>
                  <label className="field">
                    <span>English</span>
                    <input
                        value={en}
                        onChange={(e) => setEn(e.target.value)}
                        onBlur={() => !uk.trim() && runTranslate()}
                        autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Переклад (підтягується сам, можна виправити)</span>
                    <input
                        value={uk}
                        onChange={(e) => setUk(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addWord()}
                        autoComplete="off"
                    />
                  </label>
                  <button className="btn" onClick={addWord} disabled={busy}>Додати</button>
                  <button className="btn btn--ghost" onClick={runTranslate} disabled={busy}>Перекласти</button>
                </section>

                {/* Список */}
                <section className="card">
                  <h2>Слова: {data.name} ({data.words.length})</h2>
                  {data.words.length === 0 && <p className="muted center">Поки порожньо</p>}
                  <div className="admin-list">
                    {/* останні додані слова зверху */}
                    {data.words
                        .map((w, i) => ({ w, i }))
                        .reverse()
                        .map(({ w, i }) => (
                            <div className="row" key={w.en}>
                              <div className="en">{w.en}</div>
                              <input
                                  className="row__uk"
                                  value={w.uk}
                                  onChange={(e) => editUk(i, e.target.value)}
                                  aria-label={`Переклад ${w.en}`}
                              />
                              <button className="icon" onClick={() => removeWord(i)} aria-label="Видалити">🗑️</button>
                            </div>
                        ))}
                  </div>
                </section>

                {/* Збереження */}
                <section className="card">
                  <h2>Зберегти зміни</h2>
                  {hasChanges ? (
                      <p className="notice">Є незбережені зміни (тимчасово лежать у цьому браузері).</p>
                  ) : (
                      <p className="muted small">Усе збережено.</p>
                  )}

                  <button className="btn" onClick={saveAll} disabled={busy || !hasChanges}>
                    💾 Зберегти на сайт
                  </button>
                  <button className="btn btn--ghost" onClick={clearCurrentDraft}>Скасувати зміни</button>

                  <details className="more">
                    <summary>Запасний варіант: ручне збереження файлу</summary>
                    <p className="muted small">
                      Файл <code>public/data/{id}.json</code>:
                    </p>
                    <textarea readOnly value={studentJson} className="mono" />
                    <button className="btn btn--ghost" onClick={() => downloadFile(`${id}.json`, studentJson)}>Завантажити {id}.json</button>
                    <button className="btn btn--ghost" onClick={() => doCopy(studentJson, "JSON")}>Копіювати JSON</button>

                    {studentsDirty && (
                        <>
                          <p className="notice">Додано нового учня: потрібен і <code>students.json</code>.</p>
                          <textarea readOnly value={studentsJson} className="mono" />
                          <button className="btn btn--ghost" onClick={() => downloadFile("students.json", studentsJson)}>Завантажити students.json</button>
                          <button className="btn btn--ghost" onClick={() => doCopy(studentsJson, "students.json")}>Копіювати</button>
                        </>
                    )}
                  </details>
                </section>
              </>
          )}
        </div>
      </div>
  );
}
