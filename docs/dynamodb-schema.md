# Nexus AWS Resource Configuration & DynamoDB Specifications

## Table 1: Nexus-Events
- **Table Name:** `Nexus-Events`
- **Partition Key (PK):** `eventId` (String)
- **Sort Key (SK):** None
- **Table settings:** Customize settings -> Capacity mode: **On-demand**
- **Attributes:**
  - `eventId`: String (UUID)
  - `title`: String
  - `description`: String
  - `date`: String (ISO 8601: `YYYY-MM-DDTHH:mm:ssZ`)
  - `venue`: String
  - `totalSeats`: Number
  - `seatsBooked`: Number (starts at 0)
  - `createdBy`: String (Cognito userId)
  - `createdAt`: String

---

## Table 2: Nexus-Bookings
- **Table Name:** `Nexus-Bookings`
- **Partition Key (PK):** `bookingId` (String)
- **Sort Key (SK):** None
- **Table settings:** Customize settings -> Capacity mode: **On-demand**
- **Global Secondary Index (GSI):**
  - **Index Name:** `userId-index`
  - **Partition Key:** `userId` (String)
  - **Sort Key:** `bookingTime` (String)
  - **Attribute projections:** All
- **Attributes:**
  - `bookingId`: String (UUID)
  - `userId`: String (Cognito sub / email)
  - `eventId`: String
  - `eventTitle`: String
  - `bookingTime`: String
  - `status`: String (`CONFIRMED` | `CANCELLED`)

---

## Table 3: Nexus-Items
- **Table Name:** `Nexus-Items`
- **Partition Key (PK):** `itemId` (String)
- **Sort Key (SK):** None
- **Table settings:** Customize settings -> Capacity mode: **On-demand**
- **DynamoDB Streams:** Enable with **New and old images** (triggers `matchItems`)
- **Global Secondary Index (GSI):**
  - **Index Name:** `type-status-index`
  - **Partition Key:** `type` (String: `lost` or `found`)
  - **Sort Key:** `status` (String: `open`, `matched`, `closed`)
  - **Attribute projections:** All
- **Attributes:**
  - `itemId`: String (UUID)
  - `type`: String (`lost` | `found`)
  - `title`: String
  - `description`: String
  - `location`: String
  - `date`: String
  - `imageUrl`: String
  - `tags`: List of Strings (detected by Rekognition)
  - `status`: String (`open` | `matched` | `closed`)
  - `reportedBy`: String (userId)
  - `userEmail`: String (for match notification)
  - `matchedWithItemId`: String (optional)
  - `createdAt`: String


## Current validation and matching fields

New item reports include `uploadStatus` (`none`, `pending`, `ready`, or `rejected`). The upload processor stores `processedETag` and `updatedAt` internally. These fields do not require a table key change. Gallery responses do not expose reporter emails, Cognito identifiers, or processing ETags.

Both matched records are claimed together with a DynamoDB transaction, conditional on open status, unchanged type/tags, and no existing match link. Booking transactions also guard against the event date changing after it was checked. Expired event rejection is enforced by the booking handler.

`CANCELLED` bookings and `closed` reports are possible schema values from earlier documentation; the current interface does not implement cancellation or a claim-closing workflow.
