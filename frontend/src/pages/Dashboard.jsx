import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Dashboard() {
  const navigate = useNavigate();

  const [books, setBooks] = useState([]);
  const [communityRequests, setCommunityRequests] = useState([]);
  const [communitySales, setCommunitySales] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    quantity: 1,
    available_quantity: 1,
    rental_price: 0,
    sale_price: 0,
  });

  const token = localStorage.getItem("cloudlib_token");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    loadDashboard();
  }, [token, navigate]);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [booksResponse, communityResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/books`, {
            headers,
          }),
          fetch(`${API_URL}/api/requests/community`, {
            headers,
          }),
        ]);

      const booksData = await booksResponse.json();

      if (!booksResponse.ok) {
        throw new Error(
          booksData.message || "Unable to load books."
        );
      }

      setBooks(booksData.books || []);

      if (communityResponse.ok) {
        const communityData =
          await communityResponse.json();

        setCommunityRequests(
          communityData.requests || []
        );

        setCommunitySales(
          communityData.sales || []
        );
      }
    } catch (err) {
      console.error(
        "Dashboard loading error:",
        err
      );

      setError(
        err.message ||
          "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      author: "",
      isbn: "",
      category: "",
      quantity: 1,
      available_quantity: 1,
      rental_price: 0,
      sale_price: 0,
    });
  }

  function openAddBook() {
    resetForm();
    setEditingBook(null);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openEditBook(book) {
    setEditingBook(book);

    setFormData({
      title: book.title || "",
      author: book.author || "",
      isbn: book.isbn || "",
      category: book.category || "",
      quantity: Number(book.quantity || 1),
      available_quantity: Number(
        book.available_quantity ??
          book.quantity ??
          1
      ),
      rental_price: Number(
        book.rental_price || 0
      ),
      sale_price: Number(
        book.sale_price || 0
      ),
    });

    setShowForm(true);
    setError("");
    setMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingBook(null);
    resetForm();
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const quantity = Number(
        formData.quantity
      );

      let availableQuantity = Number(
        formData.available_quantity
      );

      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        throw new Error(
          "Quantity must be at least 1."
        );
      }

      if (
        !Number.isInteger(
          availableQuantity
        ) ||
        availableQuantity < 0
      ) {
        throw new Error(
          "Available quantity cannot be negative."
        );
      }

      if (
        availableQuantity > quantity
      ) {
        availableQuantity = quantity;
      }

      const body = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn:
          formData.isbn.trim() || null,
        category:
          formData.category.trim(),
        quantity,
        available_quantity:
          availableQuantity,
        rental_price: Number(
          formData.rental_price || 0
        ),
        sale_price: Number(
          formData.sale_price || 0
        ),
      };

      if (!body.title) {
        throw new Error(
          "Book title is required."
        );
      }

      if (!body.author) {
        throw new Error(
          "Author name is required."
        );
      }

      if (
        body.rental_price < 0 ||
        body.sale_price < 0
      ) {
        throw new Error(
          "Prices cannot be negative."
        );
      }

      const url = editingBook
        ? `${API_URL}/api/books/${editingBook.id}`
        : `${API_URL}/api/books`;

      const method = editingBook
        ? "PUT"
        : "POST";

      const response = await fetch(
        url,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to ${
              editingBook
                ? "update"
                : "add"
            } book.`
        );
      }

      setMessage(
        editingBook
          ? "Book updated successfully."
          : "Book added successfully."
      );

      closeForm();

      await loadDashboard();
    } catch (err) {
      console.error(
        "Save book error:",
        err
      );

      setError(
        err.message ||
          "Unable to save book."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBook(book) {
    const confirmed =
      window.confirm(
        `Delete "${book.title}" from your library?`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(book.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/books/${book.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to delete book."
        );
      }

      setMessage(
        `"${book.title}" was deleted successfully.`
      );

      await loadDashboard();
    } catch (err) {
      console.error(
        "Delete book error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete book."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function logout() {
    localStorage.removeItem(
      "cloudlib_token"
    );

    localStorage.removeItem(
      "cloudlib_user"
    );

    window.dispatchEvent(
      new Event("cloudlib-auth-changed")
    );

    navigate("/login", {
      replace: true,
    });
  }

  const totalTitles =
    books.length;

  const totalCopies =
    books.reduce(
      (sum, book) =>
        sum +
        Number(
          book.quantity || 0
        ),
      0
    );

  const availableCopies =
    books.reduce(
      (sum, book) =>
        sum +
        Number(
          book.available_quantity ||
            0
        ),
      0
    );

  const listedBooks =
    communitySales.filter(
      (book) =>
        Number(
          book.sale_price || 0
        ) > 0 &&
        Number(
          book.available_quantity ||
            0
        ) > 0
    );

  const pendingRequests =
    communityRequests.filter(
      (request) =>
        String(
          request.status
        ).toLowerCase() ===
        "pending"
    ).length;

  const user = JSON.parse(
    localStorage.getItem(
      "cloudlib_user"
    ) || "{}"
  );

  const myUserId =
    Number(user.id);

  const incomingRequests =
    communityRequests.filter(
      (request) =>
        Number(
          request.owner_id
        ) === myUserId &&
        Number(
          request.requester_id
        ) !== myUserId
    );

  const outgoingRequests =
    communityRequests.filter(
      (request) =>
        Number(
          request.requester_id
        ) === myUserId
    );

  const buyRequestCount =
    communityRequests.filter(
      (request) =>
        String(
          request.request_type
        ).toLowerCase() ===
        "buy"
    ).length;

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-card">
          Loading CloudLib...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      <header className="dashboard-header">

        <div className="dashboard-brand">

          <div className="dashboard-brand-mark">
            C
          </div>

          <div>
            <h1>CloudLib</h1>
            <p>
              Library Management System
            </p>
          </div>

        </div>

        <div className="dashboard-header-actions">

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      <main className="dashboard-container">

        <section className="dashboard-welcome">

          <div>
            <span className="dashboard-eyebrow">
              LIBRARY DASHBOARD
            </span>

            <h2>
              Welcome back,{" "}
              {user.name || "User"}
            </h2>

            <p>
              Manage your books,
              borrowing activity,
              selling listings and
              community requests.
            </p>
          </div>

          <button
            className="dashboard-primary-button"
            onClick={openAddBook}
          >
            + Add Book
          </button>

        </section>

        {message && (
          <div className="dashboard-message">
            {message}
          </div>
        )}

        {error && (
          <div className="dashboard-error">
            {error}
          </div>
        )}

        <section className="dashboard-stats">

          <div className="stat-card">
            <span className="stat-label">
              Book Titles
            </span>

            <strong>
              {totalTitles}
            </strong>

            <span className="stat-description">
              Books in the library
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Total Copies
            </span>

            <strong>
              {totalCopies}
            </strong>

            <span className="stat-description">
              Physical copies
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Available Copies
            </span>

            <strong>
              {availableCopies}
            </strong>

            <span className="stat-description">
              Ready to borrow or sell
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">
              Community Listings
            </span>

            <strong>
              {listedBooks.length}
            </strong>

            <span className="stat-description">
              Books currently for sale
            </span>
          </div>

        </section>

        <section className="quick-actions">

          <div className="section-title">

            <div>
              <span className="dashboard-eyebrow">
                QUICK ACTIONS
              </span>

              <h3>
                What would you like to do?
              </h3>
            </div>

          </div>

          <div className="quick-action-grid">

            <button
              className="quick-action-card"
              onClick={openAddBook}
            >
              <div className="quick-action-icon">
                +
              </div>

              <div>
                <h4>Add a Book</h4>
                <p>
                  Add a new book to the
                  shared library.
                </p>
              </div>
            </button>

            <button
              className="quick-action-card"
              onClick={() =>
                navigate("/borrow")
              }
            >
              <div className="quick-action-icon">
                B
              </div>

              <div>
                <h4>Borrow a Book</h4>
                <p>
                  Find books and send
                  borrowing requests.
                </p>
              </div>
            </button>

            <button
              className="quick-action-card"
              onClick={() =>
                navigate("/sell")
              }
            >
              <div className="quick-action-icon">
                S
              </div>

              <div>
                <h4>Sell a Book</h4>
                <p>
                  List one of your
                  available books for sale.
                </p>
              </div>
            </button>

            <button
              className="quick-action-card"
              onClick={() =>
                navigate("/community")
              }
            >
              <div className="quick-action-icon">
                C
              </div>

              <div>
                <h4>Community</h4>
                <p>
                  View borrowing, buying
                  and selling activity.
                </p>
              </div>
            </button>

          </div>

        </section>

        <section className="library-section">

          <div className="section-heading">

            <div>
              <span className="dashboard-eyebrow">
                YOUR LIBRARY
              </span>

              <h3>
                Library Books
              </h3>

              <p>
                Manage your books and
                decide whether they are
                available for borrowing
                or sale.
              </p>
            </div>

          </div>

          {books.length === 0 ? (
            <div className="empty-library">

              <h4>
                No books yet
              </h4>

              <p>
                Add your first book to
                start using CloudLib.
              </p>

              <button
                className="dashboard-primary-button"
                onClick={openAddBook}
              >
                Add Your First Book
              </button>

            </div>
          ) : (
            <div className="book-table-wrapper">

              <table className="book-table">

                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Available</th>
                    <th>Rental Price</th>
                    <th>Selling Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {books.map((book) => {

                    const listed =
                      Number(
                        book.sale_price || 0
                      ) > 0;

                    return (
                      <tr key={book.id}>

                        <td>
                          <div className="book-title-cell">

                            <div className="book-letter">
                              {book.title
                                ?.charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {book.title}
                              </strong>

                              <span>
                                {book.author}
                              </span>

                              {book.isbn && (
                                <small>
                                  ISBN:{" "}
                                  {book.isbn}
                                </small>
                              )}
                            </div>

                          </div>
                        </td>

                        <td>
                          <span className="category-badge">
                            {book.category ||
                              "General"}
                          </span>
                        </td>

                        <td>
                          {book.quantity}
                        </td>

                        <td>
                          <span className="available-value">
                            {
                              book.available_quantity
                            }
                          </span>
                        </td>

                        <td>
                          ₹
                          {Number(
                            book.rental_price ||
                              0
                          ).toFixed(2)}
                        </td>

                        <td>

                          {listed ? (
                            <span className="listed-price">
                              ₹
                              {Number(
                                book.sale_price
                              ).toFixed(2)}
                            </span>
                          ) : (
                            <span className="not-listed">
                              Not listed
                            </span>
                          )}

                        </td>

                        <td>

                          <div className="book-actions">

                            <button
                              className="edit-button"
                              onClick={() =>
                                openEditBook(book)
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="sell-book-button"
                              onClick={() =>
                                navigate(
                                  "/sell"
                                )
                              }
                            >
                              Sell This Book
                            </button>

                            <button
                              className="delete-button"
                              onClick={() =>
                                deleteBook(book)
                              }
                              disabled={
                                deletingId ===
                                book.id
                              }
                            >
                              {deletingId ===
                              book.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </section>

        <section className="activity-section">

          <div className="section-heading">

            <div>
              <span className="dashboard-eyebrow">
                COMMUNITY ACTIVITY
              </span>

              <h3>
                Buying, Borrowing & Selling
              </h3>

              <p>
                Activity is shared across
                all CloudLib accounts.
              </p>
            </div>

            <button
              className="view-community-button"
              onClick={() =>
                navigate("/community")
              }
            >
              COMMUNITY ACTIVITY
            </button>

          </div>

          <div className="activity-grid">

            <div className="activity-card">

              <div className="activity-card-top">

                <h4>
                  Books For Sale
                </h4>

                <span>
                  {listedBooks.length}
                </span>

              </div>

              <div className="activity-card-content">

                {listedBooks.length === 0 ? (
                  <p>
                    No books are currently
                    listed for sale.
                  </p>
                ) : (
                  listedBooks
                    .slice(0, 3)
                    .map((book) => (
                      <div
                        className="activity-item"
                        key={book.id}
                      >

                        <div>
                          <strong>
                            {book.title}
                          </strong>

                          <span>
                            Seller:{" "}
                            {book.owner_name ||
                              "Unknown"}
                          </span>
                        </div>

                        <strong>
                          ₹
                          {Number(
                            book.sale_price
                          ).toFixed(2)}
                        </strong>

                      </div>
                    ))
                )}

              </div>

            </div>

            <div className="activity-card">

              <div className="activity-card-top">

                <h4>
                  Borrow Requests
                </h4>

                <span>
                  {pendingRequests}
                </span>

              </div>

              <div className="activity-card-content">

                {incomingRequests.length === 0 &&
                outgoingRequests.length === 0 ? (
                  <p>
                    No borrowing activity yet.
                  </p>
                ) : (
                  <>
                    <div className="activity-summary">

                      <strong>
                        {
                          incomingRequests.length
                        }
                      </strong>

                      <span>
                        requests for your books
                      </span>

                    </div>

                    <div className="activity-summary">

                      <strong>
                        {
                          outgoingRequests.length
                        }
                      </strong>

                      <span>
                        requests you have made
                      </span>

                    </div>
                  </>
                )}

              </div>

            </div>

            <div className="activity-card">

              <div className="activity-card-top">

                <h4>
                  Buy Requests
                </h4>

                <span>
                  {buyRequestCount}
                </span>

              </div>

              <div className="activity-card-content">

                <p>
                  View all buyer and seller
                  requests on the Community
                  page.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

      {showForm && (
        <div
          className="dashboard-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >

          <div className="dashboard-modal">

            <div className="modal-header">

              <div>

                <span className="dashboard-eyebrow">
                  {editingBook
                    ? "EDIT BOOK"
                    : "NEW BOOK"}
                </span>

                <h3>
                  {editingBook
                    ? "Edit Book"
                    : "Add a Book"}
                </h3>

              </div>

              <button
                className="modal-close"
                onClick={closeForm}
              >
                ×
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              <div className="form-grid">

                <div className="dashboard-form-group full-width">

                  <label>
                    Book Title
                  </label>

                  <input
                    type="text"
                    name="title"
                    value={
                      formData.title
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Enter book title"
                    required
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    Author
                  </label>

                  <input
                    type="text"
                    name="author"
                    value={
                      formData.author
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Enter author name"
                    required
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    ISBN
                  </label>

                  <input
                    type="text"
                    name="isbn"
                    value={
                      formData.isbn
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="ISBN"
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    Category
                  </label>

                  <input
                    type="text"
                    name="category"
                    value={
                      formData.category
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. Computer Science"
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    Total Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    name="quantity"
                    value={
                      formData.quantity
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    Available Quantity
                  </label>

                  <input
                    type="number"
                    min="0"
                    name="available_quantity"
                    value={
                      formData.available_quantity
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    Rental Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="rental_price"
                    value={
                      formData.rental_price
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

                <div className="dashboard-form-group">

                  <label>
                    Selling Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="sale_price"
                    value={
                      formData.sale_price
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

              </div>

              <div className="modal-note">
                Set the selling price above
                ₹0 if you want this book to
                appear in the community
                marketplace.
              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingBook
                    ? "Save Changes"
                    : "Add Book"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Dashboard;