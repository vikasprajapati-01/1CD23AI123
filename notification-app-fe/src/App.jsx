import { useState } from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PriorityPage } from "./pages/PriorityPage";
import log from "./utils/logger";

export default function App() {
  const [page, setPage] = useState("all");

  function navigate(to) {
    log("info", "component", `Navigate to ${to}`);
    setPage(to);
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Campus Notifications</Typography>
          <Button color="inherit" onClick={() => navigate("all")}>All</Button>
          <Button color="inherit" onClick={() => navigate("priority")}>Priority</Button>
        </Toolbar>
      </AppBar>
      <Box mt={2}>
        {page === "all" ? <NotificationsPage /> : <PriorityPage />}
      </Box>
    </>
  );
}