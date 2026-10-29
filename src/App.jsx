import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Admin from "./Admin.jsx";
import { IMAGE_GROUPS } from "./imageNames.js";

/*
  Посилання учня: http://localhost:5173/?s=anna
  Слова беруться з public/data/anna.json (додамо на наступному кроці).
  Без ?s=... відкривається демо-режим із кількома словами.
*/
const STUDENT = (new URLSearchParams(window.location.search).get("s") || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

const DEMO = {
    name: "Демо",
    words: [
        { en: "apple", uk: "яблуко" },
    ],
};

/* ---------- helpers ---------- */

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function findVoice() {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    return (
        voices.find((v) => /Google UK English|Aria|Jenny|Samantha/i.test(v.name)) || voices[0]
    );
}

// якщо голоси ще не завантажились, чекаємо на них (максимум 0,6 с)
function whenVoicesReady(callback) {
    const synth = window.speechSynthesis;
    if (synth.getVoices().length) return callback();

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        synth.removeEventListener("voiceschanged", finish);
        callback();
    };
    synth.addEventListener("voiceschanged", finish);
    setTimeout(finish, 600);
}

// просимо браузер завантажити голоси одразу при відкритті сторінки
try {
    window.speechSynthesis.getVoices();
} catch {
    /* озвучення недоступне */
}

function speak(text) {
    try {
        whenVoicesReady(() => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "en-US";
            u.rate = 0.8;
            const v = findVoice();
            if (v) u.voice = v;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
        });
    } catch {
        /* голос недоступний */
    }
}

/*
  Картинки лежать у public/images/<папка>/<слово>.webp (кожна папка — група).
  Які групи бачить учень, вчитель обирає в кабінеті (поле pictureGroups у JSON учня).
  Список груп створює скрипт scripts/make-image-list.mjs
*/
function pictureUrl(groupId, file) {
    const folder = groupId ? `${encodeURIComponent(groupId)}/` : "";
    return `${import.meta.env.BASE_URL}images/${folder}${encodeURIComponent(file)}`;
}

// картинки вибраних груп; selected = undefined означає "усі групи"; однакові назви не повторюються
function picturePool(selected) {
    const groups = Array.isArray(selected)
        ? IMAGE_GROUPS.filter((g) => selected.includes(g.id))
        : IMAGE_GROUPS;
    const seen = new Set();
    const list = [];
    groups.forEach((g) => {
        g.images.forEach((img) => {
            if (seen.has(img.name)) return;
            seen.add(img.name);
            list.push({ en: img.name, src: pictureUrl(g.id, img.file) });
        });
    });
    return list;
}

/* ---------- icons ---------- */

function SpeakerIcon() {
    return (
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9.5v5h4l5.5 4.5V5L7 9.5H3z" fill="currentColor" />
            <path
                d="M15.8 8.8a4.6 4.6 0 0 1 0 6.4M18.6 6a8.6 8.6 0 0 1 0 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M4 12.8l5.2 5.2L20 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function UndoIcon() {
    return (
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M9 5L4 10l5 5M4 10h10.5a5.5 5.5 0 0 1 0 11H11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/* ---------- hooks ---------- */

function useStudent() {
    const [state, setState] = useState(
        STUDENT ? { status: "loading" } : { status: "ready", data: DEMO }
    );

    useEffect(() => {
        if (!STUDENT) return;
        fetch(`${import.meta.env.BASE_URL}data/${STUDENT}.json`, { cache: "no-store" })
            .then((r) => {
                if (!r.ok) throw new Error("not found");
                return r.json();
            })
            .then((data) => setState({ status: "ready", data }))
            .catch(() => setState({ status: "error" }));
    }, []);

    return state;
}

function useLearned() {
    const key = `learned:${STUDENT || "demo"}`;
    const [list, setList] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(list));
        } catch {
            /* сховище недоступне */
        }
    }, [key, list]);

    const mark = (en, on) =>
        setList((l) => (on ? (l.includes(en) ? l : [...l, en]) : l.filter((x) => x !== en)));

    return [list, mark];
}

/* ---------- games ---------- */

