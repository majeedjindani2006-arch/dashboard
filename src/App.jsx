import { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Admin from "./components/Admin.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const path = window.location.pathname;

  useEffect(() => {
    const storedUser = localStorage.getItem("dashboard_user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored user", err);
        localStorage.removeItem("dashboard_user");
      }
    }

    setIsLoading(false);
  }, []);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem("dashboard_user", JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("dashboard_user");
    window.history.pushState({}, "", "/");
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFD",
          color: "#111C2D",
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          fontSize: "18px",
          fontWeight: 700,
        }}
      >
        Loading...
      </div>
    );
  }

  if (path === "/admin") {
    return <Admin />;
  }

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;