import { useState, useEffect } from "react";
import {
  Box, CircularProgress, Slider,
  Stack, Typography, Divider
} from "@mui/material";
import { fetchNotifications } from "../api/notifications";
import { NotificationCard } from "../components/NotificationCard";
import log from "../utils/logger";

const WEIGHTS = { Placement: 3, Result: 2, Event: 1 };

function getScore(n) {
  const weight = WEIGHTS[n.Type] || 1;
  const ageInHours = (Date.now() - new Date(n.Timestamp).getTime()) / (1000 * 60 * 60);
  return weight * (1 / (ageInHours + 1));
}

export function PriorityPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topN, setTopN] = useState(10);

  useEffect(() => {
    log("info", "page", "PriorityPage mounted");
    fetchNotifications(1, 100)
      .then(data => {
        const scored = (data.notifications || [])
          .map(n => ({ ...n, score: getScore(n) }))
          .sort((a, b) => b.score - a.score);
        setNotifications(scored);
        setLoading(false);
        log("info", "page", "Priority notifications loaded");
      })
      .catch(err => {
        log("error", "page", `Failed: ${err.message}`);
        setLoading(false);
      });
  }, []);

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>Priority Inbox</Typography>
      <Divider sx={{ mb: 3 }} />

      <Box sx={{ width: 300, mb: 3 }}>
        <Typography variant="body2">Top N: {topN}</Typography>
        <Slider value={topN} min={5} max={20} step={5} marks onChange={(_, v) => setTopN(v)} />
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {notifications.slice(0, topN).map(n => (
            <NotificationCard key={n.ID} notification={n} priority />
          ))}
        </Stack>
      )}
    </Box>
  );
}