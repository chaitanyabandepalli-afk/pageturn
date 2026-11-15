const readline = require("node:readline");
const { dbPromise, initializeDatabase } = require("./config/database");

const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "pageturn> "
});

let pendingSql = "";

const runSql = async (sql) => {
    const statement = sql.trim();
    if (!statement) {
        return;
    }

    if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(statement)) {
        const rows = await (await dbPromise).all(statement);
        console.table(rows);
        return;
    }

    const result = await (await dbPromise).run(statement);
    console.log(`Success. Rows changed: ${result.changes ?? 0}`);
    if (result.lastID !== undefined) {
        console.log(`New row ID: ${result.lastID}`);
    }
};

const startShell = () => {
    console.log("PageTurn Library SQL prompt");
    console.log("Enter SQL ending with a semicolon. Type .tables, .help, or .exit.");
    let commandQueue = initializeDatabase();

    prompt.on("line", (input) => {
        commandQueue = commandQueue.then(async () => {
            const line = input.trim();

            if (!pendingSql && line === ".exit") {
                prompt.close();
                return;
            }

            if (!pendingSql && line === ".help") {
                console.log("Examples:");
                console.log("  SELECT * FROM books;");
                console.log("  INSERT INTO books (name, genre) VALUES ('Dune', 'Science Fiction');");
                console.log("  UPDATE books SET genre = 'Fiction' WHERE book_id = 1;");
                console.log("  .tables");
                console.log("  .exit");
                if (!prompt.closed) {
                    prompt.prompt();
                }
                return;
            }

            if (!pendingSql && line === ".tables") {
                try {
                    const rows = await (await dbPromise).all(
                        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                    );
                    console.log(rows.map((row) => row.name).join("\n"));
                } catch (error) {
                    console.error(`SQL error: ${error.message}`);
                }
                if (!prompt.closed) {
                    prompt.prompt();
                }
                return;
            }

            pendingSql += `${input}\n`;
            if (!pendingSql.trimEnd().endsWith(";")) {
                prompt.setPrompt("      ...> ");
                if (!prompt.closed) {
                    prompt.prompt();
                }
                return;
            }

            try {
                await runSql(pendingSql);
            } catch (error) {
                console.error(`SQL error: ${error.message}`);
            } finally {
                pendingSql = "";
                prompt.setPrompt("pageturn> ");
                if (!prompt.closed) {
                    prompt.prompt();
                }
            }
        }).catch((error) => {
            console.error(`SQL shell error: ${error.message}`);
            process.exitCode = 1;
            prompt.close();
        });
    });

    prompt.on("close", () => {
        commandQueue = commandQueue.then(async () => {
            const db = await dbPromise;
            await db.close();
            console.log("Closed PageTurn Library database.");
        }).catch((error) => {
            console.error(`Could not close the database: ${error.message}`);
            process.exitCode = 1;
        });
    });

    prompt.prompt();
};

startShell();
