const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
  process.env.JWT_SECRET || "cloudlib_secret_key_change_this";

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
  );
  next();
});

// ============================================================
// DATABASE
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

// ============================================================
// DATABASE TEST
// ============================================================

async function testDatabaseConnection() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    console.log("Connected to Neon PostgreSQL");
    console.log(
      "Database time:",
      result.rows[0].current_time
    );
  } catch (error) {
    console.error(
      "Database connection failed:",
      error.message
    );
  }
}

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const parts = authHeader.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
  ) {
    return res.status(401).json({
      message: "Invalid authorization format",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    console.error(
      "JWT verification error:",
      error.message
    );

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message: "CloudLib API is running!",
  });
});

// ============================================================
// AUTH - REGISTER
// ============================================================

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        phone,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Name, email and password are required",
        });
      }

      const existingUser =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER($1)
          `,
          [email]
        );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          message:
            "An account with this email already exists",
        });
      }

      const hashedPassword =
        await bcrypt.hash(password, 10);

      const result =
        await pool.query(
          `
          INSERT INTO users (
            name,
            email,
            password,
            phone,
            role
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'student'
          )
          RETURNING
            id,
            name,
            email,
            phone,
            role,
            created_at
          `,
          [
            name,
            email,
            hashedPassword,
            phone || null,
          ]
        );

      res.status(201).json({
        message:
          "Account created successfully",
        user: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to create account",
      });
    }
  }
);

// ============================================================
// AUTH - LOGIN
// ============================================================

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Email and password are required",
        });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM users
          WHERE LOWER(email) = LOWER($1)
          `,
          [email]
        );

      if (result.rows.length === 0) {
        return res.status(401).json({
          message:
            "Invalid email or password",
        });
      }

      const user = result.rows[0];

      const passwordMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!passwordMatch) {
        return res.status(401).json({
          message:
            "Invalid email or password",
        });
      }

      const token =
        jwt.sign(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          JWT_SECRET,
          {
            expiresIn: "7d",
          }
        );

      res.json({
        message: "Login successful",

        token,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to login",
      });
    }
  }
);

// ============================================================
// AUTH - CURRENT USER
// ============================================================

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            name,
            email,
            phone,
            role,
            created_at
          FROM users
          WHERE id = $1
          `,
          [req.user.id]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.json({
        user: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Get current user error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to get current user",
      });
    }
  }
);

// ============================================================
// BOOKS - GET ALL
// ============================================================

app.get(
  "/api/books",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            books.*,

            owner.name AS owner_name,

            CASE
              WHEN books.owner_id = $1
              THEN true
              ELSE false
            END AS is_owner

          FROM books

          LEFT JOIN users owner
            ON owner.id = books.owner_id

          ORDER BY
            books.created_at DESC,
            books.id DESC
          `,
          [req.user.id]
        );

      res.json({
        books: result.rows,
      });
    } catch (error) {
      console.error(
        "Get books error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load books",
      });
    }
  }
);

// ============================================================
// BOOKS - GET ONE
// ============================================================

app.get(
  "/api/books/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result =
        await pool.query(
          `
          SELECT
            books.*,
            owner.name AS owner_name
          FROM books
          LEFT JOIN users owner
            ON owner.id = books.owner_id
          WHERE books.id = $1
          `,
          [id]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Book not found",
        });
      }

      res.json({
        book: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Get book error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load book",
      });
    }
  }
);

// ============================================================
// BOOKS - CREATE
// ============================================================

