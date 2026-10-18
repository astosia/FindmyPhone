# Find my Phone

A Pebble watchapp that makes your iPhone ring when you press a button, using a
Pushover emergency alert. Because it uses iOS Critical Alerts, it rings even
when the phone is on silent or in Do Not Disturb.

```
Watch button ──Bluetooth──▶ Pebble app on iPhone (PebbleKit JS)
                                   │ HTTPS
                                   ▼
                            Pushover API ──push──▶ same iPhone rings
```

The phone needs to be within Bluetooth range of the watch and have internet
(Wi-Fi or mobile data).

## Controls

| Button       | Action                                   |
|--------------|------------------------------------------|
| SELECT or UP | Ping the phone                           |
| Hold SELECT  | Stop the alert (cancels repeat alerts)   |

With **Ping as soon as the app opens** on (the default), just opening the app
rings the phone.

## 1. Set up Pushover

1. Install the **Pushover** app on your iPhone and sign in or create an account.
2. In the Pushover app's settings, turn on **Critical Alerts** for emergency
   priority. iOS will ask for permission; allow it. This is what lets it ring
   on silent.
3. On pushover.net, copy your **User Key** from the dashboard.
4. Still on pushover.net, go to **Your Applications → Create an Application**,
   call it "Find my Phone", and copy its **API Token**.

## 2. Configure

In the Pebble app on your phone, open **Find my Phone → Settings** and paste in
your User Key and API Token. You can also pick the priority, sound and
ping-on-launch here. Keys are stored on the phone only and are never sent to
the watch.

## 4. Make it one press (recommended)

On the watch, go to **Settings → Quick Launch** and assign **Ping Phone** to a
long-press of your choice. Combined with ping-on-launch, holding that button
from any screen rings your phone.

## How the alert behaves

- **Emergency (default):** repeats every 30 seconds for up to 5 minutes, or
  until you acknowledge it in Pushover or hold SELECT on the watch.
- **High / Normal:** a single notification. These may not ring on silent.

## Files

- `src/c/main.c`: the watch UI and buttons
- `src/pkjs/index.js`: runs on the phone and calls the Pushover API
- `src/pkjs/config.js`: the settings page
- `package.json`, `wscript`: project and build config

## Troubleshooting

- **"Phone not connected":** the watch can't see the Pebble app. Check
  Bluetooth, and make sure the Pebble app hasn't been swiped closed.
- **"Add Pushover keys…":** open Settings in the Pebble app and fill in both keys.
- **Pushover error:** usually a mistyped key or token; the message from
  Pushover is shown on the watch.
- **Doesn't ring on silent:** check that Critical Alerts is allowed for
  Pushover in iOS Settings → Notifications → Pushover.
