import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Sell.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Sell() {
  const navigate = useNavigate();

  const token = localStorage.getItem("cloudlib_token");

  const [books, setBooks] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadBooks();
  }, [token, navigate]);

  async function loadBooks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/books`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load books.");
      }

      const ownBooks = (data.books || []).filter(
        (book) => book.is_owner
      );

      setBooks(ownBooks);

      const initialData = {};

      ownBooks.forEach((book) => {
        initialData[book.id] = {
          price: Number(book.sale_price || 0),
          quantity: Number(
            book.sale_quantity || 0
          ),
        };
      });

      setFormData(initialData);
    } catch (err) {
      setError(
        err.message || "Unable to load your books."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(bookId, field, value) {
    setFormData((previous) => ({
      ...previous,
      [bookId]: {
        ...previous[bookId],
        [field]: value,
      },
    }));
  }

  async function sellBook(book) {
    const price = Number(
      formData[book.id]?.price || 0
    );

    const quantity = Number(
      formData[book.id]?.quantity || 0
    );

    if (!Number.isFinite(price) || price <= 0) {
      setError(
        "Enter a selling price greater than ₹0."
      );
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setError(
        "Enter a valid quantity greater than 0."
      );
      return;
    }

    if (
      quantity >
      Number(book.available_quantity)
    ) {
      setError(
        `You only have ${book.available_quantity} copies available.`
      );
      return;
    }

    setSavingId(book.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/books/${book.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sale_price: price,
            sale_quantity: quantity,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to list the book for sale."
        );
      }

      setMessage(
        `"${book.title}" has been listed for sale.`
      );

      await loadBooks();
    } catch (err) {
      setError(
        err.message ||
          "Unable to list the book for sale."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function removeListing(book) {
    setSavingId(book.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/books/${book.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sale_price: 0,
            sale_quantity: 0,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to remove the listing."
        );
      }

      setMessage(
        `"${book.title}" has been removed from sale.`
      );

      await loadBooks();
    } catch (err) {
      setError(
        err.message ||
          "Unable to remove the listing."
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="sell-loading">
        <div className="sell-loading-card">
          Loading your books...
        </div>
      </div>
    );
  }

  return (
    <div className="sell-page">

      <main className="sell-container">

        <div className="sell-top">
          <div>
            <span className="sell-eyebrow">
              SELLING
            </span>

            <h1>Sell a Book</h1>

            <p>
              Choose one of your books, select how many
              copies you want to sell, set the price,
              and publish the listing to the CloudLib
              community.
            </p>
          </div>

          <button
            className="sell-back-button"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>

        {message && (
          <div className="sell-message">
            {message}
          </div>
        )}

        {error && (
          <div className="sell-error">
            {error}
          </div>
        )}

        <div className="sell-layout">

          <section className="sell-books-card">

            <div className="sell-card-heading">

              <div className="sell-heading-icon">
                S
              </div>

              <div>
                <h2>Your Books</h2>

                <p>
                  Choose a book, quantity and selling
                  price.
                </p>
              </div>

            </div>

            {books.length === 0 ? (
              <div className="sell-empty">

                <h3>
                  You have no books yet
                </h3>

                <p>
                  Add a book from your dashboard first.
                </p>

                <button
                  onClick={() =>
                    navigate("/dashboard")
                  }
                >
                  Go to Dashboard
                </button>

              </div>
            ) : (

              <div className="sell-book-list">

                {books.map((book) => {

                  const current =
                    formData[book.id] || {
                      price: 0,
                      quantity: 0,
                    };

                  const listed =
                    Number(book.sale_price || 0) >
                      0 &&
                    Number(
                      book.sale_quantity || 0
                    ) > 0;

                  return (
                    <article
                      className="sell-book-row"
                      key={book.id}
                    >

                      <div className="sell-book-icon">
                        {book.title
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="sell-book-details">

                        <h3>
                          {book.title}
                        </h3>

                        <p>
                          {book.author}
                        </p>

                        <span>
                          Available copies:{" "}
                          {book.available_quantity}
                        </span>

                        {listed && (
                          <strong>
                            Currently listed:{" "}
                            {book.sale_quantity}{" "}
                            copies at ₹
                            {Number(
                              book.sale_price
                            ).toFixed(2)}{" "}
                            each
                          </strong>
                        )}

                      </div>

                      <div className="sell-controls">

                        <div className="sell-field">

                          <label>
                            Quantity to Sell
                          </label>

                          <input
                            type="number"
                            min="1"
                            max={
                              book.available_quantity
                            }
                            value={
                              current.quantity
                            }
                            onChange={(event) =>
                              updateField(
                                book.id,
                                "quantity",
                                event.target.value
                              )
                            }
                          />

                          <small>
                            Maximum:{" "}
                            {
                              book.available_quantity
                            }
                          </small>

                        </div>

                        <div className="sell-field">

                          <label>
                            Selling Price (₹)
                          </label>

                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={
                              current.price
                            }
                            onChange={(event) =>
                              updateField(
                                book.id,
                                "price",
                                event.target.value
                              )
                            }
                          />

                        </div>

                        <button
                          className="sell-this-button"
                          onClick={() =>
                            sellBook(book)
                          }
                          disabled={
                            savingId === book.id
                          }
                        >
                          {savingId === book.id
                            ? "Saving..."
                            : listed
                            ? "Update Listing"
                            : "Sell This Book"}
                        </button>

                        {listed && (
                          <button
                            className="sell-remove-button"
                            onClick={() =>
                              removeListing(book)
                            }
                            disabled={
                              savingId === book.id
                            }
                          >
                            Remove Listing
                          </button>
                        )}

                      </div>

                    </article>
                  );
                })}

              </div>
            )}

          </section>

          <aside className="sell-info-card">

            <span className="sell-eyebrow">
              HOW IT WORKS
            </span>

            <h2>
              Selling process
            </h2>

            <div className="sell-step">
              <b>1</b>

              <div>
                <strong>
                  Choose your book
                </strong>

                <p>
                  Select a book owned by your account.
                </p>
              </div>
            </div>

            <div className="sell-step">
              <b>2</b>

              <div>
                <strong>
                  Select quantity
                </strong>

                <p>
                  Decide how many available copies
                  you want to sell.
                </p>
              </div>
            </div>

            <div className="sell-step">
              <b>3</b>

              <div>
                <strong>
                  Set the price
                </strong>

                <p>
                  Enter the price for one copy.
                </p>
              </div>
            </div>

            <div className="sell-step">
              <b>4</b>

              <div>
                <strong>
                  Sell This Book
                </strong>

                <p>
                  Your listing becomes visible to
                  everyone on the Community page.
                </p>
              </div>
            </div>

          </aside>

        </div>

      </main>

    </div>
  );
}

export default Sell;