# PageTurn Library API

A Node.js, Express, and SQLite backend for managing readers, books, and book loans.

## Run locally

Open the PageTurnLibrary folder in VS Code, then open **Terminal → New Terminal** and run:

```powershell
npm install
npm start
```

The API starts at `http://localhost:3000`. On the first run, it creates `pageturn.db`, its tables, and sample readers, books, and loans. Set `PORT` to use another port.

## API routes

| Method | Route | Description |
|---|---|---|
| GET | `/readers` | List readers |
| GET | `/readers/:id` | Get a reader |
| POST | `/readers` | Add a reader (`name`, `email`) |
| GET | `/books` | List books |
| GET | `/books?genre=Science` | Search books by genre |
| GET | `/books/:id` | Get a book |
| POST | `/books` | Add a book (`name`, `genre`) |
| PUT | `/books/:id` | Update a book (`name`, `genre`) |
| DELETE | `/books/:id` | Delete a book if it has no loans |
| GET | `/loans` | List loans |
| GET | `/loans/:id` | Get a loan |
| POST | `/loans` | Create a loan (`reader_id`, `book_id`); starts as `pending` |
| GET | `/loans/details` | List loans with reader and book names |
| PATCH | `/loans/:id/status` | Advance `pending` → `approved` → `done` |

Send JSON request bodies with the `Content-Type: application/json` header.

## Example requests

Create a book:

```json
{
  "name": "Harry Potter",
  "genre": "Fantasy"
}
```

Advance a loan:

```json
{
  "status": "approved"
}
```

## Tests

```powershell
npm test
```

Tests use a temporary SQLite database and leave the normal `pageturn.db` untouched.

## Add or update records directly with SQL

Open a VS Code terminal in the project folder and run:

```powershell
npm run db
```

At the `pageturn>` prompt, enter SQL statements ending with a semicolon:

```sql
INSERT INTO books (name, genre) VALUES ('Dune', 'Science Fiction');
SELECT * FROM books;
```

To add a loan for reader ID 1 and the book named Dune:

```sql
INSERT INTO loans (reader_id, book_id)
SELECT 1, book_id FROM books WHERE name = 'Dune';
SELECT * FROM loans;
```

Use `.tables` to list tables, `.help` for examples, and `.exit` to leave the SQL prompt. The database prompt creates tables and sample rows on first use. If the server is also running, refresh the API route to see the changes.