function Flash({ word, onNext }) {
    const [back, setBack] = useState(false);

    return (
        <>
            <button
                className={"flip-card" + (back ? " flip-card--back" : "")}
                onClick={() => {
                    speak(word.en);
                    setBack(!back);
                }}
            >
                <span className="flip-card__inner">
                    <span className="flip-card__face">{word.en}</span>
                    <span className="flip-card__face flip-card__face--back">{word.uk}</span>
                </span>
            </button>
            <p className="muted center">Натисни на картку, щоб перегорнути</p>
            <div className="actions">
                <button className="btn btn--ghost" onClick={() => speak(word.en)}>
                    <SpeakerIcon /> Вимова
                </button>
                <button className="btn" onClick={() => onNext(true)}>Знаю ✅</button>
                <button className="btn btn--ghost" onClick={() => onNext(false)}>Ще вчу</button>
            </div>
        </>
    );
}

function Quiz({ word, all, onNext }) {
    const [picked, setPicked] = useState(null);
    const [options] = useState(() => {
        const others = shuffle(all.filter((w) => w.uk !== word.uk))
            .slice(0, 3)
            .map((w) => w.uk);
        return shuffle([...others, word.uk]);
    });

    // слово озвучується автоматично, коли з'являється нове питання (Quiz створюється заново для кожного слова)
    useEffect(() => {
        speak(word.en);
    }, [word.en]);

    const pick = (i) => {
        if (picked !== null) return;
        setPicked(i);
        setTimeout(() => onNext(options[i] === word.uk), 900);
    };

    return (
        <>
            <h2 className="center big">
                {word.en}
                <button className="icon icon--speak" onClick={() => speak(word.en)} aria-label="Вимова">
                    <SpeakerIcon />
                </button>
            </h2>
            <div className="grid grid--two">
                {options.map((o, i) => {
                    let state = "";
                    if (picked !== null) {
                        if (o === word.uk) state = " choice--ok";
                        else if (i === picked) state = " choice--bad";
                    }
                    return (
                        <button key={o} className={"choice" + state} onClick={() => pick(i)}>
                            {o}
                        </button>
                    );
                })}
            </div>
        </>
    );
}

function Build({ word, onNext }) {
    const target = word.en.replace(/\s/g, "");
    const makePool = () => shuffle(target.split("").map((c, id) => ({ c, id })));
    const [pool, setPool] = useState(makePool);
    const [answer, setAnswer] = useState([]);

    const add = (i) => {
        const tile = pool[i];
        const nextAnswer = [...answer, tile];
        setPool(pool.filter((_, k) => k !== i));
        setAnswer(nextAnswer);

        if (nextAnswer.length === target.length) {
            const ok = nextAnswer.map((t) => t.c).join("").toLowerCase() === target.toLowerCase();
            speak(word.en);
            setTimeout(() => {
                if (!ok) alert("Правильно: " + word.en);
                onNext(ok);
            }, 400);
        }
    };

    const remove = (i) => {
        setPool([...pool, answer[i]]);
        setAnswer(answer.filter((_, k) => k !== i));
    };

    const reset = () => {
        setPool(makePool());
        setAnswer([]);
    };

    return (
        <>
            <h2 className="center big">{word.uk}</h2>
            <div className="tiles tiles--answer">
                {answer.map((t, i) => (
                    <button key={t.id} className="tile tile--placed" onClick={() => remove(i)}>{t.c}</button>
                ))}
            </div>
            <div className="tiles">
                {pool.map((t, i) => (
                    <button key={t.id} className="tile" onClick={() => add(i)}>{t.c}</button>
                ))}
            </div>
            <div className="actions">
                <button className="btn btn--ghost" onClick={reset}>Спочатку</button>
            </div>
        </>
    );
}

// Гра за картинками не залежить від словничка: питання і варіанти беруться з вибраних груп
function Picture({ word, pictures, onNext }) {
    const [picked, setPicked] = useState(null);
    const [options] = useState(() => {
        const others = shuffle(pictures.filter((p) => p.en !== word.en))
            .slice(0, 3)
            .map((p) => p.en);
        return shuffle([...others, word.en]);
    });

    const pick = (i) => {
        if (picked !== null) return;
        setPicked(i);
        speak(word.en);
        setTimeout(() => onNext(options[i] === word.en), 900);
    };

    return (
        <>
            <div className="picture">
                <img src={word.src} alt="" />
            </div>
            <div className="grid grid--two">
                {options.map((o, i) => {
                    let state = "";
                    if (picked !== null) {
                        if (o === word.en) state = " choice--ok";
                        else if (i === picked) state = " choice--bad";
                    }
                    return (
                        <button key={o} className={"choice" + state} onClick={() => pick(i)}>
                            {o}
                        </button>
                    );
                })}
            </div>
        </>
    );
}

