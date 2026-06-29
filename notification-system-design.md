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

## Stage 2

### Database Choice — PostgreSQL

I'm going with PostgreSQL because the data is structured and relational.
Each notification belongs to a student, has a fixed type, and needs to be
queried by studentId and read status frequently. PostgreSQL handles this
well with proper indexing and supports JSON if we ever need to extend the
notification payload.

### Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(50) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('Event', 'Result', 'Placement')) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### REST API to DB Mapping

| API | Query |
|-----|-------|
| GET /notifications | SELECT * FROM notifications WHERE student_id = $1 ORDER BY created_at DESC |
| GET /notifications/unread | SELECT * FROM notifications WHERE student_id = $1 AND is_read = false |
| PATCH /notifications/:id/read | UPDATE notifications SET is_read = true WHERE id = $1 |
| POST /notifications | INSERT INTO notifications (student_id, type, message) VALUES ($1, $2, $3) |

### Problems as Data Volume Increases

As the platform scales to 50,000 students with millions of notifications:

1. **Full table scans** — Without indexes, every query scans all rows.
   Fix: Add index on `student_id` and `created_at`.

2. **Fetching all rows** — `SELECT *` returns everything including already-read
   old notifications nobody needs.
   Fix: Add pagination (`LIMIT` and `OFFSET`) on all list endpoints.

3. **Write bottleneck** — When HR sends to 50,000 students at once, 50,000
   inserts hit the DB simultaneously.
   Fix: Use a message queue (covered in Stage 5).

### Indexes to Add

```sql
CREATE INDEX idx_notifications_student_id ON notifications(student_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_student_unread ON notifications(student_id, is_read);
```