app.post(
  "/api/books",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        title,
        author,
        isbn,
        category,
        quantity,
        available_quantity,
        rental_price,
        sale_price,
      } = req.body;

      if (
        !title ||
        !author ||
        quantity === undefined
      ) {
        return res.status(400).json({
          message:
            "Title, author and quantity are required",
        });
      }

      const totalQuantity =
        Number(quantity);

      if (
        !Number.isInteger(totalQuantity) ||
        totalQuantity <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantity must be a positive whole number",
        });
      }

      const available =
        available_quantity === undefined
          ? totalQuantity
          : Number(available_quantity);

      if (
        !Number.isInteger(available) ||
        available < 0 ||
        available > totalQuantity
      ) {
        return res.status(400).json({
          message:
            "Available quantity must be between 0 and total quantity",
        });
      }

      const rental =
        rental_price === undefined ||
        rental_price === ""
          ? 0
          : Number(rental_price);

      const sale =
        sale_price === undefined ||
        sale_price === ""
          ? 0
          : Number(sale_price);

      if (
        rental < 0 ||
        sale < 0
      ) {
        return res.status(400).json({
          message:
            "Prices cannot be negative",
        });
      }

      if (isbn) {
        const existing =
          await pool.query(
            `
            SELECT id
            FROM books
            WHERE isbn = $1
            `,
            [isbn]
          );

        if (existing.rows.length > 0) {
          return res.status(409).json({
            message:
              "A book with this ISBN already exists",
          });
        }
      }

      const result =
        await pool.query(
          `
          INSERT INTO books (
            title,
            author,
            isbn,
            category,
            quantity,
            available_quantity,
            rental_price,
            sale_price,
            owner_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
          RETURNING *
          `,
          [
            title,
            author,
            isbn || null,
            category || null,
            totalQuantity,
            available,
            rental,
            sale,
            req.user.id,
          ]
        );

      res.status(201).json({
        message:
          "Book added successfully",
        book: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create book error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to add book",
      });
    }
  }
);

// ============================================================
// BOOKS - UPDATE
// ============================================================

app.put(
  "/api/books/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        title,
        author,
        isbn,
        category,
        quantity,
        available_quantity,
        rental_price,
        sale_price,
      } = req.body;

      const existingResult =
        await pool.query(
          `
          SELECT *
          FROM books
          WHERE id = $1
          `,
          [id]
        );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          message: "Book not found",
        });
      }

      const book =
        existingResult.rows[0];

      if (
        book.owner_id &&
        Number(book.owner_id) !==
          Number(req.user.id)
      ) {
        return res.status(403).json({
          message:
            "You can only edit your own books",
        });
      }

      const newQuantity =
        quantity === undefined ||
        quantity === ""
          ? Number(book.quantity)
          : Number(quantity);

      if (
        !Number.isInteger(newQuantity) ||
        newQuantity <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantity must be a positive whole number",
        });
      }

      let newAvailable;

      if (
        available_quantity === undefined ||
        available_quantity === ""
      ) {
        const quantityDifference =
          newQuantity -
          Number(book.quantity);

        newAvailable =
          Number(book.available_quantity) +
          quantityDifference;
      } else {
        newAvailable =
          Number(available_quantity);
      }

      if (
        !Number.isInteger(newAvailable) ||
        newAvailable < 0 ||
        newAvailable > newQuantity
      ) {
        return res.status(400).json({
          message:
            "Available quantity must be between 0 and total quantity",
        });
      }

      const newRental =
        rental_price === undefined ||
        rental_price === ""
          ? Number(book.rental_price || 0)
          : Number(rental_price);

      const newSale =
        sale_price === undefined ||
        sale_price === ""
          ? Number(book.sale_price || 0)
          : Number(sale_price);

      if (
        newRental < 0 ||
        newSale < 0
      ) {
        return res.status(400).json({
          message:
            "Prices cannot be negative",
        });
      }

      if (
        isbn &&
        isbn !== book.isbn
      ) {
        const isbnCheck =
          await pool.query(
            `
            SELECT id
            FROM books
            WHERE isbn = $1
              AND id <> $2
            `,
            [isbn, id]
          );

        if (isbnCheck.rows.length > 0) {
          return res.status(409).json({
            message:
              "Another book already uses this ISBN",
          });
        }
      }

      const updatedResult =
        await pool.query(
          `
          UPDATE books
          SET
            title = $1,
            author = $2,
            isbn = $3,
            category = $4,
            quantity = $5,
            available_quantity = $6,
            rental_price = $7,
            sale_price = $8
          WHERE id = $9

          RETURNING *
          `,
          [
            title === undefined
              ? book.title
              : title,

            author === undefined
              ? book.author
              : author,

            isbn === undefined
              ? book.isbn
              : isbn || null,

            category === undefined
              ? book.category
              : category || null,

            newQuantity,
            newAvailable,
            newRental,
            newSale,
            id,
          ]
        );

      res.json({
        message:
          "Book updated successfully",

        book:
          updatedResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Update book error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update book",
      });
    }
  }
);