function Trainer({ session, allWords, onLearned, onClose }) {
    const [i, setI] = useState(0);
    const [score, setScore] = useState(0);
    const { game, queue } = session;

    if (i >= queue.length) {
        return (
            <section className="card center">
                <div className="emoji">🎉</div>
                <h2>Супер!</h2>
                <p className="muted">Ти чудово впорався з тренуванням!</p>
                <p className="result">Результат: {score} з {queue.length} слів</p>
                <button className="btn" onClick={onClose}>Продовжити 🚀</button>
            </section>
        );
    }

    const word = queue[i];
    const next = (ok) => {
        if (ok) {
            setScore((s) => s + 1);
            // слова з картинок не з словничка — вивченими їх не позначаємо
            if (game !== "picture") onLearned(word.en);
        }
        setI((n) => n + 1);
    };

    return (
        <section className="card">
            <div className="progress"><i style={{ width: `${(i / queue.length) * 100}%` }} /></div>
            <p className="muted center">{i + 1} / {queue.length}</p>

            {game === "flash" && <Flash key={i} word={word} onNext={next} />}
            {game === "quiz" && <Quiz key={i} word={word} all={allWords} onNext={next} />}
            {game === "build" && <Build key={i} word={word} onNext={next} />}
            {game === "picture" && <Picture key={i} word={word} pictures={session.pictures} onNext={next} />}

            <div className="actions">
                <button className="btn btn--ghost" onClick={onClose}>Вийти</button>
            </div>
        </section>
    );
}

/* ---------- lists ---------- */

function WordList({ title, items, learned, onToggle }) {
    return (
        <section className="card">
            <h2>{title} ({items.length})</h2>
            {items.length === 0 && <p className="muted center">Тут поки порожньо</p>}
            {items.map((w) => (
                <div className={"row" + (w.isNew && !learned ? " row--new" : "")} key={w.en}>
                    <div>
                        <div className="en">
                            {w.en}
                            {w.isNew && !learned && <span className="badge-new">new</span>}
                        </div>
                        <div className="muted">{w.uk}</div>
                    </div>
                    <div>
                        <button className="icon icon--speak" onClick={() => speak(w.en)} aria-label="Вимова">
                            <SpeakerIcon />
                        </button>
                        <button
                            className={"icon " + (learned ? "icon--undo" : "icon--check")}
                            onClick={() => onToggle(w.en, !learned)}
                            aria-label={learned ? "Повернути у словничок" : "Позначити вивченим"}
                        >
                            {learned ? <UndoIcon /> : <CheckIcon />}
                        </button>
                    </div>
                </div>
            ))}
        </section>
    );
}

/* ---------- app ---------- */

function Shell({ name, center, children }) {
    return (
        <div className="app">
            <div className="wrap wrap--wide">
                <header className="topbar">
                    <div className="topbar__name">{name}</div>
                    <div className="topbar__center">{center}</div>
                    <div className="topbar__brand">
                        <span className="topbar__logo">📘</span>
                        <h1>Англійський словник</h1>
                    </div>
                </header>
                {children}
            </div>
        </div>
    );
}

