import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Community.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Community() {
  const navigate = useNavigate();

  const token = localStorage.getItem("cloudlib_token");

  let currentUser = {};

  try {
    currentUser = JSON.parse(
      localStorage.getItem("cloudlib_user") || "{}"
    );
  } catch {
    currentUser = {};
  }

  const [requests, setRequests] = useState([]);
  const [books, setBooks] = useState([]);
  const [borrowings, setBorrowings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState("all");

  const [editRequest, setEditRequest] = useState(null);

  const [editForm, setEditForm] = useState({
    book_id: "",
    quantity: 1,
  });

  const [saving, setSaving] = useState(false);
  const [requestingBuy, setRequestingBuy] = useState(null);

  const [acceptRequest, setAcceptRequest] = useState(null);
  const [acceptDueDate, setAcceptDueDate] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        replace: true,
      });
      return;
    }

    loadCommunity();
  }, [token, navigate]);

  async function loadCommunity() {
    setLoading(true);
    setError("");

    try {
      const [
        communityResponse,
        booksResponse,
        borrowingsResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/api/requests/community`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/books`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/borrowings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      /*
        Only 401 means the login token is invalid.
        A 403 can be a normal permission/ownership error.
      */
      if (
        communityResponse.status === 401 ||
        booksResponse.status === 401 ||
        borrowingsResponse.status === 401
      ) {
        logout();
        return;
      }

      const communityData =
        await communityResponse.json();

      const booksData =
        await booksResponse.json();

      const borrowingsData =
        await borrowingsResponse.json();

      if (!communityResponse.ok) {
        throw new Error(
          communityData.message ||
            "Failed to load community."
        );
      }

      if (!booksResponse.ok) {
        throw new Error(
          booksData.message ||
            "Failed to load books."
        );
      }

      if (!borrowingsResponse.ok) {
        throw new Error(
          borrowingsData.message ||
            "Failed to load borrowing activity."
        );
      }

      setRequests(
        Array.isArray(communityData.requests)
          ? communityData.requests
          : []
      );

      setBooks(
        Array.isArray(booksData.books)
          ? booksData.books
          : []
      );

      setBorrowings(
        Array.isArray(borrowingsData.borrowings)
          ? borrowingsData.borrowings
          : []
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load community."
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("cloudlib_token");
    localStorage.removeItem("cloudlib_user");

    window.dispatchEvent(
      new Event("cloudlib-auth-changed")
    );

    navigate("/login", {
      replace: true,
    });
  }

  const borrowRequests = requests.filter(
    (request) =>
      request.request_type === "borrow"
  );

  const buyRequests = requests.filter(
    (request) =>
      request.request_type === "buy"
  );

  const pendingRequests = requests.filter(
    (request) =>
      request.status === "pending"
  );

  const saleBooks = books.filter(
    (book) =>
      Number(book.available_quantity) > 0 &&
      Number(book.sale_price || 0) > 0
  );

  let visibleRequests = requests;

  if (activeTab === "borrow") {
    visibleRequests = borrowRequests;
  }

  if (activeTab === "buy") {
    visibleRequests = buyRequests;
  }

  if (activeTab === "pending") {
    visibleRequests = pendingRequests;
  }

  function handleEdit(request) {
    setEditRequest(request);

    setEditForm({
      book_id: String(request.book_id),
      quantity: Number(request.quantity || 1),
    });

    setError("");
    setSuccess("");
  }

  function closeEdit() {
    if (saving) {
      return;
    }

    setEditRequest(null);

    setEditForm({
      book_id: "",
      quantity: 1,
    });
  }

  async function handleEditSave(event) {
    event.preventDefault();

    if (!editRequest) {
      return;
    }

    const quantity = Number(
      editForm.quantity
    );

    if (!editForm.book_id) {
      setError("Please select a book.");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      setError(
        "Quantity must be at least 1."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/requests/${editRequest.id}`,
        {
          method: "PUT",

          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },

          /*
            IMPORTANT:
            The requester sends only the book and quantity.
            The owner decides the return date when accepting.
          */
          body: JSON.stringify({
            book_id: Number(
              editForm.book_id
            ),
            quantity,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update request."
        );
      }

      setEditRequest(null);

      setSuccess(
        "Request updated successfully."
      );

      await loadCommunity();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to update request."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(requestId) {
    const confirmed = window.confirm(
      "Cancel this request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/requests/${requestId}`,
        {
          method: "DELETE",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to cancel request."
        );
      }

      setSuccess(
        "Request cancelled."
      );

      await loadCommunity();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to cancel request."
      );
    }
  }

  async function handleBuyRequest(book) {
    try {
      setRequestingBuy(book.id);

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/requests`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            book_id: book.id,
            request_type: "buy",
            quantity: 1,
            offered_price:
              Number(book.sale_price || 0),
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to create buy request."
        );
      }

      setSuccess(
        `Buy request sent for "${book.title}".`
      );

      await loadCommunity();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to create buy request."
      );
    } finally {
      setRequestingBuy(null);
    }
  }

  function openAcceptModal(request) {
    setAcceptRequest(request);
    setAcceptDueDate("");
    setError("");
    setSuccess("");
  }

  function closeAcceptModal() {
    if (accepting) {
      return;
    }

    setAcceptRequest(null);
    setAcceptDueDate("");
  }

  async function confirmAccept() {
    if (!acceptRequest) {
      return;
    }

    if (
      acceptRequest.request_type ===
        "borrow" &&
      !acceptDueDate
    ) {
      setError(
        "Please select a return date."
      );

      return;
    }

    setAccepting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/requests/${acceptRequest.id}/accept`,
        {
          method: "PUT",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            due_date:
              acceptRequest.request_type ===
              "borrow"
                ? acceptDueDate
                : null,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to accept request."
        );
      }

      closeAcceptModal();

      setSuccess(
        acceptRequest.request_type ===
          "borrow"
          ? "Borrow request accepted. Return date has been set."
          : "Buy request accepted."
      );

      await loadCommunity();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to accept request."
      );
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline(requestId) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/requests/${requestId}/decline`,
        {
          method: "PUT",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to decline request."
        );
      }

      setSuccess(
        "Request declined."
      );

      await loadCommunity();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to decline request."
      );
    }
  }

  async function handleReturnBook(
    borrowingId
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to return this book?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/borrowings/${borrowingId}/return`,
        {
          method: "PUT",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to return book."
        );
      }

      setSuccess(
        "Book returned successfully."
      );

      await loadCommunity();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to return book."
      );
    }
  }

  function getStatusClass(status) {
    if (status === "accepted") {
      return "accepted";
    }

    if (status === "declined") {
      return "declined";
    }

    if (status === "cancelled") {
      return "cancelled";
    }

    if (status === "returned") {
      return "returned";
    }

    return "pending";
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "-";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString();
  }

  function formatDateTime(dateValue) {
    if (!dateValue) {
      return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  /*
    Date-only values are parsed manually so that
    timezone conversion does not shift the displayed day.
  */
  function parseDateOnly(dateValue) {
    if (!dateValue) {
      return null;
    }

    const value = String(dateValue).substring(
      0,
      10
    );

    const parts = value.split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (
      !year ||
      !month ||
      !day
    ) {
      return null;
    }

    return new Date(
      year,
      month - 1,
      day
    );
  }

  function getBorrowingWarning(
    dueDate,
    status
  ) {
    if (!dueDate) {
      return null;
    }

    if (status === "returned") {
      return null;
    }

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const due = parseDateOnly(
      dueDate
    );

    if (!due) {
      return null;
    }

    due.setHours(
      0,
      0,
      0,
      0
    );

    const difference =
      due.getTime() -
      today.getTime();

    const daysRemaining =
      Math.ceil(
        difference /
          (1000 * 60 * 60 * 24)
      );

    if (daysRemaining < 0) {
      return {
        type: "overdue",
        message:
          "This book is overdue. Please return it immediately.",
      };
    }

    if (daysRemaining === 0) {
      return {
        type: "today",
        message:
          "Return Due Today. Please return this book today.",
      };
    }

    if (daysRemaining === 1) {
      return {
        type: "tomorrow",
        message:
          "Return Reminder: Please return this book tomorrow.",
      };
    }

    return {
      type: "normal",
      message:
        `${daysRemaining} days remaining`,
    };
  }

  const todayString =
    new Date()
      .toISOString()
      .split("T")[0];

  if (loading) {
    return (
      <div className="community-loading">
        <div className="community-loading-card">
          <div className="community-spinner"></div>

          <p>
            Loading CloudLib Community...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="community-page">

      <header className="community-header">

        <div className="community-brand">

          <button
            className="community-back"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            ←
          </button>

          <div className="community-brand-mark">
            C
          </div>

          <div>
            <h1>
              CloudLib
            </h1>

            <p>
              Community Library
            </p>
          </div>

        </div>

        <div className="community-header-actions">

          <span>
            Signed in as{" "}
            <strong>
              {currentUser.name ||
                "Member"}
            </strong>
          </span>

          <button
            className="community-dashboard-button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            Dashboard
          </button>

        </div>

      </header>

      <main className="community-container">

        <section className="community-intro">

          <span className="community-eyebrow">
            SHARED LIBRARY COMMUNITY
          </span>

          <h2>
            Community
          </h2>

          <p>
            See what books members are
            looking for, what they want
            to buy, and which books are
            currently available for sale.
          </p>

        </section>

        {error && (
          <div className="community-error">

            <span>
              {error}
            </span>

            <button
              onClick={() =>
                setError("")
              }
            >
              Close
            </button>

          </div>
        )}

        {success && (
          <div className="community-success">

            <span>
              {success}
            </span>

            <button
              onClick={() =>
                setSuccess("")
              }
            >
              Close
            </button>

          </div>
        )}

        <section className="community-stats">

          <div className="community-stat-card">

            <div className="community-stat-icon borrow">
              B
            </div>

            <div>
              <strong>
                {borrowRequests.length}
              </strong>

              <span>
                BORROW REQUESTS
              </span>
            </div>

          </div>

          <div className="community-stat-card">

            <div className="community-stat-icon buy">
              $
            </div>

            <div>
              <strong>
                {buyRequests.length}
              </strong>

              <span>
                BUY REQUESTS
              </span>
            </div>

          </div>

          <div className="community-stat-card">

            <div className="community-stat-icon sale">
              S
            </div>

            <div>
              <strong>
                {saleBooks.length}
              </strong>

              <span>
                BOOKS FOR SALE
              </span>
            </div>

          </div>

          <div className="community-stat-card">

            <div className="community-stat-icon activity">
              A
            </div>

            <div>
              <strong>
                {pendingRequests.length}
              </strong>

              <span>
                PENDING REQUESTS
              </span>
            </div>

          </div>

        </section>

        <section className="community-section">

          <div className="community-section-header">

            <div>

              <span className="community-eyebrow">
                MY BORROWING ACTIVITY
              </span>

              <h3>
                My Borrowed Books
              </h3>

              <p>
                Books you currently have borrowed.
              </p>

            </div>

            <button
              className="community-refresh"
              onClick={loadCommunity}
            >
              Refresh
            </button>

          </div>

          {borrowings.length === 0 ? (

            <div className="community-empty">

              <h4>
                No borrowed books
              </h4>

              <p>
                Your accepted borrow requests
                will appear here.
              </p>

            </div>

          ) : (

            <div className="community-request-list">

              {borrowings.map(
                (borrowing) => {

                  const warning =
                    getBorrowingWarning(
                      borrowing.due_date,
                      borrowing.status
                    );

                  return (
                    <article
                      className="community-request-card"
                      key={borrowing.id}
                    >

                      <div className="community-request-icon">
                        B
                      </div>

                      <div className="community-request-content">

                        <div className="community-request-top">

                          <div>

                            <span className="community-type borrow">
                              BORROWED BOOK
                            </span>

                            <h4>
                              {borrowing.title}
                            </h4>

                            <p>
                              by{" "}
                              {borrowing.author}
                            </p>

                          </div>

                          <span
                            className={`community-status ${getStatusClass(
                              borrowing.status
                            )}`}
                          >
                            {borrowing.status}
                          </span>

                        </div>

                        <div className="community-request-details">

                          <div>

                            <span>
                              BORROW DATE
                            </span>

                            <strong>
                              {formatDate(
                                borrowing.borrow_date
                              )}
                            </strong>

                          </div>

                          <div>

                            <span>
                              RETURN DATE
                            </span>

                            <strong>
                              {formatDate(
                                borrowing.due_date
                              )}
                            </strong>

                          </div>

                          <div>

                            <span>
                              STATUS
                            </span>

                            <strong>
                              {borrowing.status}
                            </strong>

                          </div>

                        </div>

                        {warning && (
                          <div
                            className={`borrowing-warning ${warning.type}`}
                          >
                            {warning.message}
                          </div>
                        )}

                        {borrowing.status !==
                          "returned" && (

                          <div className="community-request-actions">

                            <button
                              className="owner-action"
                              onClick={() =>
                                handleReturnBook(
                                  borrowing.id
                                )
                              }
                            >
                              Return Book
                            </button>

                          </div>

                        )}

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>

        <section className="community-section">

          <div className="community-section-header">

            <div>

              <span className="community-eyebrow">
                SHARED REQUEST BOARD
              </span>

              <h3>
                Community Requests
              </h3>

              <p>
                Every CloudLib user can
                see these requests.
              </p>

            </div>

            <button
              className="community-refresh"
              onClick={loadCommunity}
            >
              Refresh
            </button>

          </div>

          <div className="community-tabs">

            <button
              className={
                activeTab === "all"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("all")
              }
            >
              All Requests
            </button>

            <button
              className={
                activeTab === "borrow"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("borrow")
              }
            >
              Borrow Requests
            </button>

            <button
              className={
                activeTab === "buy"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("buy")
              }
            >
              Buy Requests
            </button>

            <button
              className={
                activeTab === "pending"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("pending")
              }
            >
              Pending
            </button>

          </div>

          {visibleRequests.length === 0 ? (

            <div className="community-empty">

              <h4>
                No requests yet
              </h4>

              <p>
                Borrowing and purchase
                requests will appear here
                when users create them.
              </p>

            </div>

          ) : (

            <div className="community-request-list">

              {visibleRequests.map(
                (request) => {

                  const isOwner =
                    Number(
                      request.owner_id
                    ) ===
                    Number(
                      currentUser.id
                    );

                  const isRequester =
                    Number(
                      request.requester_id
                    ) ===
                    Number(
                      currentUser.id
                    );

                  return (
                    <article
                      className="community-request-card"
                      key={request.id}
                    >

                      <div className="community-request-icon">

                        {request.request_type ===
                        "borrow"
                          ? "B"
                          : "$"}

                      </div>

                      <div className="community-request-content">

                        <div className="community-request-top">

                          <div>

                            <span
                              className={`community-type ${
                                request.request_type
                              }`}
                            >
                              {request.request_type ===
                              "borrow"
                                ? "BORROW REQUEST"
                                : "BUY REQUEST"}
                            </span>

                            <h4>
                              {request.book_title ||
                                request.title ||
                                "Book"}
                            </h4>

                            <p>
                              by{" "}
                              {request.book_author ||
                                request.author ||
                                "Unknown author"}
                            </p>

                          </div>

                          <span
                            className={`community-status ${getStatusClass(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>

                        </div>

                        <div className="community-request-details">

                          <div>

                            <span>
                              REQUESTER
                            </span>

                            <strong>
                              {request.requester_name ||
                                "Unknown member"}
                            </strong>

                          </div>

                          <div>

                            <span>
                              BOOK OWNER
                            </span>

                            <strong>
                              {request.owner_name ||
                                "Unknown member"}
                            </strong>

                          </div>

                          <div>

                            <span>
                              QUANTITY
                            </span>

                            <strong>
                              {request.quantity}
                            </strong>

                          </div>

                          <div>

                            <span>
                              {request.request_type ===
                              "borrow"
                                ? "RENTAL PRICE"
                                : "PURCHASE PRICE"}
                            </span>

                            <strong>
                              ₹
                              {Number(
                                request.offered_price ||
                                  0
                              ).toFixed(2)}
                            </strong>

                          </div>

                        </div>

                        {request.request_type ===
                          "borrow" &&
                          request.due_date && (

                          <div className="community-return-date">

                            <span>
                              RETURN DATE
                            </span>

                            <strong>
                              {formatDate(
                                request.due_date
                              )}
                            </strong>

                          </div>

                        )}

                        <div className="community-request-footer">

                          <span>
                            Requested{" "}
                            {formatDateTime(
                              request.created_at
                            )}
                          </span>

                        </div>

                        {request.status ===
                          "pending" && (

                          <div className="community-request-actions">

                            {isRequester && (
                              <>
                                <button
                                  className="edit-request-button"
                                  onClick={() =>
                                    handleEdit(
                                      request
                                    )
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  className="cancel-request-button"
                                  onClick={() =>
                                    handleCancel(
                                      request.id
                                    )
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            {isOwner && (
                              <>
                                <button
                                  className="owner-action"
                                  onClick={() =>
                                    openAcceptModal(
                                      request
                                    )
                                  }
                                >
                                  Accept
                                </button>

                                <button
                                  className="cancel-request-button"
                                  onClick={() =>
                                    handleDecline(
                                      request.id
                                    )
                                  }
                                >
                                  Decline
                                </button>
                              </>
                            )}

                          </div>

                        )}

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>

        <section className="community-section">

          <div className="community-section-header">

            <div>

              <span className="community-eyebrow">
                MARKETPLACE
              </span>

              <h3>
                Books Available For Sale
              </h3>

              <p>
                Books listed by CloudLib
                members for purchase.
              </p>

            </div>

            <button
              className="community-sell-button"
              onClick={() =>
                navigate("/sell")
              }
            >
              Sell a Book
            </button>

          </div>

          {saleBooks.length === 0 ? (

            <div className="community-empty">

              <h4>
                No books are currently
                listed for sale
              </h4>

              <p>
                Members can list their
                books using Sell a Book.
              </p>

            </div>

          ) : (

            <div className="sale-book-grid">

              {saleBooks.map(
                (book) => {

                  const isOwnBook =
                    Number(
                      book.owner_id
                    ) ===
                    Number(
                      currentUser.id
                    );

                  return (
                    <article
                      className="sale-book-card"
                      key={book.id}
                    >

                      <div className="sale-book-icon">
                        {book.title
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="sale-book-content">

                        <span className="sale-category">
                          {book.category ||
                            "General"}
                        </span>

                        <h4>
                          {book.title}
                        </h4>

                        <p>
                          {book.author}
                        </p>

                        <div className="sale-book-info">

                          <div>

                            <span>
                              Seller
                            </span>

                            <strong>
                              {book.owner_name ||
                                "Unknown"}
                            </strong>

                          </div>

                          <div>

                            <span>
                              Available
                            </span>

                            <strong>
                              {
                                book.available_quantity
                              }
                            </strong>

                          </div>

                          <div>

                            <span>
                              Price
                            </span>

                            <strong>
                              ₹
                              {Number(
                                book.sale_price ||
                                  0
                              ).toFixed(2)}
                            </strong>

                          </div>

                        </div>

                        {!isOwnBook && (
                          <button
                            className="request-buy-button"
                            onClick={() =>
                              handleBuyRequest(
                                book
                              )
                            }
                            disabled={
                              requestingBuy ===
                              book.id
                            }
                          >
                            {requestingBuy ===
                            book.id
                              ? "Sending..."
                              : "Buy This Book"}
                          </button>
                        )}

                        {isOwnBook && (
                          <span className="own-book-label">
                            Your listing
                          </span>
                        )}

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>

      </main>

      {editRequest && (

        <div className="community-modal-overlay">

          <div className="community-modal">

            <div className="community-modal-header">

              <div>

                <span className="community-eyebrow">
                  EDIT REQUEST
                </span>

                <h3>
                  Change your request
                </h3>

              </div>

              <button
                onClick={closeEdit}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleEditSave}
            >

              <div className="community-form-group">

                <label>
                  Select Book
                </label>

                <select
                  value={
                    editForm.book_id
                  }
                  onChange={(event) =>
                    setEditForm(
                      (previous) => ({
                        ...previous,
                        book_id:
                          event.target.value,
                      })
                    )
                  }
                  required
                >

                  <option value="">
                    Select a book
                  </option>

                  {books
                    .filter(
                      (book) =>
                        Number(
                          book.owner_id
                        ) !==
                          Number(
                            currentUser.id
                          ) &&
                        (
                          Number(
                            book.available_quantity
                          ) > 0 ||
                          Number(book.id) ===
                            Number(
                              editForm.book_id
                            )
                        )
                    )
                    .map(
                      (book) => (
                        <option
                          key={book.id}
                          value={book.id}
                        >
                          {book.title} —{" "}
                          {
                            book.available_quantity
                          }{" "}
                          available
                        </option>
                      )
                    )}

                </select>

              </div>

              <div className="community-form-group">

                <label>
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  value={
                    editForm.quantity
                  }
                  onChange={(event) =>
                    setEditForm(
                      (previous) => ({
                        ...previous,
                        quantity:
                          event.target.value,
                      })
                    )
                  }
                  required
                />

              </div>

              <div className="request-info-box">
                The book owner will set the return date when the borrow request is accepted.
              </div>

              <div className="community-modal-actions">

                <button
                  type="button"
                  className="modal-cancel"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-save"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {acceptRequest && (

        <div className="community-modal-overlay">

          <div className="community-modal">

            <div className="community-modal-header">

              <div>

                <span className="community-eyebrow">
                  ACCEPT REQUEST
                </span>

                <h3>
                  {acceptRequest.request_type ===
                  "borrow"
                    ? "Set Return Date"
                    : "Accept Buy Request"}
                </h3>

              </div>

              <button
                onClick={
                  closeAcceptModal
                }
                disabled={accepting}
              >
                ×
              </button>

            </div>

            <div className="accept-request-summary">

              <h4>
                {acceptRequest.book_title}
              </h4>

              <p>
                by{" "}
                {acceptRequest.book_author}
              </p>

              <div className="accept-summary-row">

                <span>
                  Requester
                </span>

                <strong>
                  {
                    acceptRequest.requester_name
                  }
                </strong>

              </div>

              <div className="accept-summary-row">

                <span>
                  Quantity
                </span>

                <strong>
                  {
                    acceptRequest.quantity
                  }
                </strong>

              </div>

              {acceptRequest.request_type ===
                "borrow" && (

                <div className="community-form-group">

                  <label>
                    Return Date
                  </label>

                  <input
                    type="date"
                    min={todayString}
                    value={
                      acceptDueDate
                    }
                    onChange={(event) =>
                      setAcceptDueDate(
                        event.target.value
                      )
                    }
                    required
                  />

                  <small>
                    You are setting the deadline for the borrower.
                  </small>

                </div>

              )}

            </div>

            <div className="community-modal-actions">

              <button
                type="button"
                className="modal-cancel"
                onClick={
                  closeAcceptModal
                }
                disabled={accepting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="modal-save"
                onClick={
                  confirmAccept
                }
                disabled={accepting}
              >
                {accepting
                  ? "Accepting..."
                  : "Confirm Accept"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Community;