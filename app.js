const express = require("express");
const { dbPromise, initializeDatabase } = require("./config/database");

// Requirement 1: Express server setup and JSON request-body support.
// Requirement 2: SQLite connection and table setup are in config/database.js.
const app = express();
app.use(express.json());

const validId = (value) => /^\d+$/.test(value) && Number(value) > 0;
const cleanText = (value) => typeof value === "string" ? value.trim() : "";

app.get("/", (req, res) => {
    res.status(200).json({
        name: "PageTurn Library API",
        endpoints: ["/readers", "/books", "/loans", "/loans/details"]
    });
});

// Reader routes: list, view, and add readers.
app.get("/readers", async (req, res) => {
    const db = await dbPromise;
    const readers = await db.all("SELECT * FROM readers ORDER BY reader_id");
    res.status(200).json(readers);
});

app.get("/readers/:id", async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Reader ID must be a positive integer" });
    }

    const db = await dbPromise;
    const reader = await db.get(
        "SELECT * FROM readers WHERE reader_id = ?",
        [Number(req.params.id)]
    );

    if (!reader) {
        return res.status(404).json({ error: "Reader not found" });
    }

    res.status(200).json(reader);
});

app.post("/readers", async (req, res) => {
    const name = cleanText(req.body?.name);
    const email = cleanText(req.body?.email);

    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
    }

    const db = await dbPromise;
    const result = await db.run(
        "INSERT INTO readers (name, email) VALUES (?, ?)",
        [name, email]
    );

    res.status(201).json({
        readerId: result.lastID,
        message: "Reader added successfully"
    });
});

// Requirement 6: Book search uses the genre query parameter; without it, list all books.
app.get("/books", async (req, res) => {
    const db = await dbPromise;
    const genre = typeof req.query.genre === "string" ? req.query.genre.trim() : "";
    const books = genre
        ? await db.all(
            "SELECT * FROM books WHERE genre LIKE ? ORDER BY book_id",
            [`%${genre}%`]
        )
        : await db.all("SELECT * FROM books ORDER BY book_id");

    res.status(200).json(books);
});

// Requirement 3: Book CRUD - read one book.
app.get("/books/:id", async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Book ID must be a positive integer" });
    }

    const db = await dbPromise;
    const book = await db.get(
        "SELECT * FROM books WHERE book_id = ?",
        [Number(req.params.id)]
    );

    if (!book) {
        return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json(book);
});

// Requirement 3: Book CRUD - create a book.
// Requirement 5: Validate that both the name and genre contain non-whitespace text.
app.post("/books", async (req, res) => {
    const name = cleanText(req.body?.name);
    const genre = cleanText(req.body?.genre);

    if (!name) {
        return res.status(400).json({ error: "Book name is required" });
    }
    if (!genre) {
        return res.status(400).json({ error: "Book genre is required" });
    }

    const db = await dbPromise;
    const result = await db.run(
        "INSERT INTO books (name, genre) VALUES (?, ?)",
        [name, genre]
    );

    res.status(201).json({
        bookId: result.lastID,
        message: "Book added successfully"
    });
});

// Requirement 3: Book CRUD - update a book.
// Requirement 5: Apply the same name and genre validation when updating.
app.put("/books/:id", async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Book ID must be a positive integer" });
    }

    const name = cleanText(req.body?.name);
    const genre = cleanText(req.body?.genre);

    if (!name) {
        return res.status(400).json({ error: "Book name is required" });
    }
    if (!genre) {
        return res.status(400).json({ error: "Book genre is required" });
    }

    const db = await dbPromise;
    const result = await db.run(
        "UPDATE books SET name = ?, genre = ? WHERE book_id = ?",
        [name, genre, Number(req.params.id)]
    );

    if (result.changes === 0) {
        return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json({ message: "Book updated successfully" });
});