/* Спливаюче вікно: закривається хрестиком, кліком по тлу або клавішею Esc */
function Modal({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    return (
        <div
            className="modal"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal__dialog" role="dialog" aria-modal="true" aria-label={title}>
                <div className="modal__head">
                    <h2>{title}</h2>
                    <button className="modal__close" onClick={onClose} aria-label="Закрити">✕</button>
                </div>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}

function Student() {
    const student = useStudent();
    const [learnedList, mark] = useLearned();
    const [count, setCount] = useState(5);
    const [session, setSession] = useState(null);
    const [open, setOpen] = useState(false);
    const [onlyNewChecked, setOnlyNewChecked] = useState(false);

    // закриття вікна завершує і поточне тренування
    const closeTrainer = useCallback(() => {
        setOpen(false);
        setSession(null);
    }, []);

    // тема учня береться з його JSON (поле "theme": "pink")
    const theme = student.status === "ready" ? student.data.theme : undefined;
    useEffect(() => {
        const root = document.documentElement;
        if (theme) root.setAttribute("data-theme", theme);
        else root.removeAttribute("data-theme");
        return () => root.removeAttribute("data-theme");
    }, [theme]);

    if (student.status === "loading") {
        return <Shell><div className="card center muted">Завантаження…</div></Shell>;
    }
    if (student.status === "error") {
        return <Shell><div className="card center">Сторінку не знайдено. Перевір посилання.</div></Shell>;
    }

    const { name, words: rawWords } = student.data;
    // гра 4 прихована, поки вчитель не ввімкне її в кабінеті (поле pictureGame)
    const showPicture = Boolean(student.data.pictureGame);
    // останні додані слова зверху
    const words = [...rawWords].reverse().map((w) => ({ ...w, learned: learnedList.includes(w.en) }));
    const learned = words.filter((w) => w.learned);
    const todo = words.filter((w) => !w.learned);

    // скільки у словничку слів із позначкою new; без них галочка "тільки нові" не діє
    const newCount = todo.filter((w) => w.isNew).length;
    const onlyNew = onlyNewChecked && newCount > 0;

    const start = (game) => {
        if (game === "picture") {
            // картинки не залежать від словничка: беремо групи, які вибрав вчитель
            const pictures = picturePool(student.data.pictureGroups);
            if (pictures.length < 2) return alert("Немає картинок у вибраних папках 🙂");
            const queue = shuffle(pictures);
            return setSession({ game, queue: count ? queue.slice(0, count) : queue, pictures });
        }

        let pool;
        if (onlyNew) {
            // тільки слова з позначкою new зі словничка
            pool = shuffle(todo.filter((w) => w.isNew));
        } else {
            const fresh = words.filter((w) => !w.learned);
            pool = shuffle(fresh.length ? fresh : words);
        }
        if (!pool.length) return alert("Поки немає слів 🙂");
        if (count) pool = pool.slice(0, count);
        setSession({ game, queue: pool });
    };

    const trainerButton = (
        <button className="topbar__trainer" onClick={() => setOpen(true)}>
            🎮 Навчальний тренажер
        </button>
    );

    return (
        <Shell name={name} center={trainerButton}>
            <main className="board">
                {/* Колонка 1: вивчені слова */}
                <aside className="board__col board__col--done">
                    <WordList title="🏆 Вивчені" items={learned} learned onToggle={mark} />
                </aside>

                {/* Колонка 2: слова, які ще треба вивчити */}
                <aside className="board__col board__col--todo">
                    <WordList title="📚 Словничок" items={todo} learned={false} onToggle={mark} />
                </aside>
            </main>

            {open && (
                <Modal title="🎮 Навчальний тренажер" onClose={closeTrainer}>
                    {session ? (
                        <Trainer
                            session={session}
                            allWords={words}
                            onLearned={(en) => mark(en, true)}
                            onClose={() => setSession(null)}
                        />
                    ) : (
                        <div>
                            <p className="muted">Обери скільки слів хочеш вивчити та гру!</p>

                            <h4 className="label">1. Кількість слів для тренування:</h4>
                            <div className="grid">
                                {[5, 10, 15, 0].map((n) => (
                                    <button
                                        key={n}
                                        className={"choice" + (count === n ? " choice--on" : "")}
                                        onClick={() => setCount(n)}
                                    >
                                        {n || "Всі"}
                                    </button>
                                ))}
                            </div>

                            <label className="opt-check">
                                <input
                                    type="checkbox"
                                    checked={onlyNew}
                                    disabled={newCount === 0}
                                    onChange={(e) => setOnlyNewChecked(e.target.checked)}
                                />
                                <span>
                                    Тільки нові слова
                                    <span className="muted"> {newCount ? `(${newCount})` : "(немає нових)"}</span>
                                </span>
                            </label>
                            <p className="muted small-note">Без галочки беруться всі слова зі словничка.{showPicture && " Гра 4 від цього не залежить."}</p>

                            <h4 className="label">2. Оберіть інтерактивну гру:</h4>
                            {[
                                ["flash", "🎴", "Гра 1: Флеш-картки", "Перегортай та повторюй вимову"],
                                ["quiz", "🎯", "Гра 2: Вікторина", "Обери 1 правильний переклад із 4"],
                                ["build", "🧩", "Гра 3: Склади фразу", "Збери слово або фразу з літер"],
                                ["picture", "🖼️", "Гра 4: Вгадай за картинкою", "Подивись на картинку та обери слово"],
                            ].filter(([key]) => key !== "picture" || showPicture).map(([key, icon, title, desc]) => (
                                <button key={key} className="game" onClick={() => start(key)}>
                                    <span className="game__icon">{icon}</span>
                                    <span>
                                        <b>{title}</b>
                                        <span className="muted">{desc}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </Modal>
            )}
        </Shell>
    );
}

/* ?admin відкриває кабінет вчителя, ?s=anna відкриває сторінку учня */
const IS_ADMIN = new URLSearchParams(window.location.search).has("admin");

export default function App() {
    return IS_ADMIN ? <Admin /> : <Student />;
}
