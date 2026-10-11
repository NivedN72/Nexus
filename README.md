# Nexus

## Campus events and AI-assisted Lost & Found

Nexus is our Cloud Computing course project. It brings campus event bookings and Lost & Found into one website, with a React frontend and a serverless backend on AWS.

The idea was to build something useful for a college campus while learning how cloud services work together. Visitors and students can book events, students can report lost or found items, and admins can create events. AWS Rekognition reads item photos and helps find possible matches.

## What the project does

### Campus Events

Anyone can browse events without signing in. Each event shows its date, location, description, and available seats.

Booking requires a signed-in visitor or student account with a verified email. Each account can reserve one seat per event. Admin accounts cannot book seats.

### Lost & Found

Lost & Found is restricted to accounts in the Cognito `students` group. Students can report an item with a title, description, location, and JPEG or PNG photo.

The photo is uploaded directly to S3. Rekognition generates tags, and a Lambda function compares those tags with reports of the opposite type. A lost report is compared with found reports, and a found report is compared with lost reports.

If the reports share a tag, the backend marks them as matched and links their item IDs. This is a possible match, so someone still needs to check whether the items are actually the same.

### My Bookings

Signed-in users can view tickets linked to their account. Tickets show the event title, booking time, status, and booking ID.

### Website interface

The frontend has a separate Home page and pages for the three services. It includes responsive layouts, sign-in and reporting forms, ticket layouts, and animations for page arrivals, hover, pointer movement, and scrolling. Motion is reduced when the browser's reduced-motion setting is enabled.

## Account types

| Action | Public | Visitor | Student | Admin |
| --- | --- | --- | --- | --- |
| Browse campus events | Yes | Yes | Yes | Yes |
| Book a seat | No | Yes | Yes | No |
| View own bookings | No | Yes | Yes | Yes |
| View and report Lost & Found items | No | No | Yes | Only with `students` membership |
| Create events | No | No | No | Yes |

- Public signup creates visitor accounts only.
- Student accounts are added or approved manually by admins in Cognito.
- Admin access comes from membership in the `admins` group.
- Choosing Student in the sign-in form does not grant student permissions. The account must already have the correct group membership.
- Accounts created with a temporary password can set their new password through the sign-in form.
- Login survives page refreshes in the same tab. The session is stored in `sessionStorage`, and expired sessions require another sign-in.

There are no demo profiles in the current version.

## Technologies used

| Part | Technology |
| --- | --- |
| Frontend | React 18 and Vite 6 |
| Styling | Tailwind CSS 3 and custom CSS |
| Icons | Lucide React |
| Animation | Anime.js 4 and CSS |
| Backend | Python Lambda functions, intended for Python 3.12 |
| API | Amazon API Gateway REST API |
| Authentication | Amazon Cognito User Pools |
| Database | Amazon DynamoDB |
| Photo storage | Amazon S3 |
| Image labels | Amazon Rekognition |
| Match notifications | Amazon SNS |
| Logs | Amazon CloudWatch |

The source currently uses the Sydney region, `ap-southeast-2`.

## How the services connect

```text
React frontend
    |
    +--> Cognito: signup, email confirmation, sign-in
    |
    +--> API Gateway
    |        |
    |        +--> Lambda --> DynamoDB events, bookings, and items
    |
    +--> S3: direct photo upload using a presigned URL
              |
              +--> S3 upload event
                       |
                       +--> onImageUpload Lambda
                                  |
                                  +--> Rekognition detects labels
                                  |
                                  +--> DynamoDB item tags updated
                                             |
                                             +--> DynamoDB Stream
                                                        |
                                                        +--> matchItems Lambda
                                                                   |
                                                                   +--> Update matching reports
                                                                   +--> SNS notification
```

Protected API requests send the Cognito ID token in the `Authorization` header. API Gateway validates it, and the Lambda functions use the token claims to check identity and group membership.

### How booking avoids duplicate seats

`bookEvent.py` creates a booking ID from the event ID and the user's Cognito ID. It uses one DynamoDB transaction to:

1. Increase `seatsBooked`, only if seats are still available.
2. Save the ticket, only if that booking ID does not already exist.