// ============================================================
// BOOKS - DELETE
// ============================================================

app.delete(
  "/api/books/:id",
  authenticateToken,
  async (req, res) => {
    const client =
      await pool.connect();

    let transactionStarted = false;

    try {
      const { id } = req.params;

      await client.query("BEGIN");
      transactionStarted = true;

      const result =
        await client.query(
          `
          SELECT *
          FROM books
          WHERE id = $1
          FOR UPDATE
          `,
          [id]
        );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message:
            "Book not found",
        });
      }

      const book =
        result.rows[0];

      if (
        book.owner_id &&
        Number(book.owner_id) !==
          Number(req.user.id)
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          message:
            "You can only delete your own books",
        });
      }

      const activeBorrowings =
        await client.query(
          `
          SELECT COUNT(*) AS count
          FROM borrowings
          WHERE book_id = $1
            AND status = 'borrowed'
          `,
          [id]
        );

      if (
        Number(
          activeBorrowings.rows[0].count
        ) > 0
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          message:
            "This book cannot be deleted while it is borrowed",
        });
      }

      await client.query(
        `
        DELETE FROM books
        WHERE id = $1
        `,
        [id]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      res.json({
        message:
          "Book deleted successfully",
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Rollback error:",
            rollbackError.message
          );
        }
      }

      console.error(
        "Delete book error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete book",
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// BOOK REQUESTS - CREATE
// ============================================================

app.post(
  "/api/requests",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        book_id,
        request_type,
        quantity,
        offered_price,
      } = req.body;

      if (!book_id) {
        return res.status(400).json({
          message:
            "Book ID is required",
        });
      }

      if (
        request_type !== "borrow" &&
        request_type !== "buy"
      ) {
        return res.status(400).json({
          message:
            "Request type must be borrow or buy",
        });
      }

      const requestedQuantity =
        Number(quantity || 1);

      if (
        !Number.isInteger(
          requestedQuantity
        ) ||
        requestedQuantity <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantity must be a positive whole number",
        });
      }

      const bookResult =
        await pool.query(
          `
          SELECT *
          FROM books
          WHERE id = $1
          `,
          [book_id]
        );

      if (bookResult.rows.length === 0) {
        return res.status(404).json({
          message:
            "Book not found",
        });
      }

      const book =
        bookResult.rows[0];

      if (
        book.owner_id &&
        Number(book.owner_id) ===
          Number(req.user.id)
      ) {
        return res.status(400).json({
          message:
            "You cannot request your own book",
        });
      }

      if (
        requestedQuantity >
        Number(book.available_quantity)
      ) {
        return res.status(400).json({
          message:
            `Only ${book.available_quantity} copy/copies are available`,
        });
      }

      let price = null;

      if (
        request_type === "buy"
      ) {
        if (
          !book.sale_price ||
          Number(book.sale_price) <= 0
        ) {
          return res.status(400).json({
            message:
              "This book is not currently listed for sale",
          });
        }

        price =
          offered_price === undefined ||
          offered_price === ""
            ? Number(book.sale_price)
            : Number(offered_price);

        if (price <= 0) {
          return res.status(400).json({
            message:
              "Offered price must be greater than zero",
          });
        }
      }

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM book_requests
          WHERE requester_id = $1
            AND book_id = $2
            AND request_type = $3
            AND status = 'pending'
          `,
          [
            req.user.id,
            book_id,
            request_type,
          ]
        );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          message:
            "You already have a pending request for this book",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO book_requests (
            requester_id,
            book_id,
            request_type,
            quantity,
            offered_price,
            status,
            due_date,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'pending',
            NULL,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING *
          `,
          [
            req.user.id,
            book_id,
            request_type,
            requestedQuantity,
            price,
          ]
        );

      res.status(201).json({
        message:
          request_type === "borrow"
            ? "Borrow request sent successfully"
            : "Buy request sent successfully",

        request:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create request error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to create request",
      });
    }
  }
);

// ============================================================
// REQUESTS - MY REQUESTS
// ============================================================

