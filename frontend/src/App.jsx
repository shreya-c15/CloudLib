import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Borrow from "./pages/Borrow";
import Community from "./pages/Community";
import Sell from "./pages/Sell";

function App() {
  const [token, setToken] = useState(() =>
    localStorage.getItem("cloudlib_token")
  );

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(localStorage.getItem("cloudlib_token"));
    };

    window.addEventListener(
      "cloudlib-auth-changed",
      handleAuthChange
    );

    return () => {
      window.removeEventListener(
        "cloudlib-auth-changed",
        handleAuthChange
      );
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login />
            )
          }
        />

        <Route
          path="/register"
          element={
            token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            token ? (
              <Dashboard />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/borrow"
          element={
            token ? (
              <Borrow />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/sell"
          element={
            token ? (
              <Sell />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/community"
          element={
            token ? (
              <Community />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/"
          element={
            <Navigate
              to={token ? "/dashboard" : "/login"}
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to={token ? "/dashboard" : "/login"}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;