// Requirement 3: Book CRUD - delete a book; reject deletion when loans reference it.
app.delete("/books/:id", async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Book ID must be a positive integer" });
    }

    const db = await dbPromise;
    try {
        const result = await db.run(
            "DELETE FROM books WHERE book_id = ?",
            [Number(req.params.id)]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: "Book not found" });
        }
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT" &&
            error.message.includes("FOREIGN KEY constraint failed")) {
            return res.status(409).json({ error: "Cannot delete a book linked to a loan" });
        }
        throw error;
    }

    res.status(200).json({ message: "Book deleted successfully" });
});

// Loan routes: list loans, show one loan, and create pending loans.
app.get("/loans", async (req, res) => {
    const db = await dbPromise;
    const loans = await db.all("SELECT * FROM loans ORDER BY loan_id");
    res.status(200).json(loans);
});

// Requirement 4: JOIN readers and books so the response includes their names.
// Keep this before /loans/:id so "details" is handled by this route.
app.get("/loans/details", async (req, res) => {
    const db = await dbPromise;
    const details = await db.all(`
        SELECT
            loans.loan_id,
            readers.name AS reader_name,
            books.name AS book_name,
            loans.status
        FROM loans
        INNER JOIN readers ON loans.reader_id = readers.reader_id
        INNER JOIN books ON loans.book_id = books.book_id
        ORDER BY loans.loan_id
    `);

    res.status(200).json(details);
});

app.get("/loans/:id", async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Loan ID must be a positive integer" });
    }

    const db = await dbPromise;
    const loan = await db.get(
        "SELECT * FROM loans WHERE loan_id = ?",
        [Number(req.params.id)]
    );

    if (!loan) {
        return res.status(404).json({ error: "Loan not found" });
    }

    res.status(200).json(loan);
});

app.post("/loans", async (req, res) => {
    const readerId = req.body?.reader_id;
    const bookId = req.body?.book_id;

    if (!Number.isInteger(readerId) || readerId < 1 ||
        !Number.isInteger(bookId) || bookId < 1) {
        return res.status(400).json({
            error: "Reader ID and Book ID must be positive integers"
        });
    }

    const db = await dbPromise;
    const reader = await db.get(
        "SELECT reader_id FROM readers WHERE reader_id = ?",
        [readerId]
    );
    if (!reader) {
        return res.status(404).json({ error: "Reader not found" });
    }

    const book = await db.get(
        "SELECT book_id FROM books WHERE book_id = ?",
        [bookId]
    );
    if (!book) {
        return res.status(404).json({ error: "Book not found" });
    }

    const result = await db.run(
        "INSERT INTO loans (reader_id, book_id, status) VALUES (?, ?, 'pending')",
        [readerId, bookId]
    );

    res.status(201).json({
        loanId: result.lastID,
        status: "pending",
        message: "Loan added successfully"
    });
});

// Requirement 7 - special twist: only allow pending -> approved -> done.
app.patch("/loans/:id/status", async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Loan ID must be a positive integer" });
    }

    const db = await dbPromise;
    const loanId = Number(req.params.id);
    const loan = await db.get(
        "SELECT status FROM loans WHERE loan_id = ?",
        [loanId]
    );

    if (!loan) {
        return res.status(404).json({ error: "Loan not found" });
    }

    const validNextStatus = {
        pending: "approved",
        approved: "done"
    };

    if (validNextStatus[loan.status] !== req.body?.status) {
        return res.status(400).json({ error: "Invalid status change" });
    }

    await db.run(
        "UPDATE loans SET status = ? WHERE loan_id = ?",
        [req.body.status, loanId]
    );

    res.status(200).json({
        message: "Loan status updated successfully",
        status: req.body.status
    });
});

app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Shared handling for malformed JSON and unexpected API errors.
app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) {
        return next(error);
    }
    res.status(error.status || 500).json({
        error: error.status === 400 ? "Invalid JSON request body" : "Internal server error"
    });
});

const startServer = async () => {
    await initializeDatabase();
    const port = Number(process.env.PORT) || 3000;
    return app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
};

if (require.main === module) {
    startServer().catch((error) => {
        console.error("Failed to start PageTurn Library API:", error);
        process.exitCode = 1;
    });
}

module.exports = { app, startServer };
