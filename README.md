# Model Bakery Backend

Backend API for managing a bakery, its menu categories, menu items, media library, public menu, and owner dashboard. It is a multi-tenant application: every authenticated account belongs to one bakery, and protected data is always scoped to that bakery.

## Contents

- [Architecture](#architecture)
- [Technology](#technology)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Application flow](#application-flow)
- [Data model](#data-model)
- [Authentication](#authentication)
- [API reference](#api-reference)
- [Public menu](#public-menu)
- [Validation and error format](#validation-and-error-format)
- [Uploads](#uploads)
- [Logging](#logging)
- [Ownership and tenant isolation](#ownership-and-tenant-isolation)
- [Redis readiness](#redis-readiness)
- [Operational notes](#operational-notes)
- [Recommended improvements](#recommended-improvements)

## Architecture

The code follows a layered Express structure:

```text
HTTP request
  -> route
  -> authentication / upload / validation middleware
  -> controller
  -> service
  -> Mongoose model / Cloudflare R2
  -> JSON response
```

| Layer | Location | Responsibility |
| --- | --- | --- |
| Application setup | `server.js` | Middleware order, CORS, database connection, route registration |
| Routes | `routes/` | HTTP method/path and middleware composition |
| Controllers | `controllers/` | Request extraction, service calls, response formatting, request-level logs |
| Services | `services/` | Database logic, business rules, R2 storage work, transactions |
| Validators | `validators/` | Request shape, type, pagination, and ObjectId checks |
| Middleware | `middleware/` | Authentication, uploads, request/error logging |
| Schemas | `database/schema/` | Mongoose persistence model definitions |

## Technology

- Node.js with ES modules
- Express 5
- MongoDB and Mongoose
- JWT stored in an HTTP-only cookie
- bcrypt password hashing
- Cloudflare R2 media storage via the AWS S3 SDK (API-token auth, works on Render/serverless)
- Multer in-memory uploads
- Sharp image processing
- CORS and cookie-parser

## Setup

### Prerequisites

- Node.js 20 LTS or later is recommended.
- MongoDB configured as a replica set if registration/category/item reordering transactions will be used. MongoDB standalone mode does not support multi-document transactions.
- A Cloudflare account with R2 enabled. Media uploads use an R2 API token (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`), so the `wrangler` CLI and OAuth login are **not** required to run the app. Bucket creation and configuration below still use `wrangler` once during setup.

### Install and run

```bash
npm install
npm run dev
```

The development script starts `nodemon server.js`. The application listens on port `8001`, as configured in `config/appConfig.js`.

### R2 bucket setup

```bash
# 1. Create the bucket
wrangler r2 bucket create model-bakery

# 2. Enable public access (R2.dev)
wrangler r2 bucket dev-url enable model-bakery

# 3. Allow CORS from your dashboard origins
cat > /tmp/cors.json << 'EOF'
{
  "rules": [
    {
      "allowed": {
        "origins": ["http://localhost:5173", "http://localhost:5174"],
        "methods": ["GET", "HEAD"],
        "headers": ["*"]
      },
      "maxAgeSeconds": 86400
    }
  ]
}
EOF
wrangler r2 bucket cors set model-bakery --file /tmp/cors.json
rm /tmp/cors.json
```

### R2 API token (required for uploads)

The app authenticates to R2 with an API token, not a wrangler login. This is what lets uploads work on Render and other hosts.

1. Cloudflare dashboard → **R2** → **Manage R2 API Tokens** → **Create API Token**.
2. Under **Permissions**, add **Object Read & Write** for the `model-bakery` bucket.
3. Copy the **Access Key ID** and **Secret Access Key** into `.env` / Render env vars as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
4. Keep the secret out of git and logs.

Then copy the public URL (shown after enabling dev-url, e.g. `https://pub-xxx.r2.dev`) into your `.env` as `R2_PUBLIC_URL`.

## Environment variables

Create a local `.env` file. Never commit it.

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/model-bakery
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=development

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_BUCKET_NAME=your-r2-bucket-name
R2_PUBLIC_URL=https://pub-xxx.r2.dev
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWTs |
| `NODE_ENV` | Recommended | Enables secure cookies in production and hides central error stacks |
| `R2_ACCOUNT_ID` | For media uploads | Cloudflare account ID |
| `R2_BUCKET_NAME` | For media uploads | R2 bucket name (must exist) |
| `R2_PUBLIC_URL` | For media uploads | Public R2.dev URL or custom domain for serving files |
| `R2_ACCESS_KEY_ID` | For media uploads | R2 API token access key ID |
| `R2_SECRET_ACCESS_KEY` | For media uploads | R2 API token secret access key |

## Application flow

1. A user registers with a bakery name, username, and password.
2. The registration service creates a bakery and its first account inside one MongoDB transaction.
3. Login signs a seven-day JWT and places it in the `token` HTTP-only cookie.
4. Protected routes run `authenticate`, which verifies the cookie and assigns the Mongoose account document to `req.user`.
5. Services read `req.user.bakery` indirectly through controller arguments. Client-provided bakery IDs are never used for protected operations.
6. Category, item, and media records are queried using the bakery ID, enforcing tenant isolation.
7. The public menu only exposes bakeries with `active: true`.

## Data model

All schemas use Mongoose timestamps (`createdAt` and `updatedAt`).

### Account

An account is the authenticated back-office user for one bakery.

| Field | Notes |
| --- | --- |
| `bakery` | Required reference to `Bakery` |
| `username` | Required, lowercase, globally unique |
| `password` | bcrypt hash; never return it to clients |
| `passwordResetSecretHash` | Hash of the temporary reset secret |
| `passwordResetExpiresAt` | Reset-secret expiry date |
| `active` | Account availability flag |
| `lastLogin` | Updated after a successful login |

### Bakery

| Field | Notes |
| --- | --- |
| `name` | Bakery name |
| `slug` | Globally unique public URL identifier |
| `tagline`, `description` | Public bakery presentation text |
| `establishedYear` | Optional whole number |
| `logo` | Optional same-bakery image `Media` reference |
| `coverImages` | Optional array of same-bakery image `Media` references |
| `coverVideo` | Optional array of same-bakery video `Media` references |
| `locations` | Array of `{ address }` objects |
| `social` | Instagram and WhatsApp data |
| `contact` | Phone and email data |
| `fssaiLicenseNo` | Optional FSSAI identifier |
| `active` | Controls public menu availability |

Bakery profile and public menu responses populate these media references with `url`, `type`, and `originalName`. They do not expose R2 `r2Key` values.

### Category

Each category belongs to one bakery.

| Field | Notes |
| --- | --- |
| `bakery` | Required `Bakery` reference |
| `name`, `slug` | Category identity; slug is generated from the name |
| `image` | Optional image `Media` reference, restricted to the same bakery |
| `tagline` | Optional text |
| `categoryBadges` | Array of `{ name, color, icon }` |
| `displayOrder` | Ascending display position |
| `active` | Public menu visibility flag |

### Item

Each menu item belongs to one bakery and one category.

| Field | Notes |
| --- | --- |
| `bakery`, `category` | Required scoped references |
| `name`, `slug` | Slug is generated from name and unique by bakery in service logic |
| `description`, `price`, `weight` | Menu item information |
| `media` | Same-bakery `Media` references |
| `badges` | Array of `{ name, color, icon }` |
| `details` | Array of strings |
| `outOfStock` | Availability flag |
| `hidden` | Back-office visibility flag |
| `displayOrder` | Ascending display position |

### Media

Media is stored in Cloudflare R2, with the persisted document retaining metadata.

| Field | Notes |
| --- | --- |
| `bakery` | Required owning bakery |
| `type` | `image` or `video` |
| `url`, `r2Key` | Public URL and R2 object key for deletion |
| `originalName`, `mimeType`, `size` | Upload metadata |
| `uploadedBy` | Uploading account |

## Authentication

The JWT is not returned in the response body. It is sent as the `token` cookie.

| Property | Current behavior |
| --- | --- |
| Token duration | 7 days |
| Cookie | `httpOnly`, `sameSite: strict` |
| Production cookie | `secure: true` when `NODE_ENV=production` |
| Protected route identity | `req.user` |
| Bakery source | `req.user.bakery` |

For browser clients using cookies, requests must use credentials (for example, `fetch(..., { credentials: "include" })`).

## API reference

Base URL in local development: `http://localhost:8001`

Every successful JSON response uses:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Every handled error uses:

```json
{
  "success": false,
  "message": "...",
  "errors": []
}
```

### Authentication: `/api/auth`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | No | Create bakery and initial account |
| POST | `/login` | No | Authenticate and set cookie |
| POST | `/logout` | No | Clear auth cookie |
| POST | `/forgot-password` | No | Create a temporary reset secret |
| PATCH | `/reset-password` | No | Reset password with the temporary secret |
| GET | `/me` | Yes | Return current account and bakery |
| PATCH | `/change-password` | Yes | Change the current account password |

Register body:

```json
{
  "bakeryName": "Model Bakery",
  "username": "owner",
  "password": "at-least-8-characters"
}
```

Login body:

```json
{
  "username": "owner",
  "password": "at-least-8-characters"
}
```

Password reset is currently an API-only workflow. `POST /forgot-password` returns a temporary `resetSecret` when an active account exists; a real production workflow should deliver this secret by email or SMS instead.

### Bakery: `/api/bakery`

Both routes require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Return the authenticated account's bakery |
| PATCH | `/` | Update bakery profile fields |

Allowed update fields: `name`, `tagline`, `description`, `logo`, `coverImages`, `coverVideo`, `locations`, `social`, `contact`, `establishedYear`, `fssaiLicenseNo`, and `active`.

`logo` accepts an image Media ObjectId (or `null` to clear it). `coverImages` accepts an array of image Media ObjectIds. `coverVideo` accepts an array of video Media ObjectIds or `null` to clear it. Every referenced media record must belong to the authenticated bakery.

Changing `name` generates a new bakery slug.

### Media: `/api/media`

All routes require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Upload one file using multipart field name `file` |
| GET | `/` | List own media |
| GET | `/:id` | Get one own media record |
| DELETE | `/:id` | Delete a media record and R2 object |

List query parameters:

| Name | Default | Rules |
| --- | --- | --- |
| `page` | `1` | Positive integer |
| `limit` | `20` | Integer from 1 to 100 |
| `type` | none | `image` or `video` |

Supported image MIME types are JPEG, PNG, and WebP. Images are rotated correctly, resized to fit within 1920×1920, and converted to WebP. Supported videos are MP4, WebM, and QuickTime. The maximum upload size is 25 MB.

### Categories: `/api/categories`

All routes require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Create category |
| GET | `/` | List own categories |
| GET | `/:id` | Get one own category |
| PATCH | `/:id` | Update one own category |
| DELETE | `/:id` | Delete category if it has no menu items |
| PATCH | `/reorder` | Update display order in one transaction |

Create fields: `name` (required), `tagline`, `image`, `categoryBadges`, and `displayOrder`.

Update additionally accepts `active`. Image ownership is checked against the authenticated bakery. Category listing supports `page`, `limit`, and literal-text `search`; results sort by `displayOrder` ascending and then newest first.

Reorder body:

```json
[
  { "id": "66d000000000000000000001", "displayOrder": 1 },
  { "id": "66d000000000000000000002", "displayOrder": 2 }
]
```

### Items: `/api/items`

All routes require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | Create a menu item |
| GET | `/` | List own items |
| GET | `/:id` | Get one own item |
| PATCH | `/:id` | Update one own item |
| DELETE | `/:id` | Delete one own item |
| PATCH | `/:id/out-of-stock` | Toggle `outOfStock` |
| PATCH | `/:id/hide` | Toggle `hidden` |
| PATCH | `/reorder` | Reorder items in one transaction |

Create fields: `category` (required ObjectId), `name` (required), `description`, `price` (required positive number), `media`, `badges`, `details`, `weight`, and `displayOrder`.

Updates additionally accept `hidden` and `outOfStock`. Category and every media ID are verified to belong to the authenticated bakery. Read responses populate category and media.

List query parameters: `page`, `limit`, `search`, `category`, `hidden`, and `outOfStock`. Boolean filters must be `true` or `false`.

### Dashboard: `/api/dashboard`

Requires authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Return bakery-scoped dashboard statistics |

The response contains `totalCategories`, `totalItems`, `totalMedia`, `activeCategories`, `hiddenItems`, `outOfStockItems`, `latestItems`, and `latestCategories`. The latest arrays contain at most five records each. Independent counters and latest-record queries run concurrently with `Promise.all`.

## Public menu

Public endpoints never require a cookie. They only resolve bakeries where `active: true`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/menu/:bakerySlug` | Public bakery information |
| GET | `/api/menu/:bakerySlug/categories` | Active categories, ordered by display order |
| GET | `/api/menu/:bakerySlug/categories/:categorySlug/items` | Visible items in an active category |
| GET | `/api/menu/:bakerySlug/items/:itemSlug` | One menu item with category and media |

Category responses populate their image. Item responses populate media and use `.lean()` because they are read-only. Public category item lists always filter `hidden: false`.

## Validation and error format

Validation happens before controllers. Validators reject malformed ObjectIds, unsupported fields, invalid pagination, invalid boolean filters, invalid arrays, and invalid prices. Services still enforce ownership and business rules because validation alone cannot prove tenant ownership.

Typical statuses:

| Status | Meaning |
| --- | --- |
| 200 | Successful read, update, deletion, or toggle |
| 201 | Successful registration, category creation, item creation, or media upload |
| 400 | Validation or invalid request input |
| 401 | Missing, invalid, expired, or unavailable account authentication |
| 403 | Inactive account at login |
| 404 | Bakery, category, item, or media not found in the permitted scope |
| 409 | Username conflict or a category containing menu items |
| 500 | Unexpected server, database, R2, or configuration error |

## Uploads

`POST /api/media` uses `multipart/form-data` and exactly one `file` field. Multer keeps the file in memory, then the media service processes images using Sharp and uploads the result to R2 under:

```text
model-bakery/<bakeryId>/images/<uuid>.webp
model-bakery/<bakeryId>/videos/<uuid>.<ext>
```

The upload uses the AWS S3 SDK (`@aws-sdk/client-s3`) authenticated with an R2 API token via `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`. It does **not** depend on a local `wrangler` OAuth login, so it works on Render and other deployment hosts.

If MongoDB creation fails after an R2 upload, the service attempts to delete the newly uploaded R2 object.

## Logging

`requestLogger` records every response with method, path, status, duration, and, when authenticated, account and bakery IDs. Category, item, menu, and dashboard modules add operation-level logs such as creation, query completion, ownership checks, transaction completion, errors, and execution duration.

Do not add passwords, JWTs, cookies, R2 keys, or reset secrets to logs.

## Ownership and tenant isolation

`services/ownership.service.js` centralizes bakery ownership checks:

- `verifyCategoryOwnership`
- `verifyMediaOwnership`
- `verifyItemOwnership`
- `verifyItemsOwnership`

The item service uses these checks before writing relationships. Category image validation also uses the shared media helper. This is the intended pattern for future order, inventory, analytics, and other bakery-scoped services.

## Redis readiness

All public-menu fetching is kept in `services/menu.service.js` through:

- `getBakeryMenu`
- `getMenuCategories`
- `getCategoryItems`
- `getMenuItem`

Each method has TODO comments identifying the future cache lookup and cache-save point. Add Redis only in those methods; routes and controllers should remain unchanged.

## Operational notes

- MongoDB transactions are used for registration and category/item reordering. Run MongoDB as a replica set in all environments that use these endpoints.
- The server has explicit CORS origins in `server.js`; add production frontend origins before deployment.
- The root endpoint (`GET /`) returns `"backend is live"` and can be used as a simple liveness check.
- There is currently no automated test script; `npm test` intentionally exits with an error.

## Recommended improvements

The following are prioritized findings from the current codebase review.

### High priority

1. **Do not return password reset secrets from the API.** The current forgot-password endpoint returns a reset secret to a caller that knows a username. Send a reset link or secret via a verified email/SMS provider instead, always returning the same generic response.
2. **Add database-level compound unique indexes.** Slug uniqueness for categories and items is currently enforced by a read-then-write loop. Concurrent requests can still create duplicates. Add unique `{ bakery: 1, slug: 1 }` indexes to Category and Item after resolving existing duplicate data.
3. **Protect media deletion when references exist.** Deleting media can leave a category image or item media array referring to a deleted document. Before deleting, either block with `409 Conflict`, detach references transactionally, or implement soft deletion.
4. **Standardize all error responses.** Auth, bakery, and media controller helpers can expose an unexpected error message on a `500` response. Match the safer item/menu/dashboard behavior: return `"Internal server error"` for unknown failures and log the stack only on the server.
5. **Add rate limiting and security headers.** Apply rate limits especially to login, registration, and password reset. Add Helmet, request body size limits, and production CORS configuration.

### Medium priority

1. **Check bakery activity in authentication middleware.** Existing JWTs for an account may continue to access protected routes after its bakery is deactivated because middleware currently checks only `account.active`.
2. **Define public visibility semantics for direct item URLs.** Public category item listings hide `hidden: true` items, but direct public item lookup does not currently filter hidden items. Decide whether hidden items must also be inaccessible by direct URL.
3. **Add query indexes for high-traffic lists.** Candidate indexes include `{ bakery: 1, displayOrder: 1, createdAt: -1 }` for categories/items and `{ bakery: 1, category: 1, hidden: 1, displayOrder: 1 }` for public item lists.
4. **Centralize shared helpers.** Slug generation, string trimming, API response helpers, and HTTP error factories are duplicated across several services. Move them gradually into focused utilities, with tests, to reduce drift.
5. **Generate or accept request IDs centrally.** Controllers log an incoming `x-request-id` when present, but the application does not create one. Add request-ID middleware for end-to-end tracing.

### Quality and delivery

1. Add unit tests for services/validators and integration tests for all routes, tenant isolation, ownership checks, and transaction rollback.
2. Add CI to run syntax checks, tests, linting, and dependency/security auditing.
3. Add a production process manager/container configuration, graceful shutdown, readiness endpoint, and structured JSON logs in every module.
4. Validate required environment variables at startup instead of discovering absent R2/JWT variables at request time.
5. Add OpenAPI/Swagger documentation once the API contract stabilizes.
