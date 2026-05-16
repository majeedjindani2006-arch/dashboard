import { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import ismailiLogo from "./ismaililogo.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

const API_ROUTE_PREFIX = "/api/dashboard";

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const isNational = user?.scope === "National";

  const formatNumber = (value) => {
    const number = Number(value || 0);
    return number.toLocaleString();
  };

  const formatPercent = (value) => {
    const number = Number(value || 0);
    return `${number.toFixed(1)}%`;
  };

  const getRealPercent = (value, total) => {
    const v = Number(value || 0);
    const t = Number(total || 0);
    if (!t) return 0;
    return (v / t) * 100;
  };

  const getSafeProgressPercent = (value) => {
    return Math.max(0, Math.min(Number(value || 0), 100));
  };

  const getStatusLabel = (percent) => {
    const p = Number(percent || 0);
    if (p >= 80) return "Good";
    if (p >= 50) return "Average";
    return "Behind";
  };

  const getStatusClass = (percent) => {
    const p = Number(percent || 0);
    if (p >= 80) return "good";
    if (p >= 50) return "warning";
    return "danger";
  };

  const getRequiredValue = (item) => {
    return Number(item?.required ?? item?.total_required ?? 0);
  };

  const getEnrolledValue = (item) => {
    return Number(
      item?.enrolled ??
        item?.filled ??
        item?.total_filled ??
        item?.ok_count ??
        item?.approved ??
        0
    );
  };

  const getCardsPrintedValue = (item) => {
    return Number(
      item?.cards_printed ??
        item?.cardsPrinted ??
        item?.printed_count ??
        item?.printed ??
        item?.total_cards_printed ??
        item?.card_printed ??
        0
    );
  };

  const normalizeNationalEvents = (items = []) => {
    const map = new Map();

    items.forEach((item, index) => {
      const eventName = item.event_name || item.name || "Unknown Event";
      const key = item.event_id || eventName || index;

      const required = getRequiredValue(item);
      const enrolled = getEnrolledValue(item);
      const cardsPrinted = getCardsPrintedValue(item);

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: eventName,
          raw: item,
          required: 0,
          enrolled: 0,
          cardsPrinted: 0,
        });
      }

      const existing = map.get(key);
      existing.required += required;
      existing.enrolled += enrolled;
      existing.cardsPrinted += cardsPrinted;
    });

    return Array.from(map.values());
  };

  const fetchStats = async () => {
    setLoading(true);
    setError("");

    const endpoint = isNational
      ? "/stats/global-comprehensive-summary"
      : "/stats/regional-summary";

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ROUTE_PREFIX}${endpoint}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

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
            "Unable to load dashboard statistics."
        );
        setStats(null);
        return;
      }

      setStats(payload);
    } catch (err) {
      setError(
        "Unable to connect to the API. Please ensure the backend is running."
      );
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, user?.scope]);

  const nationalEvents = useMemo(() => {
    return normalizeNationalEvents(stats?.events_detailed || stats?.events || []);
  }, [stats]);

  const regionalEventSummaries = useMemo(() => {
    const events = stats?.events_detailed || [];

    return events.map((event, index) => {
      const accessLevels = event.access_levels || [];

      const required = accessLevels.reduce(
        (sum, access) => sum + Number(access.required || 0),
        0
      );

      const filled = accessLevels.reduce(
        (sum, access) => sum + Number(access.filled || 0),
        0
      );

      const approved = accessLevels.reduce((sum, access) => {
        if (access.ok_count !== undefined) {
          return sum + Number(access.ok_count || 0);
        }

        return (
          sum +
          Number(
            access.duties?.reduce(
              (dSum, duty) => dSum + Number(duty.ok_count || 0),
              0
            ) || 0
          )
        );
      }, 0);

      const printed = accessLevels.reduce((sum, access) => {
        if (access.printed_count !== undefined) {
          return sum + Number(access.printed_count || 0);
        }

        return (
          sum +
          Number(
            access.duties?.reduce(
              (dSum, duty) => dSum + Number(duty.printed_count || 0),
              0
            ) || 0
          )
        );
      }, 0);

      const remaining = Math.max(required - filled, 0);
      const percentage = getRealPercent(filled, required);

      return {
        id: event.event_id || index,
        name: event.event_name || "Unknown Event",
        regionName: event.region_name || "",
        required,
        filled,
        remaining,
        approved,
        printed,
        percentage,
        raw: event,
      };
    });
  }, [stats]);

  const regionalTotals = useMemo(() => {
    const totalRequired = regionalEventSummaries.reduce(
      (sum, item) => sum + item.required,
      0
    );

    const totalFilled = regionalEventSummaries.reduce(
      (sum, item) => sum + item.filled,
      0
    );

    const totalApproved = regionalEventSummaries.reduce(
      (sum, item) => sum + item.approved,
      0
    );

    const totalPrinted = regionalEventSummaries.reduce(
      (sum, item) => sum + item.printed,
      0
    );

    const fallbackStats = stats?.overall_regional_stats || {};

    const requiredFromApi = Number(fallbackStats.total_required || 0);
    const filledFromApi = Number(fallbackStats.total_filled || 0);
    const remainingFromApi = Number(fallbackStats.total_remaining || 0);
    const percentFromApi = Number(fallbackStats.total_percentage || 0);

    const finalRequired = totalRequired || requiredFromApi;
    const finalFilled = totalFilled || filledFromApi;
    const finalRemaining =
      totalRequired || totalFilled
        ? Math.max(finalRequired - finalFilled, 0)
        : remainingFromApi;

    const finalPercent =
      totalRequired || totalFilled
        ? getRealPercent(finalFilled, finalRequired)
        : percentFromApi;

    return {
      totalRequired: finalRequired,
      totalFilled: finalFilled,
      totalRemaining: finalRemaining,
      totalPercentage: finalPercent,
      totalApproved,
      totalPrinted,
    };
  }, [regionalEventSummaries, stats]);

  const nationalTotals = useMemo(() => {
    const totalRequired = nationalEvents.reduce(
      (sum, item) => sum + Number(item.required || 0),
      0
    );

    const totalEnrolled = nationalEvents.reduce(
      (sum, item) => sum + Number(item.enrolled || 0),
      0
    );

    const totalCardsPrinted = nationalEvents.reduce(
      (sum, item) => sum + Number(item.cardsPrinted || 0),
      0
    );

    const enrollmentPercent = getRealPercent(totalEnrolled, totalRequired);
    const cardsPercent = getRealPercent(totalCardsPrinted, totalRequired);

    return {
      totalEvents: nationalEvents.length,
      totalRequired,
      totalEnrolled,
      totalCardsPrinted,
      remainingEnrollment: Math.max(totalRequired - totalEnrolled, 0),
      remainingCards: Math.max(totalRequired - totalCardsPrinted, 0),
      enrollmentPercent,
      cardsPercent,
    };
  }, [nationalEvents]);

  const totals = isNational
    ? nationalTotals
    : {
        totalEvents: regionalEventSummaries.length,
        totalRequired: regionalTotals.totalRequired,
        totalEnrolled: regionalTotals.totalFilled,
        totalCardsPrinted: regionalTotals.totalPrinted,
        remainingEnrollment: regionalTotals.totalRemaining,
        remainingCards: Math.max(
          regionalTotals.totalRequired - regionalTotals.totalPrinted,
          0
        ),
        enrollmentPercent: regionalTotals.totalPercentage,
        cardsPercent: getRealPercent(
          regionalTotals.totalPrinted,
          regionalTotals.totalRequired
        ),
      };

  const lastUpdated =
    stats?.lastUpdated ||
    stats?.last_updated ||
    stats?.generated_at ||
    new Date().toLocaleString();

  const renderProgress = (percent, type = "green") => {
    const progress = getSafeProgressPercent(percent);

    return (
      <div className="dashboard-progress-wrap">
        <div
          className={`dashboard-progress-bar ${type}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  const renderStatus = (percent) => {
    return (
      <span className={`dashboard-status ${getStatusClass(percent)}`}>
        {getStatusLabel(percent)}
      </span>
    );
  };

  const openNationalDetail = (event) => {
    const enrollmentPercent = getRealPercent(event.enrolled, event.required);
    const cardsPercent = getRealPercent(event.cardsPrinted, event.required);

    setSelectedDetail({
      type: "national",
      title: event.name,
      rows: [
        ["Required Volunteers", formatNumber(event.required)],
        ["Enrolled Volunteers", formatNumber(event.enrolled)],
        ["Remaining Enrollment", formatNumber(Math.max(event.required - event.enrolled, 0))],
        ["Enrollment Progress", formatPercent(enrollmentPercent)],
        ["Cards Printed", formatNumber(event.cardsPrinted)],
        ["Cards Remaining", formatNumber(Math.max(event.required - event.cardsPrinted, 0))],
        ["Cards Progress", formatPercent(cardsPercent)],
        ["Status", getStatusLabel(enrollmentPercent)],
      ],
      raw: event.raw,
    });
  };

  const openRegionalDetail = (item, level = "event") => {
    if (level === "event") {
      setSelectedDetail({
        type: "regional-event",
        title: item.name,
        rows: [
          ["Region", item.regionName || "-"],
          ["Required", formatNumber(item.required)],
          ["Filled", formatNumber(item.filled)],
          ["Remaining", formatNumber(item.remaining)],
          ["Filled %", formatPercent(item.percentage)],
          ["Approved", formatNumber(item.approved)],
          ["Printed", formatNumber(item.printed)],
          ["Access Levels", formatNumber(item.raw?.access_levels?.length || 0)],
        ],
        event: item.raw,
      });

      return;
    }

    setSelectedDetail(item);
  };

  const renderNationalEnrollmentRow = (event, index) => {
    const percent = getRealPercent(event.enrolled, event.required);

    return (
      <tr key={`national-enrollment-${event.id}-${index}`}>
        <td>{index + 1}</td>
        <td>{event.name}</td>
        <td>{formatNumber(event.required)}</td>
        <td>{formatNumber(event.enrolled)}</td>
        <td>{renderProgress(percent, "green")}</td>
        <td>{percent.toFixed(1)}%</td>
        <td>{renderStatus(percent)}</td>
        <td>
          <button
            type="button"
            className="dashboard-detail-btn"
            onClick={() => openNationalDetail(event)}
          >
            Details
          </button>
        </td>
      </tr>
    );
  };

  const renderNationalCardsRow = (event, index) => {
    const percent = getRealPercent(event.cardsPrinted, event.required);

    return (
      <tr key={`national-cards-${event.id}-${index}`}>
        <td>{index + 1}</td>
        <td>{event.name}</td>
        <td>{formatNumber(event.required)}</td>
        <td>{formatNumber(event.cardsPrinted)}</td>
        <td>{renderProgress(percent, "blue")}</td>
        <td>{percent.toFixed(1)}%</td>
        <td>{renderStatus(percent)}</td>
        <td>
          <button
            type="button"
            className="dashboard-detail-btn"
            onClick={() => openNationalDetail(event)}
          >
            Details
          </button>
        </td>
      </tr>
    );
  };

  const renderRegionalRows = () => {
    if (!stats?.events_detailed?.length) {
      return (
        <tr>
          <td className="dashboard-empty" colSpan={9}>
            No access level statistics found.
          </td>
        </tr>
      );
    }

    return stats.events_detailed.flatMap((event, eventIndex) => {
      const rows = [];
      const eventKey = event.event_id || eventIndex;
      const eventSummary =
        regionalEventSummaries.find((x) => String(x.id) === String(eventKey)) ||
        regionalEventSummaries[eventIndex];

      rows.push(
        <tr key={`event-${eventKey}`} className="dashboard-group-row">
          <td colSpan={9}>
            <div className="regional-group-title">
              <span>
                {event.event_name || "Unknown Event"}
                {event.region_name ? ` — ${event.region_name}` : ""}
              </span>

              <button
                type="button"
                className="dashboard-detail-btn small"
                onClick={() => openRegionalDetail(eventSummary, "event")}
              >
                Event Details
              </button>
            </div>
          </td>
        </tr>
      );

      if (!event.access_levels || event.access_levels.length === 0) {
        rows.push(
          <tr key={`no-access-${eventKey}`}>
            <td className="dashboard-empty" colSpan={9}>
              No access levels found for this event.
            </td>
          </tr>
        );

        return rows;
      }

      event.access_levels.forEach((accessLevel, accessIndex) => {
        const accessKey = accessLevel.access_level_id || accessIndex;
        const duties = accessLevel.duties || [];

        const dutyApproved = duties.reduce(
          (sum, duty) => sum + Number(duty.ok_count || 0),
          0
        );

        const dutyPrinted = duties.reduce(
          (sum, duty) => sum + Number(duty.printed_count || 0),
          0
        );

        const approved =
          accessLevel.ok_count !== undefined
            ? Number(accessLevel.ok_count || 0)
            : dutyApproved;

        const printed =
          accessLevel.printed_count !== undefined
            ? Number(accessLevel.printed_count || 0)
            : dutyPrinted;

        const detailPayload = {
          type: "access-level",
          title:
            accessLevel.name ||
            accessLevel.access_level_name ||
            "Unknown Access Level",
          rows: [
            ["Event", event.event_name || "-"],
            ["Region", event.region_name || "-"],
            ["Required", formatNumber(accessLevel.required)],
            ["Filled", formatNumber(accessLevel.filled)],
            ["Remaining", formatNumber(accessLevel.remaining)],
            ["Filled %", formatPercent(accessLevel.percentage)],
            ["Approved", formatNumber(approved)],
            ["Printed", formatNumber(printed)],
            ["Duties", formatNumber(duties.length)],
          ],
          duties,
        };

        rows.push(
          <tr
            key={`access-${eventKey}-${accessKey}`}
            className="dashboard-access-row"
          >
            <td>{event.event_name || "Unknown"}</td>
            <td>
              {accessLevel.name ||
                accessLevel.access_level_name ||
                "Unknown Access Level"}
            </td>
            <td>{formatNumber(accessLevel.required)}</td>
            <td>{formatNumber(accessLevel.remaining)}</td>
            <td>{formatNumber(accessLevel.filled)}</td>
            <td>{formatPercent(accessLevel.percentage)}</td>
            <td>{formatNumber(approved)}</td>
            <td>{formatNumber(printed)}</td>
            <td>
              <button
                type="button"
                className="dashboard-detail-btn"
                onClick={() => openRegionalDetail(detailPayload, "access")}
              >
                Details
              </button>
            </td>
          </tr>
        );

        duties.forEach((duty, dutyIndex) => {
          const dutyKey = duty.duty_id || dutyIndex;

          const dutyDetailPayload = {
            type: "duty",
            title: duty.duty_name || duty.name || "Unknown Duty",
            rows: [
              ["Event", event.event_name || "-"],
              ["Access Level", detailPayload.title],
              ["Required", formatNumber(duty.required)],
              ["Filled", formatNumber(duty.filled)],
              ["Remaining", formatNumber(duty.remaining)],
              ["Filled %", formatPercent(duty.percentage)],
              ["Approved", formatNumber(duty.ok_count)],
              ["Printed", formatNumber(duty.printed_count)],
            ],
          };

          rows.push(
            <tr
              key={`duty-${eventKey}-${accessKey}-${dutyKey}`}
              className="dashboard-duty-row"
            >
              <td></td>
              <td className="dashboard-duty-name">
                ↳ {duty.duty_name || duty.name || "Unknown Duty"}
              </td>
              <td>{formatNumber(duty.required)}</td>
              <td>{formatNumber(duty.remaining)}</td>
              <td>{formatNumber(duty.filled)}</td>
              <td>{formatPercent(duty.percentage)}</td>
              <td>{formatNumber(duty.ok_count)}</td>
              <td>{formatNumber(duty.printed_count)}</td>
              <td>
                <button
                  type="button"
                  className="dashboard-detail-btn light"
                  onClick={() => openRegionalDetail(dutyDetailPayload, "duty")}
                >
                  Details
                </button>
              </td>
            </tr>
          );
        });
      });

      return rows;
    });
  };

  const closeDetail = () => {
    setSelectedDetail(null);
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-inner">
          <div className="dashboard-brand">
            <img
              src={ismailiLogo}
              alt="Ismaili Logo"
              className="dashboard-logo"
            />

            <div>
              <p className="dashboard-kicker">
                {isNational ? "National Dashboard" : "Regional Dashboard"}
              </p>
              <h1>Pakistan Didar 2026</h1>
              <p className="dashboard-header-subtitle">
                Volunteer Enrollment & Cards Printed Dashboard
              </p>
            </div>
          </div>

          <div className="dashboard-user-box">
            <div>
              <span>Signed in as</span>
              <strong>{user?.name || user?.email}</strong>
            </div>

            <button
              type="button"
              onClick={fetchStats}
              className="dashboard-refresh-btn"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="dashboard-logout-btn"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-container">
        {loading ? (
          <div className="dashboard-loader-card">
            <img
              src={ismailiLogo}
              alt="Loading"
              className="dashboard-loader-logo"
            />
            <p>Loading dashboard data...</p>
          </div>
        ) : error ? (
          <div className="dashboard-error-card">
            <h3>Unable to load dashboard</h3>
            <p>{error}</p>
            <button type="button" onClick={fetchStats}>
              Try Again
            </button>
          </div>
        ) : stats ? (
          <>
            <section className="dashboard-section">
              <h2 className="dashboard-title">
                Dashboard 1: Required vs Enrolled Volunteers
              </h2>
              <p className="dashboard-section-subtitle">
                Overall enrollment progress across all events.
              </p>

              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <h3>Total Events</h3>
                  <div className="dashboard-card-value">
                    {formatNumber(totals.totalEvents)}
                  </div>
                  <div className="dashboard-card-small">All Events</div>
                </div>

                <div className="dashboard-card">
                  <h3>Total Required</h3>
                  <div className="dashboard-card-value">
                    {formatNumber(totals.totalRequired)}
                  </div>
                  <div className="dashboard-card-small">
                    Required Volunteers
                  </div>
                </div>

                <div className="dashboard-card">
                  <h3>Total Enrolled</h3>
                  <div className="dashboard-card-value">
                    {formatNumber(totals.totalEnrolled)}
                  </div>
                  <div className="dashboard-card-small">
                    Enrolled Volunteers
                  </div>
                </div>

                <div className="dashboard-card">
                  <h3>Enrollment Progress</h3>
                  <div className="dashboard-card-value">
                    {totals.enrollmentPercent.toFixed(1)}%
                  </div>
                  <div className="dashboard-card-small">Overall Progress</div>
                </div>
              </div>

              {!isNational && regionalEventSummaries.length > 1 && (
                <div className="regional-event-cards">
                  {regionalEventSummaries.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className="regional-event-card"
                      onClick={() => openRegionalDetail(event, "event")}
                    >
                      <span>{event.name}</span>
                      <strong>{formatPercent(event.percentage)}</strong>
                      <small>
                        {formatNumber(event.filled)} / {formatNumber(event.required)} filled
                      </small>
                    </button>
                  ))}
                </div>
              )}

              {isNational ? (
                <div className="dashboard-grid">
                  <div className="dashboard-table-card">
                    <div className="dashboard-table-wrap">
                      <table className="dashboard-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Event</th>
                            <th>Required</th>
                            <th>Enrolled</th>
                            <th>Progress</th>
                            <th>%</th>
                            <th>Status</th>
                            <th>Details</th>
                          </tr>
                        </thead>

                        <tbody>
                          {nationalEvents.length > 0 ? (
                            <>
                              {nationalEvents.map(renderNationalEnrollmentRow)}

                              <tr className="dashboard-total-row">
                                <td colSpan="2">TOTAL</td>
                                <td>{formatNumber(totals.totalRequired)}</td>
                                <td>{formatNumber(totals.totalEnrolled)}</td>
                                <td>
                                  {renderProgress(
                                    totals.enrollmentPercent,
                                    "green"
                                  )}
                                </td>
                                <td>
                                  {totals.enrollmentPercent.toFixed(1)}%
                                </td>
                                <td>
                                  {renderStatus(totals.enrollmentPercent)}
                                </td>
                                <td>—</td>
                              </tr>
                            </>
                          ) : (
                            <tr>
                              <td colSpan="8" className="dashboard-empty">
                                No enrollment statistics found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="dashboard-panel">
                    <h3>Enrollment Overview</h3>

                    <div className="dashboard-big-percent">
                      {totals.enrollmentPercent.toFixed(1)}%
                    </div>

                    <div className="dashboard-center-text">
                      Overall Enrollment Progress
                    </div>

                    <div className="dashboard-overview-progress">
                      {renderProgress(totals.enrollmentPercent, "green")}
                    </div>

                    <div className="dashboard-legend">
                      <div>
                        <span>Enrolled</span>
                        <strong>{formatNumber(totals.totalEnrolled)}</strong>
                      </div>

                      <div>
                        <span>Remaining</span>
                        <strong>
                          {formatNumber(totals.remainingEnrollment)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <section className="dashboard-table-card regional-table-card">
                  <div className="dashboard-table-header">
                    <div>
                      <h3>Regional Access Level Breakdown</h3>
                      <p>
                        Access level, duty requirements, filled, approved and
                        printed statistics.
                      </p>
                    </div>

                    <span className="dashboard-record-pill">
                      {stats?.events_detailed?.length || 0} records found
                    </span>
                  </div>

                  <div className="dashboard-table-wrap">
                    <table className="dashboard-table regional-table">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Access Level / Duty</th>
                          <th>Required</th>
                          <th>Remaining</th>
                          <th>Filled</th>
                          <th>% Filled</th>
                          <th>Approved</th>
                          <th>Printed</th>
                          <th>Details</th>
                        </tr>
                      </thead>

                      <tbody>{renderRegionalRows()}</tbody>
                    </table>
                  </div>
                </section>
              )}
            </section>

            {isNational && (
              <section className="dashboard-section">
                <h2 className="dashboard-title">
                  Dashboard 2: Required vs Cards Printed
                </h2>
                <p className="dashboard-section-subtitle">
                  Cards printed progress across all events.
                </p>

                <div className="dashboard-cards">
                  <div className="dashboard-card">
                    <h3>Total Events</h3>
                    <div className="dashboard-card-value">
                      {formatNumber(totals.totalEvents)}
                    </div>
                    <div className="dashboard-card-small">All Events</div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Total Required</h3>
                    <div className="dashboard-card-value">
                      {formatNumber(totals.totalRequired)}
                    </div>
                    <div className="dashboard-card-small">
                      Required Volunteers
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Total Cards Printed</h3>
                    <div className="dashboard-card-value">
                      {formatNumber(totals.totalCardsPrinted)}
                    </div>
                    <div className="dashboard-card-small">Cards Printed</div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Cards Progress</h3>
                    <div className="dashboard-card-value">
                      {totals.cardsPercent.toFixed(1)}%
                    </div>
                    <div className="dashboard-card-small">
                      Overall Progress
                    </div>
                  </div>
                </div>

                <div className="dashboard-grid">
                  <div className="dashboard-table-card">
                    <div className="dashboard-table-wrap">
                      <table className="dashboard-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Event</th>
                            <th>Required</th>
                            <th>Cards Printed</th>
                            <th>Progress</th>
                            <th>%</th>
                            <th>Status</th>
                            <th>Details</th>
                          </tr>
                        </thead>

                        <tbody>
                          {nationalEvents.length > 0 ? (
                            <>
                              {nationalEvents.map(renderNationalCardsRow)}

                              <tr className="dashboard-total-row">
                                <td colSpan="2">TOTAL</td>
                                <td>{formatNumber(totals.totalRequired)}</td>
                                <td>
                                  {formatNumber(totals.totalCardsPrinted)}
                                </td>
                                <td>
                                  {renderProgress(totals.cardsPercent, "blue")}
                                </td>
                                <td>{totals.cardsPercent.toFixed(1)}%</td>
                                <td>{renderStatus(totals.cardsPercent)}</td>
                                <td>—</td>
                              </tr>
                            </>
                          ) : (
                            <tr>
                              <td colSpan="8" className="dashboard-empty">
                                No card statistics found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="dashboard-panel">
                    <h3>Cards Printed Overview</h3>

                    <div className="dashboard-big-percent blue-text">
                      {totals.cardsPercent.toFixed(1)}%
                    </div>

                    <div className="dashboard-center-text">
                      Overall Cards Printed Progress
                    </div>

                    <div className="dashboard-overview-progress">
                      {renderProgress(totals.cardsPercent, "blue")}
                    </div>

                    <div className="dashboard-legend">
                      <div>
                        <span>Cards Printed</span>
                        <strong>
                          {formatNumber(totals.totalCardsPrinted)}
                        </strong>
                      </div>

                      <div>
                        <span>Remaining</span>
                        <strong>{formatNumber(totals.remainingCards)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="dashboard-footer">
              Last Updated: <span>{lastUpdated}</span>
            </div>
          </>
        ) : (
          <div className="dashboard-loader-card">
            <p>No statistics found.</p>
          </div>
        )}
      </main>

      {selectedDetail && (
        <div className="dashboard-modal-overlay" onClick={closeDetail}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <div>
                <p>Details</p>
                <h3>{selectedDetail.title}</h3>
              </div>

              <button type="button" onClick={closeDetail}>
                ×
              </button>
            </div>

            <div className="dashboard-modal-body">
              <div className="dashboard-detail-list">
                {selectedDetail.rows?.map(([label, value]) => (
                  <div key={label} className="dashboard-detail-item">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              {selectedDetail.event?.access_levels?.length > 0 && (
                <div className="dashboard-modal-section">
                  <h4>Access Levels</h4>

                  {selectedDetail.event.access_levels.map((access, index) => (
                    <div key={access.access_level_id || index} className="dashboard-mini-card">
                      <strong>
                        {access.name ||
                          access.access_level_name ||
                          `Access Level ${index + 1}`}
                      </strong>
                      <span>
                        Required {formatNumber(access.required)} · Filled{" "}
                        {formatNumber(access.filled)} · Printed{" "}
                        {formatNumber(access.printed_count)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDetail.duties?.length > 0 && (
                <div className="dashboard-modal-section">
                  <h4>Duties</h4>

                  {selectedDetail.duties.map((duty, index) => (
                    <div key={duty.duty_id || index} className="dashboard-mini-card">
                      <strong>{duty.duty_name || duty.name || "Unknown Duty"}</strong>
                      <span>
                        Required {formatNumber(duty.required)} · Filled{" "}
                        {formatNumber(duty.filled)} · Approved{" "}
                        {formatNumber(duty.ok_count)} · Printed{" "}
                        {formatNumber(duty.printed_count)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;