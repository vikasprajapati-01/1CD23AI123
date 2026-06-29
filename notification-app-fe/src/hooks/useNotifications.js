import { useState, useEffect } from "react";
import { fetchNotifications } from "../api/notifications";
import log from "../utils/logger";

export function useNotifications(page = 1, type = "") {
  const [notifications, setNotifications] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    log("info", "hook", "useNotifications triggered");
    setLoading(true);
    setError(null);

    fetchNotifications(page, 20, type)
      .then(data => {
        setNotifications(data.notifications || []);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
        log("info", "hook", "Notifications loaded");
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
        log("error", "hook", `Error: ${err.message}`);
      });
  }, [page, type]);

  return { notifications, totalPages, loading, error };
}