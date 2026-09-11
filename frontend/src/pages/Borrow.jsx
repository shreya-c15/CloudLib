import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Borrow.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function Borrow() {
  const navigate = useNavigate();

  const token = localStorage.getItem("cloudlib_token");

  const [books, setBooks] = useState([]);
  const [myRequests, setMyRequests] = useState([]);

  const [selectedBook, setSelectedBook] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadData();
  }, [token, navigate]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [booksResponse, requestsResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/books`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          fetch(`${API_URL}/api/requests/my`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

      const booksData = await booksResponse.json();
      const requestsData = await requestsResponse.json();

      if (!booksResponse.ok) {
        throw new Error(
          booksData.message || "Failed to load books"
        );
      }

      if (!requestsResponse.ok) {
        throw new Error(
          requestsData.message ||
            "Failed to load requests"
        );
      }

      setBooks(
        Array.isArray(booksData.books)
          ? booksData.books
          : []
      );

      setMyRequests(
        Array.isArray(requestsData.requests)
          ? requestsData.requests
          : []
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to connect to CloudLib server."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrowRequest(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!selectedBook) {
      setError("Please select a book.");
      return;
    }

    if (Number(quantity) < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_URL}/api/requests`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            book_id: Number(selectedBook),
            request_type: "borrow",
            quantity: Number(quantity),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to send borrowing request."
        );
      }

      setMessage(
        "Borrowing request sent successfully."
      );

      setSelectedBook("");
      setQuantity(1);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to send borrowing request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const availableBooks = books.filter(
    (book) => Number(book.available_quantity) > 0
  );

  const borrowRequests = myRequests.filter(
    (request) =>
      request.request_type === "borrow"
  );

  if (loading) {
    return (
      <div className="borrow-loading">
        <div className="borrow-loading-card">
          <div className="borrow-spinner"></div>
          <p>Loading borrowing options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="borrow-page">

      <header className="borrow-header">

        <div className="borrow-brand">

          <button
            className="back-button"
            onClick={() => navigate("/dashboard")}
          >
            ←
          </button>

          <div className="brand-mark">
            C
          </div>

          <div>
            <h1>CloudLib</h1>
            <p>Borrow a Book</p>
          </div>

        </div>

        <button
          className="dashboard-button"
          onClick={() => navigate("/dashboard")}
        >
          Dashboard
        </button>

      </header>


      <main className="borrow-container">

        <section className="borrow-intro">

          <span className="eyebrow">
            BORROWING
          </span>

          <h2>
            Request a book
          </h2>

          <p>
            Choose an available book and send a
            borrowing request to its owner.
          </p>

        </section>


        {message && (
          <div className="success-banner">
            {message}
          </div>
        )}


        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}


        <section className="borrow-grid">

          <div className="borrow-form-card">

            <div className="card-heading">

              <span className="card-icon">
                B
              </span>

              <div>
                <h3>
                  Borrow a book
                </h3>

                <p>
                  Send a request to the book owner.
                </p>
              </div>

            </div>


            <form onSubmit={handleBorrowRequest}>

              <div className="form-field">

                <label>
                  Select Book
                </label>

                <select
                  value={selectedBook}
                  onChange={(event) =>
                    setSelectedBook(
                      event.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Choose an available book
                  </option>

                  {availableBooks.map(
                    (book) => (
                      <option
                        key={book.id}
                        value={book.id}
                      >
                        {book.title} —{" "}
                        {book.available_quantity}{" "}
                        available
                      </option>
                    )
                  )}

                </select>

              </div>


              <div className="form-field">

                <label>
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              {selectedBook && (
                <div className="selected-book-info">

                  {(() => {

                    const book =
                      books.find(
                        (item) =>
                          Number(item.id) ===
                          Number(selectedBook)
                      );

                    if (!book) {
                      return null;
                    }

                    return (
                      <>
                        <strong>
                          {book.title}
                        </strong>

                        <span>
                          Author: {book.author}
                        </span>

                        <span>
                          Owner:{" "}
                          {book.owner_name ||
                            "Unknown"}
                        </span>

                        <span>
                          Rental price: ₹
                          {Number(
                            book.rental_price ||
                              0
                          ).toFixed(2)}
                          {" "}per copy
                        </span>

                        <span>
                          Available copies:{" "}
                          {book.available_quantity}
                        </span>
                      </>
                    );

                  })()}

                </div>
              )}


              <button
                type="submit"
                className="borrow-submit-button"
                disabled={submitting}
              >
                {submitting
                  ? "Sending request..."
                  : "Send Borrow Request"}
              </button>

            </form>

          </div>


          <div className="borrow-info-card">

            <span className="eyebrow">
              HOW IT WORKS
            </span>

            <h3>
              Borrowing process
            </h3>

            <div className="process-list">

              <div className="process-item">

                <span>1</span>

                <div>
                  <strong>
                    Choose a book
                  </strong>

                  <p>
                    Select a book that has
                    available copies.
                  </p>
                </div>

              </div>


              <div className="process-item">

                <span>2</span>

                <div>
                  <strong>
                    Send a request
                  </strong>

                  <p>
                    The book owner receives
                    your borrowing request.
                  </p>
                </div>

              </div>


              <div className="process-item">

                <span>3</span>

                <div>
                  <strong>
                    Owner accepts
                  </strong>

                  <p>
                    The owner accepts the
                    request and sets a due date.
                  </p>
                </div>

              </div>


              <div className="process-item">

                <span>4</span>

                <div>
                  <strong>
                    Borrow the book
                  </strong>

                  <p>
                    Your borrowing record is
                    created and availability
                    is updated.
                  </p>
                </div>

              </div>

            </div>

          </div>

        </section>


        <section className="requests-section">

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                MY REQUESTS
              </span>

              <h3>
                Borrowing requests
              </h3>

            </div>

            <button
              className="refresh-button"
              onClick={loadData}
            >
              Refresh
            </button>

          </div>


          {borrowRequests.length === 0 ? (

            <div className="empty-request-card">

              <h4>
                No borrowing requests yet
              </h4>

              <p>
                Your borrowing requests will
                appear here.
              </p>

            </div>

          ) : (

            <div className="request-list">

              {borrowRequests.map(
                (request) => (

                  <div
                    className="request-card"
                    key={request.id}
                  >

                    <div className="request-main">

                      <div className="request-book-icon">
                        {request.title
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>

                        <h4>
                          {request.title}
                        </h4>

                        <p>
                          {request.author}
                        </p>

                        <small>
                          Quantity:{" "}
                          {request.quantity}
                          {" · "}
                          Owner:{" "}
                          {request.owner_name ||
                            "Unknown"}
                        </small>

                      </div>

                    </div>


                    <div className="request-right">

                      <span
                        className={`request-status ${request.status}`}
                      >
                        {request.status}
                      </span>

                      {request.due_date && (
                        <small>
                          Due:{" "}
                          {request.due_date}
                        </small>
                      )}

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default Borrow;