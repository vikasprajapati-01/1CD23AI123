# Notification System Design

## Stage 1

### Core Actions
The notification platform needs to support:
- Fetching all notifications for a logged-in student
- Fetching only unread notifications
- Marking a notification as read
- Sending a new notification (used by HR/admin)

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /notifications | Get all notifications for a student |
| GET | /notifications/unread | Get only unread notifications |
| PATCH | /notifications/:id/read | Mark a notification as read |
| POST | /notifications | Create a new notification (admin) |

### Headers (all requests)
```
Authorization: Bearer <token>
Content-Type: application/json
```

### GET /notifications
**Request**
```
GET /notifications?studentId=1042
```
**Response**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "studentId": "1042",
      "type": "Placement",
      "message": "Google is visiting campus on July 5th",
      "isRead": false,
      "createdAt": "2026-06-29T10:00:00Z"
    }
  ]
}
```

### GET /notifications/unread
**Request**
```
GET /notifications/unread?studentId=1042
```
**Response**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "studentId": "1042",
      "type": "Result",
      "message": "Your mid-sem result is published",
      "isRead": false,
      "createdAt": "2026-06-28T08:00:00Z"
    }
  ]
}
```

### PATCH /notifications/:id/read
**Request**
```
PATCH /notifications/uuid-here/read
```
**Response**
```json
{
  "message": "Notification marked as read",
  "id": "uuid-here"
}
```

### POST /notifications
**Request**
```json
{
  "studentId": "1042",
  "type": "Event",
  "message": "Tech fest registration is now open"
}
```
**Response**
```json
{
  "message": "Notification created",
  "id": "uuid-here",
  "createdAt": "2026-06-29T10:05:00Z"
}
```

### Notification Type Enum
```
Event | Result | Placement
```

### Real-time Mechanism
Using **Server-Sent Events (SSE)**.

Reason: Students only need to receive updates, not send them.
SSE is simpler than WebSockets for one-way streaming, works over plain HTTP,
and doesn't need extra libraries on the client side.

Endpoint: `GET /notifications/stream?studentId=1042`
The server pushes a new event whenever a notification is created for that student.