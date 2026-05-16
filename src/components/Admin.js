import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import ismailiLogo from "./ismaililogo.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

const API_ROUTE_PREFIX = "/api/dashboard";
const ADMIN_PIN = "1207";

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  scope: "Regional",
  region_id: "",
  is_active: true,
};

const Admin = () => {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(
    localStorage.getItem("admin_unlocked") === "true"
  );

  const [users, setUsers] = useState([]);
  const [regions, setRegions] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = editingId !== null;

  const regionalUsers = useMemo(() => {
    return users.filter((u) => u.scope === "Regional").length;
  }, [users]);

  const nationalUsers = useMemo(() => {
    return users.filter((u) => u.scope === "National").length;
  }, [users]);

  const activeUsers = useMemo(() => {
    return users.filter((u) => u.is_active).length;
  }, [users]);

  const clearAlerts = () => {
    setMessage("");
    setError("");
  };

  const showSuccess = (text) => {
    setMessage(text);
    setError("");
  };

  const showError = (text) => {
    setError(text);
    setMessage("");
  };

  const unlockAdmin = (e) => {
    e.preventDefault();

    if (pin.trim() !== ADMIN_PIN) {
      showError("Invalid admin PIN.");
      return;
    }

    localStorage.setItem("admin_unlocked", "true");
    setUnlocked(true);
    setPin("");
    clearAlerts();
  };

  const lockAdmin = () => {
    localStorage.removeItem("admin_unlocked");
    setUnlocked(false);
    setPin("");
    setUsers([]);
    setRegions([]);
    clearAlerts();
  };

  const fetchUsers = async () => {
    setLoading(true);
    clearAlerts();

    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTE_PREFIX}/admin/users`);
      const payload = await response.json();

      if (!response.ok) {
        showError(payload?.detail || payload?.message || "Failed to load users.");
        return;
      }

      setUsers(payload.users || []);
    } catch (err) {
      showError("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTE_PREFIX}/admin/regions`);
      const payload = await response.json();

      if (response.ok) {
        setRegions(payload.regions || []);
      }
    } catch (err) {
      setRegions([]);
    }
  };

  useEffect(() => {
    if (unlocked) {
      fetchUsers();
      fetchRegions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const handleChange = (field, value) => {
    clearAlerts();

    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "scope" && value === "National") {
        next.region_id = "";
      }

      return next;
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    clearAlerts();
  };

  const validateForm = () => {
    if (!form.full_name.trim()) {
      showError("Full name is required.");
      return false;
    }

    if (!form.email.trim()) {
      showError("Email is required.");
      return false;
    }

    if (!isEditing && !form.password.trim()) {
      showError("Password is required for new user.");
      return false;
    }

    if (form.scope === "Regional" && !form.region_id) {
      showError("Region ID is required for Regional user.");
      return false;
    }

    return true;
  };

  const submitForm = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    clearAlerts();

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        scope: form.scope,
        region_id: form.scope === "Regional" ? Number(form.region_id) : null,
        is_active: Boolean(form.is_active),
      };

      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      const url = isEditing
        ? `${API_BASE_URL}${API_ROUTE_PREFIX}/admin/users/${editingId}`
        : `${API_BASE_URL}${API_ROUTE_PREFIX}/admin/users`;

      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result?.detail || result?.message || "Request failed.");
        return;
      }

      showSuccess(isEditing ? "User updated successfully." : "User created successfully.");
      resetForm();
      fetchUsers();
    } catch (err) {
      showError("Unable to save user. Check backend.");
    } finally {
      setSaving(false);
    }
  };

  const editUser = (user) => {
    clearAlerts();

    setEditingId(user.id);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      scope: user.scope || "Regional",
      region_id: user.scope === "Regional" ? String(user.region_id || "") : "",
      is_active: Boolean(user.is_active),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (user) => {
    setSaving(true);
    clearAlerts();

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ROUTE_PREFIX}/admin/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            is_active: !user.is_active,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showError(result?.detail || "Failed to update status.");
        return;
      }

      showSuccess("User status updated.");
      fetchUsers();
    } catch (err) {
      showError("Unable to update user status.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    const ok = window.confirm(`Delete ${user.email}?`);

    if (!ok) return;

    setSaving(true);
    clearAlerts();

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ROUTE_PREFIX}/admin/users/${user.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showError(result?.detail || "Failed to delete user.");
        return;
      }

      showSuccess("User deleted successfully.");
      fetchUsers();

      if (editingId === user.id) {
        resetForm();
      }
    } catch (err) {
      showError("Unable to delete user.");
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="admin-page admin-pin-page">
        <div className="admin-pin-card">
          <div className="admin-logo-wrap">
            <img src={ismailiLogo} alt="Ismaili Logo" />
          </div>

          <h1>Admin Access</h1>
          <p>Enter admin PIN to manage dashboard users.</p>

          {error && <div className="admin-alert error">{error}</div>}

          <form onSubmit={unlockAdmin} className="admin-pin-form">
            <label>Admin PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                clearAlerts();
              }}
              placeholder="Enter PIN"
              autoFocus
            />

            <button type="submit">Unlock Admin Panel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <img src={ismailiLogo} alt="Ismaili Logo" />

            <div>
              <p>Dashboard Admin</p>
              <h1>User Management</h1>
              <span>Create users, assign dashboard access and regions.</span>
            </div>
          </div>

          <div className="admin-header-actions">
            <button type="button" onClick={fetchUsers} className="admin-refresh-btn">
              Refresh
            </button>

            <button type="button" onClick={lockAdmin} className="admin-lock-btn">
              Lock
            </button>
          </div>
        </div>
      </header>

      <main className="admin-container">
        <section className="admin-stats-grid">
          <div className="admin-stat-card">
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Active Users</span>
            <strong>{activeUsers}</strong>
          </div>

          <div className="admin-stat-card">
            <span>National Users</span>
            <strong>{nationalUsers}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Regional Users</span>
            <strong>{regionalUsers}</strong>
          </div>
        </section>

        {message && <div className="admin-alert success">{message}</div>}
        {error && <div className="admin-alert error">{error}</div>}

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>{isEditing ? "Edit Dashboard User" : "Add New Dashboard User"}</h2>
              <p>
                {isEditing
                  ? "Update user details, password, dashboard scope or region."
                  : "Create a new National or Regional dashboard account."}
              </p>
            </div>

            {isEditing && (
              <button type="button" className="admin-clear-btn" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={submitForm} className="admin-form">
            <div className="admin-field">
              <label>Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="e.g. Aliyan Sayani"
              />
            </div>

            <div className="admin-field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="admin-field">
              <label>
                Password {isEditing && <span>leave blank to keep old password</span>}
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder={isEditing ? "New password optional" : "Enter password"}
              />
            </div>

            <div className="admin-field">
              <label>Dashboard Scope</label>
              <select
                value={form.scope}
                onChange={(e) => handleChange("scope", e.target.value)}
              >
                <option value="National">National</option>
                <option value="Regional">Regional</option>
              </select>
            </div>

            <div className="admin-field">
              <label>Region ID</label>
              <select
                value={form.region_id}
                onChange={(e) => handleChange("region_id", e.target.value)}
                disabled={form.scope === "National"}
              >
                <option value="">
                  {form.scope === "National" ? "Not required for National" : "Select Region"}
                </option>

                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.id} — {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-field admin-checkbox-field">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleChange("is_active", e.target.checked)}
                />
                <span>Active user</span>
              </label>
            </div>

            <div className="admin-form-actions">
              <button type="submit" disabled={saving} className="admin-submit-btn">
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update User"
                    : "Add User"}
              </button>

              <button type="button" onClick={resetForm} className="admin-secondary-btn">
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Dashboard Users</h2>
              <p>Manage National and Regional dashboard accounts.</p>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading">
              <img src={ismailiLogo} alt="Loading" />
              <p>Loading users...</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Scope</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>

                        <td>
                          <div className="admin-user-cell">
                            <strong>{user.full_name}</strong>
                            <span>{user.email}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`admin-scope-pill ${
                              user.scope === "National" ? "national" : "regional"
                            }`}
                          >
                            {user.scope}
                          </span>
                        </td>

                        <td>
                          {user.scope === "National"
                            ? "All Regions"
                            : user.region_name
                              ? `${user.region_id} — ${user.region_name}`
                              : user.region_id || "-"}
                        </td>

                        <td>
                          <span
                            className={`admin-status-pill ${
                              user.is_active ? "active" : "inactive"
                            }`}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td>{user.created_at ? user.created_at.slice(0, 10) : "-"}</td>

                        <td>
                          <div className="admin-row-actions">
                            <button type="button" onClick={() => editUser(user)}>
                              Edit
                            </button>

                            <button type="button" onClick={() => toggleActive(user)}>
                              {user.is_active ? "Disable" : "Enable"}
                            </button>

                            <button
                              type="button"
                              className="danger"
                              onClick={() => deleteUser(user)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="admin-empty">
                        No dashboard users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;