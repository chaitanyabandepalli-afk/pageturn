const path = require("node:path");
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");

const dbPath = process.env.PAGETURN_DB_PATH || path.join(__dirname, "..", "pageturn.db");

const dbPromise = sqlite.open({
    filename: dbPath,
    driver: sqlite3.Database
});

const initializeDatabase = async () => {
    const db = await dbPromise;

    await db.exec("PRAGMA foreign_keys = ON");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS readers (
            reader_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS books (
            book_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            genre TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS loans (
            loan_id INTEGER PRIMARY KEY AUTOINCREMENT,
            reader_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'done')),
            FOREIGN KEY (reader_id) REFERENCES readers(reader_id),
            FOREIGN KEY (book_id) REFERENCES books(book_id)
        );
    `);

    await db.run(
        `INSERT INTO readers (name, email)
         SELECT 'Ravi', 'ravi@gmail.com'
         WHERE NOT EXISTS (SELECT 1 FROM readers)`
    );
    await db.run(
        `INSERT INTO readers (name, email)
         SELECT 'Sita', 'sita@gmail.com'
         WHERE NOT EXISTS (SELECT 1 FROM readers WHERE email = 'sita@gmail.com')`
    );
    await db.run(
        `INSERT INTO readers (name, email)
         SELECT 'Arjun', 'arjun@gmail.com'
         WHERE NOT EXISTS (SELECT 1 FROM readers WHERE email = 'arjun@gmail.com')`
    );

    await db.run(
        `INSERT INTO books (name, genre)
         SELECT 'Wings of Fire', 'Biography'
         WHERE NOT EXISTS (SELECT 1 FROM books)`
    );
    await db.run(
        `INSERT INTO books (name, genre)
         SELECT 'The Alchemist', 'Fiction'
         WHERE NOT EXISTS (SELECT 1 FROM books WHERE name = 'The Alchemist')`
    );
    await db.run(
        `INSERT INTO books (name, genre)
         SELECT 'A Brief History of Time', 'Science'
         WHERE NOT EXISTS (SELECT 1 FROM books WHERE name = 'A Brief History of Time')`
    );
    await db.run(
        `INSERT INTO books (name, genre)
         SELECT 'Rich Dad Poor Dad', 'Finance'
         WHERE NOT EXISTS (SELECT 1 FROM books WHERE name = 'Rich Dad Poor Dad')`
    );

    const sampleLoans = [
        ["ravi@gmail.com", "Wings of Fire", "pending"],
        ["sita@gmail.com", "The Alchemist", "approved"],
        ["arjun@gmail.com", "A Brief History of Time", "done"]
    ];

    for (const [email, bookName, status] of sampleLoans) {
        await db.run(
            `INSERT INTO loans (reader_id, book_id, status)
             SELECT readers.reader_id, books.book_id, ?
             FROM readers
             CROSS JOIN books
             WHERE readers.email = ? AND books.name = ?
               AND NOT EXISTS (
                   SELECT 1 FROM loans
                   WHERE reader_id = readers.reader_id
                     AND book_id = books.book_id
               )`,
            [status, email, bookName]
        );
    }

    return db;
};

module.exports = {
    dbPromise,
    initializeDatabase
};
