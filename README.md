# Thalassery Thakkaram, Ooty: Website + Admin

## Run
```
npm install
npm start
```
- Website: http://localhost:3000
- Admin:   http://localhost:3000/admin  (first login: `admin` / `admin123`; you'll be prompted to change it)

Set `PORT` or `ADMIN_PASSWORD` (initial password only) as environment variables if needed.

## What's where
- `server.js`: Express API, admin auth, image uploads, QR code
- `seed.js`: starter content written to `data/db.json` on first run
- `data/db.json`: all content (menu, gallery, reviews, bookings, settings). Back this file up.
- `uploads/`: images uploaded from the admin panel
- `public/`: website (`index.html`, `css/`, `js/`) and admin panel (`public/admin/`)

## Admin features
Dashboard · Bookings & enquiries (status, WhatsApp the guest) · Menu items (photo upload, price, veg, signature, show/hide) · Categories · Hero slides · Gallery · Review moderation · Site settings (address, phone, WhatsApp, hours, socials, story text, announcement bar) · Change login.

Starter photos are Unsplash stock images. Replace them with your own from the admin panel.