app.get(
  "/api/requests/my",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            br.*,

            books.title AS book_title,
            books.author AS book_author,
            books.rental_price,
            books.sale_price,
            books.owner_id,

            owner.name AS owner_name,

            requester.name AS requester_name

          FROM book_requests br

          INNER JOIN books
            ON books.id = br.book_id

          LEFT JOIN users owner
            ON owner.id = books.owner_id

          INNER JOIN users requester
            ON requester.id = br.requester_id

          WHERE br.requester_id = $1

          ORDER BY
            br.created_at DESC
          `,
          [req.user.id]
        );

      res.json({
        requests:
          result.rows,
      });
    } catch (error) {
      console.error(
        "My requests error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load your requests",
      });
    }
  }
);

// ============================================================
// REQUESTS - INCOMING
// ============================================================

app.get(
  "/api/requests/incoming",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            br.*,

            requester.name AS requester_name,

            books.title AS book_title,
            books.author AS book_author,
            books.rental_price,
            books.sale_price,
            books.owner_id,

            owner.name AS owner_name

          FROM book_requests br

          INNER JOIN users requester
            ON requester.id = br.requester_id

          INNER JOIN books
            ON books.id = br.book_id

          LEFT JOIN users owner
            ON owner.id = books.owner_id

          WHERE books.owner_id = $1

          ORDER BY
            br.created_at DESC
          `,
          [req.user.id]
        );

      res.json({
        requests:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Incoming requests error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load incoming requests",
      });
    }
  }
);

// ============================================================
// REQUESTS - GLOBAL COMMUNITY
// ============================================================

app.get(
  "/api/requests/community",
  authenticateToken,
  async (req, res) => {
    try {
      const requestsResult =
        await pool.query(
          `
          SELECT
            br.id,
            br.requester_id,
            br.book_id,
            br.request_type,
            br.quantity,
            br.offered_price,
            br.status,
            br.due_date,
            br.created_at,
            br.updated_at,

            requester.name AS requester_name,

            books.title AS book_title,
            books.author AS book_author,
            books.owner_id,

            owner.name AS owner_name,

            books.rental_price,
            books.sale_price,

            br.status AS display_status

          FROM book_requests br

          INNER JOIN users requester
            ON requester.id = br.requester_id

          INNER JOIN books
            ON books.id = br.book_id

          LEFT JOIN users owner
            ON owner.id = books.owner_id

          ORDER BY
            br.created_at DESC
          `
        );

      const salesResult =
        await pool.query(
          `
          SELECT
            books.id,
            books.title,
            books.author,
            books.isbn,
            books.category,
            books.quantity,
            books.available_quantity,
            books.sale_price,
            books.rental_price,
            books.owner_id,

            owner.name AS owner_name

          FROM books

          LEFT JOIN users owner
            ON owner.id = books.owner_id

          WHERE
            books.sale_price > 0
            AND books.available_quantity > 0

          ORDER BY
            books.created_at DESC
          `
        );

      res.json({
        requests:
          requestsResult.rows,

        sales:
          salesResult.rows,
      });
    } catch (error) {
      console.error(
        "Community error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load community data",
      });
    }
  }
);

// ============================================================
// REQUESTS - EDIT PENDING REQUEST
// ============================================================

