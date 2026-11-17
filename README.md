# Secure Notes

Express 5 + TypeScript REST API using MongoDB/Mongoose, bcrypt password hashing,
JWT authentication. The plain HTML/JS frontend lives in a separate repository:
https://github.com/tonmoybiswas07/securenotes-frontend (no frontend template).

Live API: https://securenotes-api-rho.vercel.app

Live frontend: https://securenotes-frontend-liard.vercel.app

## Run locally

Requires Node.js 20.19+ (Node 24 recommended), npm, and MongoDB 5.2+.
Use MongoDB Atlas or a local replica set. A replica set is required for atomic
user deletion with its notes and posts.

```sh
npm install
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `JWT_SECRET` in `.env`. Set `MONGODB_URI` to your database.
For a local development database with Docker:

```sh
docker compose up -d --wait
```

The supplied Compose database binds to localhost and runs as a single-node replica
set. It has no credentials and is intended for local development only.

```sh
npm run dev
```

The API runs at **http://localhost:5001**. Its root returns API metadata.
Run the separate frontend at **http://localhost:5173** using its README.
The frontend keeps JWTs in memory; refreshing signs out. Tokens expire after one hour.

To create the first admin, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then:

```sh
npm run seed:admin
```

The seed refuses to overwrite an existing account. Public registration always
creates a `user`; it rejects a client-provided role. Subsequent admins can be
created through the admin API or UI.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Tests start an isolated temporary MongoDB replica set. The first run downloads a
MongoDB binary and requires internet access. Your configured database is not used.

## Routes

All list routes accept `page=1&limit=10`, with a maximum limit of 100. Results
are sorted by `_id` descending for consistent newest-first pagination, except
interest groups, which are sorted alphabetically. List responses include
`pagination: { page, limit, total, totalPages }`.

| Method | Route | Access / behavior |
| --- | --- | --- |
| GET | `/api/health` | Health endpoint |
| POST | `/api/auth/register` | Public: name, email, password, optional interests |
| POST | `/api/auth/login` | Public: email, password; returns user and token |
| GET | `/api/auth/me` | Current user's profile |
| GET | `/api/notes` | User's own notes; admins see everyone's notes |
| POST | `/api/notes` | Signed-in user: title, content |
| GET | `/api/notes/:id` | Owner or admin |
| PATCH | `/api/notes/:id` | Owner only: title and/or content |
| DELETE | `/api/notes/:id` | Owner only |
| GET | `/api/users` | Admin; optional exact `interest` filter |
| POST | `/api/users` | Admin: name, email, password, interests, role |
| GET | `/api/users/:id` | Admin |
| PATCH | `/api/users/:id` | Admin: any editable user fields |
| DELETE | `/api/users/:id` | Admin; atomic cascade of owned notes/posts |
| GET | `/api/users/interests` | Admin; grouped interests with pagination |
| GET | `/api/posts` | Public paginated posts |
| POST | `/api/posts` | Signed-in user: title, content |
| GET | `/api/users/:id/posts` | Public; one pipeline containing `$lookup` |

Authenticated requests require `Authorization: Bearer <token>`. Admins can view
other people's notes but cannot edit or delete them. Admins cannot delete or
demote their own account. Roles are loaded from the database on every authenticated
request, so account deletion and role revocation affect existing tokens immediately.
Password changes do not revoke existing tokens; they expire normally within one hour.

PATCH requests reject unknown fields and empty updates. Passwords require at least
8 characters and at most 72 UTF-8 bytes, matching bcrypt's input limit. Password
hashes never appear in API responses. Auth endpoints and the API have IP rate limits.

## Aggregations

**Group by interests:** `GET /api/users/interests?interest=chess&page=1&limit=10&usersPerGroup=10`
executes exactly one `User.collection.aggregate()` call and no separate database
queries. It matches profiles, unwinds interests, groups by interest, and uses a facet
for group pagination and total count. `$topN` keeps a bounded newest-user preview
per group; `totalUsers` reports full membership. `usersPerGroup` is between 1 and 100.
Use the paginated `/api/users?interest=chess` route to browse all members of a group.
This avoids unlimited `$push` arrays. Users without interests are excluded.

**User posts:** `GET /api/users/:id/posts?page=1&limit=10` matches the user by indexed
`_id`, then joins Posts using `$lookup` on `author`. The nested pipeline sorts and
paginates posts and counts them using `$facet`. It never loads every post into the
lookup result. Missing users return 404; existing users without posts return an
empty list and total 0. User profiles and password hashes are not returned.

## Index rationale

All custom indexes are explicitly declared with `schema.index()`:

| Collection | Index | Purpose |
| --- | --- | --- |
| Users | `{ email: 1 }`, unique | Login lookup and duplicate email prevention |
| Users | `{ interests: 1, _id: -1 }` | Exact-interest filtering and ordered membership lists; initial interest match in aggregation |
| Notes | `{ owner: 1, _id: -1 }` | Own-note list and cascade deletion |
| Posts | `{ author: 1, _id: -1 }` | User-post lookup, ordered posts and cascade deletion |

MongoDB automatically creates `_id` indexes. They support profile/single-note
reads, user lists, admin note lists, and global post lists. No duplicate `_id`,
standalone owner/author, role, or timestamp indexes are added. Grouping all interests
must process all relevant profiles; an index cannot eliminate that work or index
the computed group order. `$facet` totals also require examining all matched rows.
Offset pagination may slow down on very deep pages; this implementation caps pages
at 100,000 and page sizes at 100.

Startup waits for index creation before accepting requests. On an existing database,
review existing indexes separately: this application does not drop old indexes.

## Short explanation (বাংলা)

1. **User model:** account, hashed password, role আর interests রাখে।
2. **JWT:** login-এর পরে token দেয়; protected request-এ token যাচাই হয়।
3. **Permission:** owner নিজের notes বদলায়; admin users manage করে এবং সব notes দেখে।
4. **Pagination:** পুরো list একসঙ্গে না দিয়ে ছোট page-এ পাঠায়।
5. **Index:** email, owner, author আর interests-এর প্রয়োজনীয় query দ্রুত খুঁজতে সাহায্য করে।
6. **Aggregation:** interests অনুযায়ী group বানায়; `$lookup` আলাদা collection থেকে user-এর posts মেলায়।

## Hosting

See [DEPLOYMENT.md](DEPLOYMENT.md) for separate Vercel backend/frontend deployment.
See [SUBMISSION.md](SUBMISSION.md) for repository and live links.
