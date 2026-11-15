const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");

const testDbPath = path.join(os.tmpdir(), `pageturn-library-test-${process.pid}.db`);
process.env.PAGETURN_DB_PATH = testDbPath;

const { app } = require("../app");
const { dbPromise, initializeDatabase } = require("../config/database");

let server;
let baseUrl;

before(async () => {
    await initializeDatabase();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
    const db = await dbPromise;
    await db.close();
    for (const suffix of ["", "-shm", "-wal"]) {
        const filePath = `${testDbPath}${suffix}`;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

const request = async (route, options) => {
    const response = await fetch(`${baseUrl}${route}`, options);
    return {
        status: response.status,
        body: await response.json()
    };
};

test("lists seeded readers, books, and joined loan details", async () => {
    const readers = await request("/readers");
    const reader = await request("/readers/1");
    const books = await request("/books");
    const book = await request("/books/1");
    const details = await request("/loans/details");

    assert.equal(readers.status, 200);
    assert.equal(readers.body.length, 3);
    assert.equal(reader.status, 200);
    assert.equal(reader.body.name, "Ravi");
    assert.equal(books.status, 200);
    assert.equal(books.body.length, 4);
    assert.equal(book.status, 200);
    assert.equal(book.body.name, "Wings of Fire");
    assert.equal(details.status, 200);
    assert.equal(details.body[0].reader_name, "Ravi");
    assert.equal(details.body[0].book_name, "Wings of Fire");
});

test("creates and retrieves a reader", async () => {
    const created = await request("/readers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            name: "Test Reader",
            email: `test-reader-${process.pid}@example.com`
        })
    });
    assert.equal(created.status, 201);

    const reader = await request(`/readers/${created.body.readerId}`);
    assert.equal(reader.status, 200);
    assert.equal(reader.body.name, "Test Reader");
});

test("validates books, creates and searches by genre, and updates a book", async () => {
    const invalid = await request("/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: " ", genre: "Science" })
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "Book name is required");

    const created = await request("/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test Book", genre: "Fantasy" })
    });
    assert.equal(created.status, 201);

    const linkedDelete = await request("/books/1", { method: "DELETE" });
    assert.equal(linkedDelete.status, 409);

    const search = await request("/books?genre=fantasy");
    assert.equal(search.status, 200);
    assert.equal(search.body.length, 1);
    assert.equal(search.body[0].name, "Test Book");

    const updated = await request(`/books/${created.body.bookId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated Test Book", genre: "Fantasy" })
    });
    assert.equal(updated.status, 200);

    const deleted = await request(`/books/${created.body.bookId}`, {
        method: "DELETE"
    });
    assert.equal(deleted.status, 200);
});

test("creates loans and only advances their status one step", async () => {
    const created = await request("/loans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reader_id: 1, book_id: 2 })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "pending");

    const loans = await request("/loans");
    const loan = await request(`/loans/${created.body.loanId}`);
    assert.equal(loans.status, 200);
    assert.equal(loan.status, 200);

    const skipped = await request(`/loans/${created.body.loanId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" })
    });
    assert.equal(skipped.status, 400);

    const approved = await request(`/loans/${created.body.loanId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "approved" })
    });
    assert.equal(approved.status, 200);

    const completed = await request(`/loans/${created.body.loanId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" })
    });
    assert.equal(completed.status, 200);

    const reverse = await request("/loans/2/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "pending" })
    });
    assert.equal(reverse.status, 400);
    assert.equal(reverse.body.error, "Invalid status change");
});
