# Bitespeed Backend Task: Identity Reconciliation

This repository contains the backend service for FluxKart's identity reconciliation feature, built for Bitespeed. Its core purpose is to link multiple purchases made with different contact information (email/phone number) to the same customer identity, providing a unified view of the customer.

## Repository & Live Service
- **GitHub Repository**: [https://github.com/Baymax1705/Bitespeed](https://github.com/Baymax1705/Bitespeed)
- **Live Endpoint URL**: `https://bitespeed-api-goup.onrender.com/identify`

## Tech Stack
- **Runtime Environment**: Node.js
- **Language**: TypeScript
- **Web Framework**: Express.js
- **Database ORM**: Prisma (v5)
- **Database Environment**: SQLite3 (Local) / Compatible with PostgreSQL/MySQL for production
- **Deployment Platform**: Render.com

## Core Logic & Thought Process
The `/identify` endpoint operates based on a few distinct scenarios dictated by the payload (which contains `email`, `phoneNumber`, or both):

1. **No Existing Matches**: If neither the email nor the phone number exists in the database, a new `primary` contact is created.
2. **Matching an Existing Record**: If the payload matches existing data perfectly, the service traverses the hierarchy to find the root `primary` contact and returns all associated emails, phone numbers, and secondary IDs.
3. **Adding New Information**: If the payload contains one piece of recognizable info (e.g., existing email) but new supplementary info (e.g., a new phone number), a new `secondary` contact is created linking back to the oldest `primary` contact.
4. **Merging Independent Profiles (Primary to Secondary Conversion)**: If the payload contains an email belonging to one `primary` contact and a phone number belonging to a *different* `primary` contact, it means these two previously independent profiles belong to the same person. The system calculates the oldest `primary` and demotes the newer `primary` to a `secondary` contact, linking it to the older one.

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- npm

### Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/Baymax1705/Bitespeed.git
   cd Bitespeed
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Set up your local `.env` file for the Prisma SQLite connection:
   ```bash
   echo 'DATABASE_URL="file:./dev.db"' > .env
   ```
4. Generate the Prisma Client and run the database migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
5. Start the development server (uses `ts-node-dev` for hot reloading):
   ```bash
   npm run dev
   ```
   *The server will start on port 3000.*

---

## Testing the Deployed Endpoint

You can test the live endpoint directly via `curl` or Postman. 

**Example Request:**
```bash
curl -X POST https://bitespeed-api-goup.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doc@bttf.com",
    "phoneNumber": "1234567890"
  }'
```

**Expected Response Format:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["doc@bttf.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
```
