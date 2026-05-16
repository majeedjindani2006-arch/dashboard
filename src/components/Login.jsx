import { useState } from "react";
import "./Login.css";
import ismailiLogo from "./ismaililogo.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

const API_ROUTE_PREFIX = "/api/dashboard";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const canSubmit = cleanEmail.length > 0 && password.trim().length > 0 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cleanEmail || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setError("");
    setLoading(true);

    const requestBody = {
      email: cleanEmail,
      password: password.trim(),
    };
    const requestUrl = `${API_BASE_URL}${API_ROUTE_PREFIX}/auth/login`;

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      let payload = {};

      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        setError(
          payload?.detail ||
            payload?.message ||
            "Invalid email or password."
        );
        return;
      }

      onLogin({
        email: cleanEmail,
        token: payload.access_token,
        name: payload.user?.name || payload.user?.full_name || cleanEmail,
        scope: payload.user?.scope || "Regional",
        rememberMe,
      });
    } catch (err) {
      console.error("Login error", err);
      setError("Unable to connect to the API. Please start backend and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src={ismailiLogo} alt="Ismaili Logo" />
        </div>

        <h1 className="login-title">Welcome</h1>

        <p className="login-subtitle">
          Enter the credentials shared by your respective Council
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email Address</label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              placeholder="Enter your Email Address"
              autoComplete="email"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>

            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="login-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="login-checkbox"
              />
              <span>Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="login-submit-btn"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="login-api-status">
          <span className="status-indicator connected"></span>
          <span className="status-text">Connected to server</span>
        </div>
      </div>
    </div>
  );
};

export default Login;