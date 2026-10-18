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
| UP           | Swap Services                            |
| SELECT       | Ping the phone                           |
| Down         | Stop the alert (cancels repeat alerts)   |

With **Ping as soon as the app opens** on, opening the app from quicklaunch rings
the phone.

## 1. Set up Pushover (simplest, has a 30 day free trial, then a one time small cost)

1. Install the **Pushover** app on your Phone and sign in or create an account.
2. In the Pushover app's settings, turn on **Critical Alerts** for emergency
   priority. Your phone will ask for permission; allow it. This is what lets it ring
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

On the watch, go to **Settings → Quick Launch** and assign **Find my Phone** to a
long-press of your choice. Combined with ping-on-launch, holding that button
from your watchface opens the app and rings your phone.

## How the alert behaves

- **Emergency (default):** repeats every 30 seconds for up to 5 minutes, or
  until you acknowledge it in Pushover or hold SELECT on the watch.
- **High / Normal:** a single notification. These may not ring on silent.

## Troubleshooting

- **"Phone not connected":** the watch can't see the Pebble app. Check
  Bluetooth, and make sure the Pebble app hasn't been swiped closed.
- **"Add keys…":** open Settings in the Pebble app and fill in both keys.
- **Pushover error:** usually a mistyped key or token; the message from
  Pushover is shown on the watch.
- **Doesn't ring on silent:** check that Critical Alerts is allowed for
  Pushover in iOS Settings → Notifications → Pushover.



##  Setup for Bark on iOS (free, but a bit more work!)

## 1. Install and allow notifications

Install Bark from the App Store and open it.
When iOS asks, allow Notifications, and allow Critical Alerts if that prompt appears.
Check it took effect: go to iPhone Settings → Notifications → Bark and make sure both Allow Notifications and Critical Alerts are on. Critical Alerts is what lets it ring on silent.

## 2. Copy your Bark URL

On Bark’s home screen you’ll see a server address that looks like https://api.day.app/AbCdEf123456/. The part after day.app/ is your private device key.
Tap it and copy it.

## 3. Test Bark on its own

Turn your iPhone’s silent switch on.
Paste your URL into Safari on any device, add test?level=critical&volume=10 to the end, and open it, so it looks like:
https://api.day.app/AbCdEf123456/test?level=critical&volume=10
Your iPhone should sound and show a “test” notification even though it’s on silent. If it does, Bark is working.

## 4. Set up Find my Phone

In the Pebble app, open Find my Phone → Settings.
Set Alert service to Bark (free, iPhone only). The Bark fields will appear.
Paste the whole URL into Device key or URL. Leave Server blank.
Pick a Sound and leave Keep ringing every 30 seconds on.
Tap Save. The watch should show “Settings saved”.

## 5. Try it from the watch

Put the phone on silent, then open Find my Phone on the watch or press SELECT.
The watch should show “Ringing!” and the phone should play the alarm for about 30 seconds, repeating every 30 seconds.
Hold SELECT to stop the repeats, or just leave the app.

## 6. If it doesn’t work

“Add keys in settings”: the Bark URL field is empty, or the service isn’t set to Bark.
“Error: …”: the key is wrong. Copy the URL from the Bark app again and re-paste it.
“Phone not connected”: the watch can’t see the Pebble app. Check Bluetooth and that the Pebble app is still running.
Notification appears but is silent: Critical Alerts is off. Recheck step 1.
Repeats stop early: repeats only run while Ping Phone is open on the watch, so keep it on screen until you find the phone.
