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

## Stage 3

### Original Query

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

### Is this query accurate?

Mostly yes — it fetches unread notifications for a student ordered by time.
But there are problems with how it's written and how it performs at scale.

### Why is it slow?

1. **No index on studentID** — The DB scans every row in the table to find
   matches. With 5,000,000 rows this is extremely slow.

2. **SELECT \*** — Fetches every column including data the frontend doesn't
   need. More data = more memory = slower response.

3. **No LIMIT** — If a student has 10,000 unread notifications, all 10,000
   are returned in one shot.

### Fixed Query

```sql
SELECT id, student_id, type, message, created_at
FROM notifications
WHERE student_id = '1042' AND is_read = false
ORDER BY created_at ASC
LIMIT 50 OFFSET 0;
```

Changes made:
- Selected only needed columns instead of `*`
- Added `LIMIT` to avoid dumping thousands of rows
- Used the correct snake_case column names matching the schema

### Computation Cost (Before vs After)

| | Before | After |
|--|--------|-------|
| Rows scanned | 5,000,000 | ~few hundred (index hit) |
| Data transferred | All columns | 5 columns only |
| Time (approx) | Seconds | Milliseconds |

### Should we add indexes on every column?

**No.** This is bad advice. Here's why:

- Every index takes extra disk space
- Every INSERT and UPDATE becomes slower because all indexes need updating
- Most columns are never queried directly — indexing them wastes resources

Only index columns that appear in WHERE, ORDER BY, or JOIN clauses frequently.

### Correct indexes for this table

```sql
-- Already suggested in Stage 2, confirming they fix this query too
CREATE INDEX idx_notifications_student_id ON notifications(student_id);
CREATE INDEX idx_notifications_student_unread ON notifications(student_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

The composite index on `(student_id, is_read)` directly speeds up this query
because both columns appear in the WHERE clause together.

### Query — Placement notifications in last 7 days

Find all students who got a placement notification in the last 7 days:

```sql
SELECT DISTINCT student_id
FROM notifications
WHERE type = 'Placement'
AND created_at >= NOW() - INTERVAL '7 days';
```

This works because:
- Filters by `type = 'Placement'` using the enum we defined
- Uses `NOW() - INTERVAL '7 days'` to get the rolling 7-day window
- `DISTINCT` avoids returning the same student multiple times if they
  got more than one placement notification

## Stage 4

### Problem

Every page load triggers a DB query for every student. With 50,000 students
actively using the platform, the database gets hammered with repeated reads
for the same data — most of which hasn't even changed.

### Solution 1 — Redis Caching

Cache the notifications list per student in Redis after the first DB fetch.
Subsequent requests hit Redis instead of the DB.

```
Request → Check Redis → Hit? Return cached data
                      → Miss? Query DB → Store in Redis → Return data
```

Cache key: `notifications:student:<student_id>`
TTL: 60 seconds (so data doesn't go stale for too long)

**Tradeoffs:**
- Pros - Drastically reduces DB load
- Pros - Response time drops from ~200ms to ~5ms
- Cons - Slight data staleness (up to TTL window)
- Cons - Extra infrastructure to maintain (Redis server)
- Cons - Cache invalidation needed when a notification is marked read or created

Cache invalidation rule: whenever a notification is created or read for a
student, delete their cache key so the next request re-fetches fresh data.

```
POST /notifications → insert to DB → delete Redis key for that student
PATCH /notifications/:id/read → update DB → delete Redis key for that student
```

### Solution 2 — Pagination

Instead of loading all notifications on every page load, fetch in small pages.

```
GET /notifications?studentId=1042&page=1&limit=20
```

The DB only reads 20 rows instead of potentially thousands.
This alone reduces load significantly without any extra infrastructure.

**Tradeoffs:**
- Pros - Simple to implement, no extra services
- Pros - Less data transferred per request
- Cons - User has to scroll/click to load more
- COns - Doesn't help if all 20 rows are queried on every single page load

### Solution 3 — Read Replicas

Spin up a read-only replica of the PostgreSQL DB. All SELECT queries go to
the replica, all writes (INSERT, UPDATE) go to the primary.

**Tradeoffs:**
- Pros - Primary DB is free to handle writes only
- Pros - Scales horizontally — can add more replicas under high read load
- Cons - Replication lag means replica might be slightly behind primary
- COns - More complex infrastructure and cost

### Recommended Approach

Use all three together in layers:

1. **Pagination first** — cheapest win, implement immediately
2. **Redis cache** — add once traffic grows, cache paginated results
3. **Read replica** — add when a single DB instance can't keep up

## Stage 5

### Original Pseudocode

```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # SSE push
```

### What's wrong with this?

1. **Sequential loop** — students are notified one by one. For 50,000
   students this takes forever. If it fails at student 200, the remaining
   49,800 get nothing.

2. **No error handling** — if `send_email` fails for one student, the whole
   loop crashes. No retry, no fallback.

3. **Email and DB are coupled** — if the email API is slow, the DB insert
   waits. If DB is slow, the email waits. They should be independent.

4. **No feedback** — the HR clicking "Notify All" gets no response until
   all 50,000 are processed, which could take minutes. The request will
   likely timeout.

### What happened at student 200?

The email API probably hit a rate limit or timed out. Because there's no
retry logic and the operations are sequential, everything after 200 just
never ran.

### Redesigned Approach — Message Queue

Instead of processing inline, push all student IDs into a queue immediately
and return a response to HR right away. Workers process the queue in the
background with retries.

```
function notify_all(student_ids: array, message: string):
    job_id = generate_uuid()
    
    # Push all jobs to queue in one shot — don't loop here
    queue.push_batch([
        { student_id: id, message: message, job_id: job_id }
        for id in student_ids
    ])
    
    return { status: "queued", job_id: job_id, total: len(student_ids) }


# Worker runs separately — picks jobs from queue
function worker(job):
    try:
        # Run email and DB in parallel, not sequential
        parallel:
            send_email(job.student_id, job.message)
            save_to_db(job.student_id, job.message)
        
        push_to_app(job.student_id, job.message)
        mark_job_done(job.job_id, job.student_id)

    except error:
        if job.retry_count < 3:
            queue.push(job with retry_count + 1)  # retry
        else:
            log_failed(job.student_id, error)      # give up after 3 tries
```

### Should email and DB happen together?

**Yes, but in parallel — not sequentially.**

- They are independent operations, neither depends on the other's result
- Running them in parallel cuts the time roughly in half per student
- If email fails, DB still saves — student still sees in-app notification
- If DB fails, we retry — email already sent is fine, duplicate guard handles it

### Key improvements

| Problem | Fix |
|---------|-----|
| Fails at student 200 | Each job is independent, failure doesn't stop others |
| No retry | Queue retries up to 3 times before marking failed |
| Sequential = slow | Workers run in parallel across many jobs |
| HR waits forever | Returns immediately with job_id, HR can track progress |
| Email + DB coupled | Both run in parallel inside each worker |