app.put(
  "/api/requests/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        book_id,
        quantity,
        offered_price,
      } = req.body;

      const requestResult =
        await pool.query(
          `
          SELECT *
          FROM book_requests
          WHERE id = $1
          `,
          [id]
        );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          message:
            "Request not found",
        });
      }

      const request =
        requestResult.rows[0];

      if (
        Number(request.requester_id) !==
        Number(req.user.id)
      ) {
        return res.status(403).json({
          message:
            "You can only edit your own requests",
        });
      }

      if (
        request.status !== "pending"
      ) {
        return res.status(400).json({
          message:
            "Only pending requests can be edited",
        });
      }

      const newBookId =
        book_id || request.book_id;

      const newQuantity =
        quantity === undefined
          ? Number(request.quantity)
          : Number(quantity);

      if (
        !Number.isInteger(newQuantity) ||
        newQuantity <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantity must be a positive whole number",
        });
      }

      const bookResult =
        await pool.query(
          `
          SELECT *
          FROM books
          WHERE id = $1
          `,
          [newBookId]
        );

      if (bookResult.rows.length === 0) {
        return res.status(404).json({
          message:
            "Selected book not found",
        });
      }

      const book =
        bookResult.rows[0];

      if (
        Number(book.owner_id) ===
        Number(req.user.id)
      ) {
        return res.status(400).json({
          message:
            "You cannot request your own book",
        });
      }

      if (
        newQuantity >
        Number(book.available_quantity)
      ) {
        return res.status(400).json({
          message:
            `Only ${book.available_quantity} copy/copies are available`,
        });
      }

      let newPrice =
        request.offered_price;

      if (
        request.request_type === "buy"
      ) {
        if (
          !book.sale_price ||
          Number(book.sale_price) <= 0
        ) {
          return res.status(400).json({
            message:
              "This book is not available for sale",
          });
        }

        newPrice =
          offered_price === undefined ||
          offered_price === ""
            ? Number(book.sale_price)
            : Number(offered_price);

        if (newPrice <= 0) {
          return res.status(400).json({
            message:
              "Offered price must be greater than zero",
          });
        }
      }

      const result =
        await pool.query(
          `
          UPDATE book_requests
          SET
            book_id = $1,
            quantity = $2,
            offered_price = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
          `,
          [
            newBookId,
            newQuantity,
            newPrice,
            id,
          ]
        );

      res.json({
        message:
          "Request updated successfully",

        request:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Edit request error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update request",
      });
    }
  }
);

// ============================================================
// REQUESTS - CANCEL
// ============================================================

app.delete(
  "/api/requests/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result =
        await pool.query(
          `
          SELECT *
          FROM book_requests
          WHERE id = $1
          `,
          [id]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "Request not found",
        });
      }

      const request =
        result.rows[0];

      if (
        Number(request.requester_id) !==
        Number(req.user.id)
      ) {
        return res.status(403).json({
          message:
            "You can only cancel your own requests",
        });
      }

      if (
        request.status !== "pending"
      ) {
        return res.status(400).json({
          message:
            "Only pending requests can be cancelled",
        });
      }

      await pool.query(
        `
        DELETE FROM book_requests
        WHERE id = $1
        `,
        [id]
      );

      res.json({
        message:
          "Request cancelled successfully",
      });
    } catch (error) {
      console.error(
        "Cancel request error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to cancel request",
      });
    }
  }
);

// ============================================================
// REQUESTS - ACCEPT
// ============================================================

