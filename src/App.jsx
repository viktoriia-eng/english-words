import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Admin from "./Admin.jsx";

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
        { en: "cat", uk: "кіт" },
        { en: "dog", uk: "собака" },
        { en: "book", uk: "книга" },
        { en: "school bag", uk: "рюкзак" },
        { en: "friend", uk: "друг" },
        { en: "sun", uk: "сонце" },
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

function pickVoice() {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    return (
        voices.find((v) => /Google US English|Aria|Jenny|Samantha/i.test(v.name)) || voices[0]
    );
}

function speak(text) {
    try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 0.85;
        const v = pickVoice();
        if (v) u.voice = v;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    } catch {
        /* голос недоступний */
    }
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
                <button className="btn btn--ghost" onClick={() => speak(word.en)}>🔊 Вимова</button>
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

    const pick = (i) => {
        if (picked !== null) return;
        setPicked(i);
        speak(word.en);
        setTimeout(() => onNext(options[i] === word.uk), 900);
    };

    return (
        <>
            <h2 className="center big">
                {word.en}
                <button className="icon" onClick={() => speak(word.en)} aria-label="Вимова">🔊</button>
            </h2>
            <div className="grid">
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
            onLearned(word.en);
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
                <div className="row" key={w.en}>
                    <div>
                        <div className="en">{w.en}</div>
                        <div className="muted">{w.uk}</div>
                    </div>
                    <div>
                        <button className="icon" onClick={() => speak(w.en)} aria-label="Вимова">🔊</button>
                        <button
                            className="icon"
                            onClick={() => onToggle(w.en, !learned)}
                            aria-label={learned ? "Повернути у словничок" : "Позначити вивченим"}
                        >
                            {learned ? "↩️" : "✅"}
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

    // закриття вікна завершує і поточне тренування
    const closeTrainer = useCallback(() => {
        setOpen(false);
        setSession(null);
    }, []);

    if (student.status === "loading") {
        return <Shell><div className="card center muted">Завантаження…</div></Shell>;
    }
    if (student.status === "error") {
        return <Shell><div className="card center">Сторінку не знайдено. Перевір посилання.</div></Shell>;
    }

    const { name, words: rawWords } = student.data;
    const words = rawWords.map((w) => ({ ...w, learned: learnedList.includes(w.en) }));
    const learned = words.filter((w) => w.learned);
    const todo = words.filter((w) => !w.learned);

    const start = (game) => {
        let pool = todo.length ? todo : words;
        if (!pool.length) return alert("Поки немає слів 🙂");
        pool = shuffle(pool);
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

                            <h4 className="label">2. Оберіть інтерактивну гру:</h4>
                            {[
                                ["flash", "🎴", "Гра 1: Флеш-картки", "Перегортай та повторюй вимову"],
                                ["quiz", "🎯", "Гра 2: Вікторина", "Обери 1 правильний переклад із 4"],
                                ["build", "🧩", "Гра 3: Склади фразу", "Збери слово або фразу з літер"],
                            ].map(([key, icon, title, desc]) => (
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
