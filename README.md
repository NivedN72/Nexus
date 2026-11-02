# Nexus

Nexus is a collaborative Cloud Computing course project for campus events and Lost & Found. Visitors and students can reserve event seats, students can report lost or found belongings, and campus admins can create events.

The frontend is a React website. The backend uses AWS managed services in Sydney (`ap-southeast-2`).

## Features

- A separate Home page with links to Campus Events, Lost & Found, and My Bookings.
- Public event browsing, date ordering, seat availability, and past-event labels.
- One reservation per account per event, protected by a DynamoDB transaction.
- Personal tickets with date, local time, venue, description, booking ID, and expired-pass styling.
- Booking confirmation emails after successful reservations.
- Student-only Lost & Found reports with optional JPEG or PNG photos, up to 5 MiB.
- Private photo storage, automatic Rekognition tags, and possible matches between lost and found reports.
- Separate match emails for both reporters.
- Responsive layouts, light and dark themes, and reduced-motion support.

## Accounts

| Action | Public | Visitor | Student | Admin |
| --- | --- | --- | --- | --- |
| Browse events | Yes | Yes | Yes | Yes |
| Reserve a seat | No | Yes | Yes | No |
| View own tickets | No | Yes | Yes | Yes |
| View and report Lost & Found items | No | No | Yes | Only with student-group membership |
| Create events | No | No | No | Yes |

Public signup creates visitor accounts only. Student accounts are managed by campus admins in Cognito. Selecting Student in the sign-in form does not grant student access. Permissions come from the account's actual Cognito groups.

Booking requires a verified email. Accounts with temporary passwords can set a new password through the sign-in form. There are no demo profiles.

Login is kept in `sessionStorage`, so refreshing the same tab restores an unexpired session. Passwords are not stored. Expired sessions need another sign-in. My Bookings keeps fetched tickets in memory across tab changes; Refresh tickets fetches the latest list. Signing out or reloading clears that cache.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, JavaScript/JSX, Vite 6 |
| Styling | Tailwind CSS 3, custom CSS, Inter Display |
| Icons and motion | Lucide React, Anime.js 4, CSS |
| Hosting | AWS Amplify Hosting, manual static deployment |
| API and backend | API Gateway REST API, Python 3.12 Lambda functions |
| Accounts | Cognito User Pools |
| Database | DynamoDB tables, GSIs, and Streams |
| Photos | Private S3 bucket and presigned uploads/viewing links |
| Image labels | Amazon Rekognition |
| Emails | Gmail SMTP over TLS from Lambda |
| Logs | CloudWatch |

SNS was used in an earlier match-notification implementation. The current source sends emails directly to the reporters through SMTP.

## Architecture

```text
React frontend on Amplify
  +--> Cognito: signup, email confirmation, sign-in
  +--> API Gateway --> Lambda --> DynamoDB
  +--> S3: direct photo upload using a signed POST form
                         |
                         +--> S3 upload event
                               --> image-validation Lambda
                               --> Rekognition labels
                               --> DynamoDB tags
                                     --> DynamoDB Stream
                                     --> matching Lambda
                                     --> atomic match update
                                     --> SMTP emails to both reporters
```

Protected API requests send a Cognito ID token in the Authorization header. API Gateway validates it, and each handler checks the required claims and groups. Changing cached frontend display information does not grant backend permissions.

### Reservations

The booking Lambda checks account permissions, verified email, and a valid future event date. It creates a deterministic booking ID from the user and event. A DynamoDB transaction increases the booked-seat count only when capacity remains and creates the ticket only when it does not already exist. A concurrent event-date edit also invalidates a stale reservation transaction.

The backend still supports older account-ID and email-based tickets. Confirmation email failure does not undo a saved reservation.

### Photos

The reporting API validates text fields and accepts only JPEG or PNG declarations. For a photo it issues a ten-minute signed S3 POST form, with an exact Content-Type condition and a `content-length-range` condition of 1 to 5,242,880 bytes. The frontend also checks type, size, and the file signature before uploading.

The upload Lambda verifies the bucket, object path, existing report, object size, Content-Type, and JPEG/PNG signature before calling Rekognition. New report photos stay hidden until validation succeeds. Unsupported image contents are rejected. Object ETags and conditional updates prevent completed duplicate work from overwriting report state or recreating a deleted report.

Rekognition requests up to ten labels with a minimum confidence of 70%. Accepted labels are stored in lowercase. It is a label service, not a model trained to identify individual belongings.

DynamoDB stores permanent object keys. The gallery issues ten-minute presigned GET URLs for approved photos. Gallery responses use an allowlist of fields and omit reporter emails, account identifiers, and internal processing metadata. Legacy photos without a validation-state field are retained for compatibility.

### Matching and emails

The matching Lambda reads current report state, queries open reports of the opposite type, and follows candidate pages. At least one shared tag creates a possible match. A single DynamoDB transaction claims both reports only if they remain open, have unchanged tags, and have no previous match. Failed or replayed claims do not send another notification.

This is a possible match, not proof that both reports describe the same item. People still need to confirm the result.

