# CloudLib

## Cloud-Based Library Management, Book Sharing and Marketplace Platform

CloudLib is a cloud-based full-stack web application designed to make library and student-to-student book management easier.

The platform allows users to register and securely log in, manage books, borrow and return books, request books from other users, buy and sell books, and view shared community activity through a centralized web application.

CloudLib was developed to demonstrate the practical integration of frontend development, backend REST APIs, relational database management, authentication, cloud-hosted databases, and cloud deployment.

---

## Live Demo

**Hosted Website:**

https://cloudlib-frontend.onrender.com

**Backend API:**

https://cloudlib-backend.onrender.com

---

## GitHub Repository

https://github.com/shreya-c15/CloudLib

---

# Overview

Traditional library systems mainly focus on maintaining book records and borrowing information. Students may also need a way to discover books owned by other students, request books for borrowing, and buy or sell books.

CloudLib combines these requirements into a single cloud-based platform.

The application provides:

- User registration and authentication
- Book management
- Book borrowing and returning
- Borrow requests
- Buying and selling books
- Buy requests
- Community request tracking
- Marketplace for books
- Cloud-hosted database
- RESTful API communication
- Cloud deployment

The project follows a client-server architecture in which the React frontend communicates with the Node.js/Express backend through REST APIs. The backend communicates with a PostgreSQL database hosted on Neon Cloud.

---

# Problem Statement

Students often depend on traditional library systems to find and borrow books. These systems may not provide an easy way for students to share books with one another or buy and sell books that they no longer need.

CloudLib addresses this problem by providing a centralized platform where users can:

1. Manage their own books.
2. Discover books available from other users.
3. Request books for borrowing.
4. Return borrowed books.
5. Request books for purchase.
6. List books for sale.
7. View community borrowing and buying activity.

---

# Objectives

The main objectives of CloudLib are:

- Develop a cloud-based library management application.
- Implement complete CRUD operations for book management.
- Provide secure user registration and authentication.
- Implement borrowing and book-return functionality.
- Implement buying and selling functionality.
- Implement borrowing and buying request workflows.
- Provide a shared community activity board.
- Integrate a cloud-hosted relational database.
- Implement RESTful APIs for frontend-backend communication.
- Deploy the application in a cloud environment.
- Demonstrate practical cloud computing concepts.

---

# Key Features

## 1. User Management

- User registration
- User login
- Password hashing
- JWT-based authentication
- User profile information
- Protected API routes

---

## 2. Book Management

Users can manage book information through CRUD operations.

### Create

Users can add books with information such as:

- Title
- Author
- ISBN
- Category
- Quantity
- Rental price
- Selling price

### Read

Users can view available books and their details.

### Update

Users can update book and listing information.

### Delete

Users can remove books from the system.

---

## 3. Borrowing System

CloudLib provides a request-based borrowing workflow.

A user can:

- View available books
- Send a borrow request
- View request status
- Track borrowed books
- View borrowing dates
- View return deadlines
- Return borrowed books

Book availability is updated when books are borrowed and returned.

---

## 4. Buy and Sell System

CloudLib also provides a marketplace for books.

Users can:

- List books for sale
- Set selling prices
- Update selling information
- Remove listings
- View books listed by other users
- Send purchase requests
- Purchase books after request approval

Completed purchases are recorded in the database.

---

## 5. Community Request Board

The Community section provides a shared view of activity across CloudLib users.

It displays:

- Borrow requests
- Buy requests
- Pending requests
- Accepted requests
- Returned borrowing requests
- Books currently available for sale

This creates a shared book-sharing environment between users.

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- HTML
- CSS
- React Router

## Backend

- Node.js
- Express.js
- REST APIs
- CORS
- dotenv
- bcryptjs
- JSON Web Tokens (JWT)

## Database

- PostgreSQL
- Neon Cloud

## Cloud Deployment

- Render
- Neon

## Development and Version Control

- Visual Studio Code
- Git
- GitHub
- npm

---

# System Architecture

CloudLib follows a client-server architecture with separate frontend, backend, and database layers.

```text
                         USER
                           |
                           v
                 +---------------------+
                 |    Web Browser      |
                 +----------+----------+
                            |
                            v
                 +---------------------+
                 | React + TypeScript  |
                 |      Frontend       |
                 |       Vite          |
                 +----------+----------+
                            |
                       HTTPS / REST
                            |
                            v
                 +---------------------+
                 | Node.js + Express   |
                 |      Backend        |
                 |    REST APIs        |
                 +----------+----------+
                            |
                      PostgreSQL
                            |
                            v
                 +---------------------+
                 |   Neon PostgreSQL   |
                 |     Cloud Database  |
                 +---------------------+

                    Cloud Deployment
                    -----------------
                    Frontend -> Render
                    Backend  -> Render
                    Database -> Neon
