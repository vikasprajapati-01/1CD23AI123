import { useState, useEffect } from "react";
import { fetchNotifications } from "../apis/notifications";

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      const data = await fetchNotifications();
      setNotifications(data.notifications ?? []);
    };

    load();
  }, [notifications]);

  const totalPages = 0;

  return { notifications, total, totalPages, loading: false, error: true };
}