Both email flows use Gmail SMTP. Set `SMTP_USER` and `SMTP_PASS` in the relevant Lambda environment, not in Git or frontend files. Use a 30-second timeout. Each match recipient gets a separate message. Mail delivery is best effort; there is no durable notification queue or automatic mail retry yet.

## Database and API

| Table | Primary key | Index |
| --- | --- | --- |
| Nexus-Events | eventId | None |
| Nexus-Bookings | bookingId | userId-index: userId, bookingTime |
| Nexus-Items | itemId | type-status-index: type, status |

The tables use on-demand capacity. Enable the items table's stream with new and old images. Attribute details are in [the schema](docs/dynamodb-schema.md).

| Method | Route | Access |
| --- | --- | --- |
| GET | /events | Public |
| GET | /events/{id} | Public |
| POST | /events | Admin |
| POST | /bookings | Signed-in non-admin with verified email |
| GET | /bookings/me | Signed-in user |
| GET | /items | Student |
| POST | /items | Student |

## Running locally

Install Node.js and npm, then run from `frontend`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the address printed by Vite, usually `http://127.0.0.1:5173`. The development server binds to localhost by default. The Windows launcher, `start-frontend.bat`, is also available; it may install Node.js with winget or install dependencies if they are missing.

The production build commands are:

```powershell
npm.cmd run build
npm.cmd run preview
```

Vite writes the build to `frontend/dist`. Node.js and npm are build tools; visitors do not need them.

Defaults are in `frontend/src/config.js`. Deployment configuration is managed in source; the public website has no AWS settings form. Existing browser-local overrides remain supported for compatibility. These public deployment identifiers are not AWS credentials. Never add AWS access keys, SMTP passwords, or a Cognito client secret to frontend code.

The checked-in defaults connect to the shared course backend. Local development can therefore make real AWS requests and use credits. Changing repositories does not create an isolated backend.

## Deployment

The frontend is deployed manually to Amplify. Build locally, zip the contents of `dist` with `index.html` at the archive root, then upload the ZIP to the hosting app. Automatic Git builds are disabled. Keep local deployment archives out of source control.

Backend functions are deployed separately. Source changes are not automatically applied to AWS. The project does not currently contain a complete infrastructure deployment template.

For the signed-POST upload changes, deploy in this order:

1. Verify S3 CORS permits POST and GET from the intended frontend origins. Retain PUT during transition if old clients are still in use.
2. Verify the upload Lambda can read S3 objects and the matcher can use DynamoDB TransactWriteItems.
3. Deploy the compatible frontend, which supports both the previous PUT response and the new POST response.
4. Deploy the updated backend handlers, including reporting, image validation, gallery serialization, and matching.
5. Test the deployed flows with agreed disposable accounts and data. Old open browser sessions may need a reload when the report API changes.

Keep the bucket private. Configure S3 ObjectCreated events for `uploads/` and connect the DynamoDB stream to the matcher. Cognito needs visitors, students, and admins groups, a public client allowing USER_PASSWORD_AUTH, and the post-confirmation visitor-assignment trigger. Configure the API's authorizer and unauthenticated CORS preflights.

Use resource-specific IAM permissions and CloudWatch logs. Authentication, quotas, CORS, and IAM must be checked in the deployed account; local tests cannot verify those settings.

## Tests

From the project root:

```powershell
node --test frontend/tests/*.test.mjs
python -B -m unittest discover -s backend/tests -p "test_*.py"
```

The tests replace AWS, Cognito, and mail connections with offline fixtures. They cover permissions, password challenges, session restoration, duplicate and concurrent booking, expired-event rejection, upload policies and validation, gallery privacy, matching races, and mail failures. They do not prove a production traffic capacity or actual email delivery.

## Limitations and next work

- Common recognition labels can produce incorrect matches.
- Emails still run inside the backend functions; a durable outbox and queue would improve delivery and burst handling.
- Some list endpoints still need bounded pagination and more targeted queries.
- There is no WebSocket feed, booking cancellation, or item-claim approval flow.
- Token refresh and additional MFA challenges are not implemented.
- Photo signature checks are not antivirus scanning. Rekognition validates supported image decoding during analysis.
- Per-account upload limits, deployed throttling, alarms, and load tests need further work before opening the service to unrestricted traffic.
- Hosting, requests, image analysis, and storage can use AWS credits. Budget alerts do not stop spending automatically.

## Credits and asset sources

Nexus began as a four-member course project. Its Git history records contributions to the shared version. Personal extensions should acknowledge that origin and describe the author's own additions.

The interface takes visual direction from [Makro](https://www.framer.com/marketplace/templates/makro/) and [Solva](https://www.framer.com/marketplace/templates/solva/). The React interface is implemented in this repository. The campus hero image was AI-generated for the project; it is not a photograph of the team or a claimed photograph of our college.

Inter Display is distributed with its [SIL Open Font License](frontend/public/fonts/Inter-LICENSE.txt). Other libraries keep their respective upstream licenses. A project-wide license has not yet been agreed by the collaborators; this README does not assign one.
