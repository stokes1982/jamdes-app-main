# James PT Booking

A small booking app for James to share open PT sessions with clients.

## Run locally

```sh
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

Clients sign in with their own client code. James creates those codes from the James view.

The default James view PIN is `james`.

For a hosted version, set your own coach PIN:

```sh
ADMIN_PIN=coach-pin npm start
```

## Deploy from GitHub

The frontend lives in `public/`, but the full private app needs the Node backend in `server.js`. Do not deploy this as plain GitHub Pages.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the GitHub-ready folder layout and hosting settings.

## What is included

- Private client-code login before clients can see the app.
- Client profiles, so each booking belongs to a specific client account.
- Personal welcome message on the client home view.
- James-assigned home exercises per client.
- Client progress photo uploads for body-progress tracking.
- Client view with open slots, time-of-day filters and multi-select booking.
- Session notes on James's booking records.
- Booked slots appear as booked to other clients without showing who booked them.
- James view for issuing client codes, adding slots, seeing bookings, cancelling bookings and removing slots.
- JSON persistence in `data/store.json`.
- No paid services or external packages required.

## Notes

This is ready as a simple self-hosted MVP. If clients need accounts, payments, email reminders or calendar sync, those can be added later without changing the core booking flow.

Delete `data/store.json` to reset the demo schedule.
