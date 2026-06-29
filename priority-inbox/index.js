require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const API = "http://4.224.186.213/evaluation-service/notifications";
const TOKEN = process.env.TOKEN;
const TOP_N = 10;

const WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function getScore(notification) {
  const weight = WEIGHTS[notification.Type] || 1;
  const ageInHours = (Date.now() - new Date(notification.Timestamp).getTime()) / (1000 * 60 * 60);
  const recency = 1 / (ageInHours + 1);
  return weight * recency;
}

async function getTopNotifications() {
  const res = await fetch(API, {
    headers: {
      Authorization: `Bearer ${TOKEN}`
    }
  });

  const data = await res.json();
  const notifications = data.notifications;

  const scored = notifications.map(n => ({
    ...n,
    score: getScore(n)
  }));

  // Sort by score descending, take top N
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  console.log(`\nTop ${TOP_N} Priority Notifications:\n`);
  top.forEach((n, i) => {
    console.log(`${i + 1}. [${n.Type}] ${n.Message}`);
    console.log(`   Timestamp: ${n.Timestamp}`);
    console.log(`   Score: ${n.score.toFixed(4)}\n`);
  });
}

getTopNotifications().catch(console.error);