app.put(
  "/api/requests/:id/accept",
  authenticateToken,
  async (req, res) => {
    const client =
      await pool.connect();

    let transactionStarted = false;

    try {
      const { id } = req.params;

      const {
        due_date,
      } = req.body;

      await client.query("BEGIN");
      transactionStarted = true;

      const requestResult =
        await client.query(
          `
          SELECT
            br.*,

            books.title AS book_title,
            books.available_quantity,
            books.owner_id,
            books.rental_price,
            books.sale_price

          FROM book_requests br

          INNER JOIN books
            ON books.id = br.book_id

          WHERE br.id = $1

          FOR UPDATE OF br, books
          `,
          [id]
        );

      if (requestResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message:
            "Request not found",
        });
      }

      const request =
        requestResult.rows[0];

      if (
        !request.owner_id ||
        Number(request.owner_id) !==
          Number(req.user.id)
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          message:
            "You can only accept requests for your own books",
        });
      }

      if (
        request.status !== "pending"
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          message:
            "This request is no longer pending",
        });
      }

      if (
        request.request_type === "borrow"
      ) {
        if (!due_date) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            message:
              "Please provide a return date",
          });
        }

        const selectedDate =
          new Date(
            `${due_date}T00:00:00`
          );

        const today =
          new Date();

        today.setHours(
          0,
          0,
          0,
          0
        );

        if (
          Number.isNaN(
            selectedDate.getTime()
          )
        ) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            message:
              "Invalid return date",
          });
        }

        if (
          selectedDate <= today
        ) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            message:
              "Return date must be in the future",
          });
        }
      }

      if (
        Number(request.available_quantity) <
        Number(request.quantity)
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          message:
            `Only ${request.available_quantity} copy/copies are available`,
        });
      }

      // ========================================================
      // BORROW ACCEPT
      // ========================================================

      if (
        request.request_type === "borrow"
      ) {
        await client.query(
          `
          UPDATE book_requests
          SET
            status = 'accepted',
            due_date = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [
            due_date,
            id,
          ]
        );

        for (
          let i = 0;
          i < Number(request.quantity);
          i++
        ) {
          await client.query(
            `
            INSERT INTO borrowings (
              user_id,
              book_id,
              borrow_date,
              due_date,
              return_date,
              status,
              fine
            )
            VALUES (
              $1,
              $2,
              CURRENT_DATE,
              $3,
              NULL,
              'borrowed',
              0
            )
            `,
            [
              request.requester_id,
              request.book_id,
              due_date,
            ]
          );
        }

        await client.query(
          `
          UPDATE books
          SET
            available_quantity =
              available_quantity - $1
          WHERE id = $2
          `,
          [
            Number(request.quantity),
            request.book_id,
          ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.json({
          message:
            "Borrow request accepted successfully",

          request: {
            id: request.id,
            status: "accepted",
            due_date: due_date,
          },
        });
      }

      // ========================================================
      // BUY ACCEPT
      // ========================================================

      if (
        request.request_type === "buy"
      ) {
        const salePrice =
          Number(
            request.offered_price ||
            request.sale_price ||
            0
          );

        if (
          salePrice <= 0
        ) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            message:
              "Invalid sale price",
          });
        }

        await client.query(
          `
          INSERT INTO sales (
            user_id,
            book_id,
            quantity,
            sale_price,
            total_amount,
            sale_date
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            CURRENT_TIMESTAMP
          )
          `,
          [
            request.requester_id,
            request.book_id,
            Number(request.quantity),
            salePrice,
            salePrice *
              Number(request.quantity),
          ]
        );

        await client.query(
          `
          UPDATE books
          SET
            quantity =
              quantity - $1,

            available_quantity =
              available_quantity - $1,

            sale_price =
              CASE
                WHEN available_quantity - $1 <= 0
                THEN 0
                ELSE sale_price
              END
          WHERE id = $2
          `,
          [
            Number(request.quantity),
            request.book_id,
          ]
        );

        await client.query(
          `
          UPDATE book_requests
          SET
            status = 'accepted',
            due_date = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [id]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.json({
          message:
            "Buy request accepted successfully",

          request: {
            id: request.id,
            status: "accepted",
            due_date: null,
          },
        });
      }

      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        message:
          "Unsupported request type",
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Accept rollback error:",
            rollbackError.message
          );
        }
      }

      console.error(
        "Accept request error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to accept request",
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// REQUESTS - DECLINE
// ============================================================

app.put(
  "/api/requests/:id/decline",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result =
        await pool.query(
          `
          SELECT
            br.*,
            books.owner_id
          FROM book_requests br
          INNER JOIN books
            ON books.id = br.book_id
          WHERE br.id = $1
          `,
          [id]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "Request not found",
        });
      }

      const request =
        result.rows[0];

      if (
        !request.owner_id ||
        Number(request.owner_id) !==
          Number(req.user.id)
      ) {
        return res.status(403).json({
          message:
            "You can only decline requests for your own books",
        });
      }

      if (
        request.status !== "pending"
      ) {
        return res.status(400).json({
          message:
            "This request is no longer pending",
        });
      }

      const updated =
        await pool.query(
          `
          UPDATE book_requests
          SET
            status = 'declined',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      res.json({
        message:
          "Request declined successfully",

        request:
          updated.rows[0],
      });
    } catch (error) {
      console.error(
        "Decline request error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to decline request",
      });
    }
  }
);

// ============================================================
// BORROWINGS - GET MY BORROWINGS
// ============================================================

app.get(
  "/api/borrowings",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            borrowings.id,
            borrowings.user_id,
            borrowings.book_id,

            borrowings.borrow_date,
            borrowings.due_date,
            borrowings.return_date,

            borrowings.status,
            borrowings.fine,

            books.title,
            books.author,
            books.isbn,
            books.rental_price,

            users.name AS borrower_name

          FROM borrowings

          INNER JOIN books
            ON books.id = borrowings.book_id

          INNER JOIN users
            ON users.id = borrowings.user_id

          WHERE borrowings.user_id = $1

          ORDER BY
            borrowings.due_date ASC,
            borrowings.borrow_date DESC
          `,
          [req.user.id]
        );

      res.json({
        borrowings:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Get borrowings error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load borrowing activity",
      });
    }
  }
);

