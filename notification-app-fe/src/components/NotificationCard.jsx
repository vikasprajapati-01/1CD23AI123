import { Card, CardContent, Typography, Chip, Box } from "@mui/material";

const typeColors = { Placement: "success", Result: "warning", Event: "info" };

export function NotificationCard({ notification, priority }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `4px solid`,
        borderLeftColor: notification.isRead ? "#ccc" : "primary.main",
        opacity: notification.isRead ? 0.65 : 1
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Chip
            label={notification.Type}
            color={typeColors[notification.Type] || "default"}
            size="small"
          />
          {priority && (
            <Typography variant="caption" color="text.secondary">
              Score: {notification.score?.toFixed(3)}
            </Typography>
          )}
        </Box>
        <Typography variant="body1" mt={1}>{notification.Message}</Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(notification.Timestamp).toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  );
}