Both writes succeed together or fail together. This prevents the same account from booking twice and prevents simultaneous bookings from taking more seats than the event allows.

The handler also checks older bookings stored against an account ID or email. `getBookings.py` includes older tickets when returning booking history.

### How photos are uploaded and displayed

1. The student submits an item report.
2. `reportItem.py` creates the record and returns a presigned S3 PUT URL.
3. The browser uploads the file directly to S3 using that URL.
4. S3 triggers image recognition and the matching process.
5. `getItems.py` returns presigned GET URLs so the gallery can display photos from the private bucket.

Upload and viewing URLs expire after 10 minutes. DynamoDB stores the permanent object key, not the temporary viewing URL. Refreshing the gallery requests new viewing URLs.

## Folder structure

```text
Nexus/
  backend/
    lambdas/
      bookEvent.py
      createEvent.py
      getBookings.py
      getEvents.py
      getItems.py
      reportItem.py
      onImageUpload.py
      matchItems.py
      postConfirmation.py
      common.py
    tests/
      test_accounts.py
  frontend/
    public/
      fonts/
      images/
    src/
      components/
      hooks/
      services/
        api.js
        cognito.js
      App.jsx
      config.js
      index.css
      main.jsx
    tests/
    package.json
  docs/
    dynamodb-schema.md
  start-frontend.bat
  README.md
```

## Running the frontend locally

You need Git, Node.js, and npm. The frontend also needs a working AWS backend to load real data. Cloning this repository does not create the AWS resources.

From the project folder:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

`npm.cmd` works in Windows PowerShell even when script execution settings block `npm.ps1`. On other terminals, the same commands can be run as `npm ci` and `npm run dev`.

### Windows launcher

You can also double-click `start-frontend.bat` in the project folder. It starts Vite and opens the browser. If dependencies are missing, it runs `npm install`. If Node.js is missing, it attempts to install it using Windows winget.

For a setup that follows the committed lockfile, run `npm.cmd ci` yourself before using the launcher.

### Connecting to AWS

The default API URL, Cognito pool ID, app client ID, region, and photo bucket are in `frontend/src/config.js`.

The gear button in the website lets you override the API URL, user pool ID, and app client ID for your browser. The API URL must include the deployment stage, such as `/prod`. Region and bucket changes need to be made in the source configuration as well as the relevant backend settings.

These frontend values identify the deployment. They are not AWS access keys. Do not put AWS credentials or a Cognito client secret into frontend files.

You do not need AWS CLI credentials just to run the website and sign in. AWS account access is needed to inspect or change the backend deployment.

## AWS setup

The backend is deployed separately from the frontend. This repository contains the Lambda source, but does not currently include an automated infrastructure deployment template.

### DynamoDB

| Table | Partition key | Index |
| --- | --- | --- |
| `Nexus-Events` | `eventId` | None |
| `Nexus-Bookings` | `bookingId` | `userId-index`, with `userId` as partition key and `bookingTime` as sort key |
| `Nexus-Items` | `itemId` | `type-status-index`, with `type` as partition key and `status` as sort key |

Both indexes use an ALL projection. Enable DynamoDB Streams on `Nexus-Items` with new and old images, and connect it to the matching Lambda.

More attribute details are in [the DynamoDB schema](docs/dynamodb-schema.md). The handlers are the reference for fields currently written by the application.

### Cognito

Use a public app client without a client secret. The current sign-in code uses `USER_PASSWORD_AUTH`, so the app client must allow that flow.

Create the `visitors`, `students`, and `admins` groups. Connect `postConfirmation.py` to the post-confirmation trigger so confirmed public signups are added to `visitors`.

Admins manage student and admin membership in Cognito. Booking also checks the `email_verified` claim. Creating an account or confirming its status alone does not replace email verification.

### API routes

| Method | Route | Access | Handler |
| --- | --- | --- | --- |
| GET | `/events` | Public | `getEvents.py` |
| GET | `/events/{id}` | Public | `getEvents.py` |
| POST | `/events` | Signed-in admin | `createEvent.py` |
| POST | `/bookings` | Signed-in non-admin with verified email | `bookEvent.py` |
| GET | `/bookings/me` | Signed-in user | `getBookings.py` |
| GET | `/items` | Signed-in student | `getItems.py` |
| POST | `/items` | Signed-in student | `reportItem.py` |