// ============================================================
// BORROWINGS - OWNER BORROWINGS
// ============================================================

app.get(
  "/api/borrowings/owner",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            borrowings.id,
            borrowings.user_id,
            borrowings.book_id,

            borrowings.borrow_date,
            borrowings.due_date,
            borrowings.return_date,

            borrowings.status,
            borrowings.fine,

            books.title,
            books.author,

            borrower.name AS borrower_name,

            books.owner_id,
            owner.name AS owner_name

          FROM borrowings

          INNER JOIN books
            ON books.id = borrowings.book_id

          INNER JOIN users borrower
            ON borrower.id = borrowings.user_id

          LEFT JOIN users owner
            ON owner.id = books.owner_id

          WHERE books.owner_id = $1

          ORDER BY
            borrowings.due_date ASC
          `,
          [req.user.id]
        );

      res.json({
        borrowings:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Owner borrowings error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load owner borrowing records",
      });
    }
  }
);

// ============================================================
// BORROWINGS - RETURN BOOK
// ============================================================

app.put(
  "/api/borrowings/:id/return",
  authenticateToken,
  async (req, res) => {
    const client =
      await pool.connect();

    let transactionStarted = false;

    try {
      const { id } = req.params;

      console.log(
        "RETURN REQUEST STARTED",
        {
          borrowingId: id,
          userId: req.user.id,
        }
      );

      await client.query("BEGIN");
      transactionStarted = true;

      // --------------------------------------------------------
      // Find and lock borrowing
      // --------------------------------------------------------

      const borrowingResult =
        await client.query(
          `
          SELECT
            b.*,
            books.title AS book_title,
            books.quantity AS book_quantity,
            books.available_quantity AS book_available_quantity
          FROM borrowings b
          INNER JOIN books
            ON books.id = b.book_id
          WHERE b.id = $1
          FOR UPDATE OF b, books
          `,
          [id]
        );

      console.log(
        "RETURN BORROWING RESULT:",
        borrowingResult.rows
      );

      if (
        borrowingResult.rows.length === 0
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message:
            "Borrowing record not found",
        });
      }

      const borrowing =
        borrowingResult.rows[0];

      // --------------------------------------------------------
      // Only borrower can return
      // --------------------------------------------------------

      if (
        Number(borrowing.user_id) !==
        Number(req.user.id)
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          message:
            "You can only return books borrowed by you",
        });
      }

      // --------------------------------------------------------
      // Already returned
      // --------------------------------------------------------

      if (
        borrowing.status === "returned"
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          message:
            "This book has already been returned",
        });
      }

      // --------------------------------------------------------
      // Return borrowing
      // --------------------------------------------------------

      const returnedResult =
        await client.query(
          `
          UPDATE borrowings
          SET
            status = 'returned',
            return_date = CURRENT_DATE
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      console.log(
        "BORROWING RETURNED:",
        returnedResult.rows
      );

      // --------------------------------------------------------
      // Increase available quantity
      // --------------------------------------------------------

      const bookUpdateResult =
        await client.query(
          `
          UPDATE books
          SET
            available_quantity =
              LEAST(
                quantity,
                available_quantity + 1
              )
          WHERE id = $1
          RETURNING
            id,
            title,
            quantity,
            available_quantity
          `,
          [borrowing.book_id]
        );

      console.log(
        "BOOK STOCK UPDATED:",
        bookUpdateResult.rows
      );

      if (
        bookUpdateResult.rows.length === 0
      ) {
        throw new Error(
          "Book associated with borrowing record was not found"
        );
      }

      // --------------------------------------------------------
      // IMPORTANT:
      //
      // DO NOT update book_requests.status to 'returned'.
      //
      // Your database check constraint does not allow
      // 'returned' as a value for book_requests.status.
      //
      // The borrowing record itself already stores:
      // status = 'returned'
      //
      // Therefore the accepted request is left as
      // 'accepted', while the actual borrowing record
      // correctly becomes 'returned'.
      // --------------------------------------------------------

      await client.query("COMMIT");
      transactionStarted = false;

      console.log(
        "RETURN REQUEST COMPLETED SUCCESSFULLY"
      );

      return res.json({
        message:
          "Book returned successfully",
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "RETURN ROLLBACK ERROR:",
            rollbackError.message
          );
        }
      }

      console.error(
        "RETURN BOOK ERROR:",
        error
      );

      console.error(
        "RETURN BOOK ERROR MESSAGE:",
        error.message
      );

      console.error(
        "RETURN BOOK ERROR CODE:",
        error.code
      );

      console.error(
        "RETURN BOOK ERROR DETAIL:",
        error.detail
      );

      return res.status(500).json({
        message:
          "Failed to return book",
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message,
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// SALES - MY SALES
// ============================================================

app.get(
  "/api/sales",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            sales.*,

            books.title,
            books.author,

            buyer.name AS buyer_name

          FROM sales

          INNER JOIN books
            ON books.id = sales.book_id

          INNER JOIN users buyer
            ON buyer.id = sales.user_id

          INNER JOIN users seller
            ON seller.id = books.owner_id

          WHERE books.owner_id = $1

          ORDER BY
            sales.sale_date DESC
          `,
          [req.user.id]
        );

      res.json({
        sales:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Sales error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load sales",
      });
    }
  }
);

// ============================================================
// SALES - MY PURCHASES
// ============================================================

app.get(
  "/api/sales/purchases",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            sales.*,

            books.title,
            books.author,

            seller.name AS seller_name

          FROM sales

          INNER JOIN books
            ON books.id = sales.book_id

          LEFT JOIN users seller
            ON seller.id = books.owner_id

          WHERE sales.user_id = $1

          ORDER BY
            sales.sale_date DESC
          `,
          [req.user.id]
        );

      res.json({
        purchases:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Purchases error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load purchases",
      });
    }
  }
);

