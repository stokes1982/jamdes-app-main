# Deployment

This app is not a static GitHub Pages site. It needs the Node server in `server.js` for client logins, bookings, session notes, exercises and progress photos.

## GitHub Repository Layout

Upload the project with this structure:

```text
.
├── public/
│   ├── index.html
│   ├── login.html
│   ├── app.js
│   ├── login.js
│   ├── styles.css
│   └── assets/
├── data/
│   └── .gitkeep
├── server.js
├── package.json
├── README.md
├── DEPLOYMENT.md
├── .env.example
└── .gitignore
```

Do not commit real `data/store.json` client data. The app creates it automatically when it starts.

## Hosting

Use a Node-capable host connected to GitHub, such as Render, Railway, Fly.io or a VPS.

Typical settings:

```text
Build command: npm install
Start command: npm start
```

Set environment variables:

```text
ADMIN_PIN=your-secure-james-pin
SESSION_SECRET=a-long-random-secret
```

For production, use persistent disk/storage for the `data/` folder so bookings, client details, notes and photos survive restarts.

## GitHub Pages

GitHub Pages only serves static files. It will load the HTML/CSS/JS, but the app will not work properly because `/api/...` routes need `server.js`.