Use Lambda proxy integrations and a Cognito authorizer for protected routes. Configure CORS for the frontend origin, including unauthenticated OPTIONS requests, and deploy the API stage after changing routes or integrations.

### S3 and background functions

Keep the photo bucket private. Allow the frontend origin to upload through S3 CORS with PUT and the required Content-Type header. Configure `ObjectCreated` events for the `uploads/` prefix to trigger `onImageUpload.py`.

`onImageUpload.py` reads JPEG and PNG files, requests up to 10 Rekognition labels with a minimum confidence of 70%, and writes lowercase tags to the item record.

`matchItems.py` processes DynamoDB Stream records and compares open reports. Set its `SNS_TOPIC_ARN` environment variable to enable notifications, and confirm the topic's email subscriptions. Messages go to the configured topic subscribers, not automatically to every reporter's email address.

`reportItem.py` and `getItems.py` support the `S3_BUCKET_NAME` environment variable. Table names and several region settings are fixed in the handlers and must be updated if deploying under different names or in another region.

Lambda roles need the permissions used by their handlers, including DynamoDB operations, S3 object access, Rekognition label detection, SNS publishing, stream processing, and CloudWatch logging. The post-confirmation function also needs permission to add users to Cognito groups. Give each function the permissions it needs for the project resources.

Each handler uses `lambda_handler`. For example, the handler setting for the booking file is `bookEvent.lambda_handler`.

## Building and testing

From `frontend/`, create the production build:

```powershell
npm.cmd run build
npm.cmd run preview
```

The build is saved in `frontend/dist/`. The preview command serves that build locally. Neither command deploys the backend or publishes the website.

Run the existing tests from the project root:

```powershell
node --test frontend/tests/*.test.mjs
python -m unittest discover -s backend/tests -p "test_*.py"
```

These tests replace network calls or AWS SDK clients with local test data. They cover account permissions, visitor signup, password challenges, session restoration, and booking behavior. They do not confirm that a live AWS deployment has the correct settings.

Normal use of the frontend talks to the configured AWS deployment. Uploading photos also triggers Rekognition and the other background services, so local development is not automatically free of AWS usage.

## Common problems

| Problem | What to check |
| --- | --- |
| `Failed to fetch` | API URL and stage, connection, API Gateway CORS, OPTIONS routes, and whether the stage was redeployed |
| `USER_PASSWORD_AUTH flow not enabled` | Authentication flows enabled on the Cognito app client |
| Student sign-in is rejected | Account membership in the `students` group |
| Booking asks for email verification | The Cognito account's `email_verified` attribute, then sign in again to get updated claims |
| Photo upload returns 403 | Upload URL expiry, matching Content-Type, S3 permissions on the signing role, and any explicit deny |
| Photos stop displaying | Refresh the gallery for new presigned URLs; check that the object exists and the handler can read it |
| Tags never appear | S3 upload event, Lambda logs, supported image format, and Rekognition permissions |
| Match emails do not arrive | `SNS_TOPIC_ARN`, confirmed subscriptions, and the matching Lambda logs |
| Login is lost | Session expiry, a closed tab, blocked browser storage, or a changed Cognito configuration |

## Limitations and future improvements

- Matching uses shared Rekognition labels, not a trained model for identifying individual belongings. Common labels can produce incorrect matches.
- Updating both matched items uses two separate writes. It does not have the same transaction protection as event booking.
- Several event and item reads do not handle all DynamoDB pages yet, so large datasets need more work.
- The website uses fetches and refresh controls. There is no WebSocket connection for continuous live updates.
- Photo processing happens in the background, so tags and matches may take time to appear.
- Expired sessions require sign-in again. Automatic token refresh and additional MFA challenges are not implemented.
- There is no booking cancellation, item claim approval, or account-management page in the current interface.
- Hosting the frontend and configuring a new AWS backend are separate setup tasks.

### Possible next steps

We would like to improve matching accuracy, add booking cancellation, add a proper item claim process, and automate the AWS setup. Event reminders and a hosted frontend would also make the project easier to use outside a local demo.