// ============================================================
// DASHBOARD STATS
// ============================================================

app.get(
  "/api/dashboard/stats",
  authenticateToken,
  async (req, res) => {
    try {
      const totalBooks =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM books
          `
        );

      const totalCopies =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(quantity),
              0
            ) AS count
          FROM books
          `
        );

      const availableCopies =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(available_quantity),
              0
            ) AS count
          FROM books
          `
        );

      const myBorrowed =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM borrowings
          WHERE user_id = $1
            AND status = 'borrowed'
          `,
          [req.user.id]
        );

      const myRequests =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM book_requests
          WHERE requester_id = $1
            AND status = 'pending'
          `,
          [req.user.id]
        );

      const incomingRequests =
        await pool.query(
          `
          SELECT COUNT(*) AS count

          FROM book_requests br

          INNER JOIN books
            ON books.id = br.book_id

          WHERE books.owner_id = $1
            AND br.status = 'pending'
          `,
          [req.user.id]
        );

      const myBooks =
        await pool.query(
          `
          SELECT COUNT(*) AS count
          FROM books
          WHERE owner_id = $1
          `,
          [req.user.id]
        );

      res.json({
        totalBooks:
          Number(
            totalBooks.rows[0].count
          ),

        totalCopies:
          Number(
            totalCopies.rows[0].count
          ),

        availableCopies:
          Number(
            availableCopies.rows[0].count
          ),

        myBorrowed:
          Number(
            myBorrowed.rows[0].count
          ),

        myRequests:
          Number(
            myRequests.rows[0].count
          ),

        incomingRequests:
          Number(
            incomingRequests.rows[0].count
          ),

        myBooks:
          Number(
            myBooks.rows[0].count
          ),
      });
    } catch (error) {
      console.error(
        "Dashboard stats error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load dashboard statistics",
      });
    }
  }
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {
    console.log(
      "404 API ENDPOINT:",
      req.method,
      req.originalUrl
    );

    res.status(404).json({
      message:
        "API endpoint not found",
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      message:
        "Internal server error",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  await testDatabaseConnection();

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `CloudLib server running on port ${PORT}`
      );
    }
  );
}

startServer();