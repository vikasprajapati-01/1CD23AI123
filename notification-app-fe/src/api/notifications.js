import log from "../utils/logger";

const API = "http://4.224.186.213/evaluation-service/notifications";

export async function fetchNotifications(page = 1, limit = 20, type = "") {
  log("info", "api", `Fetching page=${page} type=${type}`);
  const token = localStorage.getItem("token");

  let url = `${API}?page=${page}&limit=${limit}`;
  if (type && type !== "All") url += `&notification_type=${type}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  log("info", "api", `Got ${data.notifications?.length} notifications`);
  return data;
}