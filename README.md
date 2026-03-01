# Bitespeed Backend Task: Identity Reconciliation

This repository contains the backend service for FluxKart's identity reconciliation feature, built for Bitespeed. It links multiple purchases made with different contact information (email/phone number) to the same customer identity.

## Live Endpoint
The service is deployed and live on Render:
**`POST https://bitespeed-api-goup.onrender.com/identify`**

## Tech Stack
- **Node.js & TypeScript**
- **Express.js** (Web framework)
- **Prisma ORM**
- **SQLite3** (Database)

## Run Locally
1. Clone the repository
2. Install dependencies: `npm install`
3. Generate Prisma client: `npx prisma generate`
4. Run database migrations: `npx prisma db push`
5. Run the dev server: `npm run dev` (Ensure you have `ts-node-dev` installed, or use `npx tsc` and `node dist/index.js`)

## Testing the Endpoint
Send a POST request to the `/identify` endpoint with a JSON body containing `email` and/or `phoneNumber`:

```bash
curl -X POST https://bitespeed-api-goup.onrender.com/identify \
-H "Content-Type: application/json" \
-d '{"email": "doc@bttf.com", "phoneNumber": "1234567890"}'
```
