const LOG_ENDPOINT = "http://20.244.56.144/evaluation-service/logs";

async function log(level, pkg, message) {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ stack: "frontend", level, package: pkg, message })
    });
  } catch (e) {
    console.error("Log failed:", e.message);
  }
}

export default log;