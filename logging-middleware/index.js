const LOG_ENDPOINT = "http://20.244.56.144/evaluation-service/logs";
require('dotenv').config();
let TOKEN = process.env.TOKEN;

function setToken(token) { 
    TOKEN = token;
}

async function log(stack, level, pkg, message) {
  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ stack, level, package: pkg, message })
    });
  } catch (e) {
    console.error("Log failed:", e.message);
  }
}

module.exports = { setToken, log };