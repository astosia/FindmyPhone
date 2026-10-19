# Find my Phone

A Pebble watchapp that makes your iPhone or Android phone ring when you press a
button on your watch, even when the phone is on silent.

```
Watch button ──Bluetooth──▶ Pebble app on your phone (PebbleKit JS)
                                   │
                ┌──────────────────┴──────────────────┐
                │ HTTPS                                │ Android only
                ▼                                      ▼
   Pushover / Bark / ntfy ──push──▶ phone rings   Phone Alarm: the Pebble app
                                                  plays the sound itself
```

The phone needs to be within Bluetooth range of the watch. Pushover, Bark and
ntfy also need the phone to have internet (Wi-Fi or mobile data). Phone Alarm
doesn't.

## Which service should I use?

| Service         | Phone            | Cost                                        | Rings on silent?                            |
|-----------------|------------------|---------------------------------------------|---------------------------------------------|
| **Pushover**    | iPhone + Android | 30-day free trial, then a small one-off fee | Yes                                         |
| **Bark**        | iPhone only      | Free                                        | Yes (Critical Alerts)                       |
| **Phone Alarm** | Android only     | Free, nothing to set up                     | Yes, if media volume is up                  |
| **ntfy**        | Android          | Free                                        | Only with Do Not Disturb set up (see below) |

The settings page only shows the services that suit your phone. On Android,
**Phone Alarm is selected automatically when you first install the app**, so it
works straight away without opening settings.

## Controls

| Button       | Action                                   |
|--------------|------------------------------------------|
| UP           | Swap services                            |
| SELECT       | Ping the phone                           |
| DOWN         | Stop the alert (cancels repeat alerts)   |

With **Ping when opened with Quick Launch** on, opening the app from Quick Launch
rings the phone straight away.

You can set up more than one service as a backup. Press UP on the watch to swap
between the ones that are set up.

## Make it one press (recommended)

On the watch (or the pebble mobile app), go to **Settings → Quick Launch** and assign **Find my Phone** to a
long-press of your choice. Combined with ping-on-launch, holding that button
from your watchface opens the app and rings your phone.



## Setup for Pushover (iPhone and Android, simplest, has a 30 day free trial, then a one time small cost)

### 1. Set up Pushover

1. Install the **Pushover** app on your phone and sign in or create an account.
2. In the Pushover app's settings, turn on **Critical Alerts** for emergency
   priority. Your phone will ask for permission; allow it. This is what lets it ring
   on silent. On Android, look for the options that let emergency alerts sound
   when the phone is on silent or in Do Not Disturb.
3. On pushover.net, copy your **User Key** from the dashboard.
4. Still on pushover.net, go to **Your Applications → Create an Application**,
   call it "Find my Phone", and copy its **API Token**.

### 2. Configure

In the Pebble app on your phone, open **Find my Phone → Settings**, choose
**Pushover** and paste in your User Key and API Token. You can also pick the
priority, sound and ping-on-launch here. Keys are stored on the phone only and
are never sent to the watch.

If you have more than one phone on your Pushover account, enter a **Device name**
to ring only that one.

### How the alert behaves

- **Emergency (default):** repeats every 30 seconds for up to 5 minutes, or
  until you acknowledge it in Pushover or press DOWN on the watch. It keeps
  repeating even if you close the app on the watch.
- **High / Normal:** a single notification. These may not ring on silent.

### Troubleshooting

- **"Phone not connected":** the watch can't see the Pebble app. Check
  Bluetooth, and make sure the Pebble app hasn't been swiped closed.
- **"Add keys…":** open Settings in the Pebble app and fill in both keys.
- **Pushover error:** usually a mistyped key or token; the message from
  Pushover is shown on the watch.
- **Doesn't ring on silent:** check that Critical Alerts is allowed for
  Pushover in iOS Settings → Notifications → Pushover.



## Setup for Bark on iOS (free, but a bit more work!)

### 1. Install and allow notifications

Install Bark from the App Store and open it.
When iOS asks, allow Notifications, and allow Critical Alerts if that prompt appears.
Check it took effect: go to iPhone Settings → Notifications → Bark and make sure both Allow Notifications and Critical Alerts are on. Critical Alerts is what lets it ring on silent.

### 2. Copy your Bark URL

On Bark’s home screen you’ll see a server address that looks like https://api.day.app/AbCdEf123456/. The part after day.app/ is your private device key.
Tap it and copy it.

### 3. Test Bark on its own

Turn your iPhone’s silent switch on.
Paste your URL into Safari on any device, add test?level=critical&volume=10 to the end, and open it, so it looks like:
https://api.day.app/AbCdEf123456/test?level=critical&volume=10
Your iPhone should sound and show a “test” notification even though it’s on silent. If it does, Bark is working.

### 4. Set up Find my Phone

In the Pebble app, open Find my Phone → Settings.
Set Alert service to Bark (free, iPhone only). The Bark fields will appear.
Paste the whole URL into Device key or URL. Leave Server blank.
Pick a Sound and leave Keep ringing every 30 seconds on.
Tap Save. The watch should show “Settings saved”.

### 5. Try it from the watch

Put the phone on silent, then open Find my Phone on the watch and press SELECT.
The watch should show “Ringing!” and the phone should play the alarm for about 30 seconds, repeating every 30 seconds.
Press DOWN to stop the repeats, or just leave the app.

### 6. If it doesn’t work

“Add keys in settings”: the Bark URL field is empty, or the service isn’t set to Bark.
“Error: …”: the key is wrong. Copy the URL from the Bark app again and re-paste it.
“Phone not connected”: the watch can’t see the Pebble app. Check Bluetooth and that the Pebble app is still running.
Notification appears but is silent: Critical Alerts is off. Recheck step 1.
Repeats stop early: repeats only run while Find my Phone is open on the watch, so keep it on screen until you find the phone.



## Phone Alarm on Android (free, nothing to install)

Phone Alarm plays an alarm sound directly from the Pebble app on your phone. It
doesn't need an account, another app or internet.

It plays at your phone's **media volume**, not the ringer volume. Android's
silent and vibrate modes don't mute media, so it rings on silent **as long as the
media volume is turned up**.

### 1. Set it up

Nothing to do. On Android, Phone Alarm is selected automatically when you first
install Find my Phone.

If you've picked a different service, open **Find my Phone → Settings** in the
Pebble app, set **Alert service** to **Play on phone (free, Android only)**, pick
a **Tone** and tap **Save**. Or just press UP on the watch until the title says
**Phone alarm**.

### 2. Choose a tone (optional)

| Tone      | Sound                                         |
|-----------|-----------------------------------------------|
| **Sonar** (default) | A recorded sonar ping                |
| **Ping**  | A bright, decaying electronic ping            |
| **Alarm** | Classic two-tone alarm                        |
| **Siren** | Rising and falling siren                      |
| **Chirps**| Quick bird-like chirps                        |
| **Beeper**| Slow, steady beeps, easy to follow to the phone |

### 3. Turn the media volume up

Press your phone's volume button and make sure the **media** volume (sometimes
shown as a music note) is turned up. Leave it up so the alarm is loud when you
need it.

### 4. Try it from the watch

Put the phone on silent or vibrate, then open Find my Phone on the watch and
press SELECT. The watch shows “Ringing!” and the phone plays the tone on a loop.

It stops when you press DOWN, swap service, or close the app on the watch, or
after 5 minutes.

### 5. If it doesn’t work

- **No sound, but the watch says “Ringing!”:** the media volume is down. Turn
  it up and try again. If you use Do Not Disturb, check your phone's Do Not
  Disturb settings allow media sounds.
- **“Phone alarm needs Android”:** Phone Alarm only works on Android phones. On
  an iPhone, use Pushover or Bark instead.
- **Sound stops when the phone is locked or the Pebble app is in the
  background:** check the Pebble app isn't restricted by battery saving
  (Android Settings → Apps → Pebble → Battery → Unrestricted).
- **“Phone not connected”:** the watch can’t see the Pebble app. Check
  Bluetooth and that the Pebble app is still running.



## Setup for ntfy on Android (free)

ntfy sends a push notification to the free ntfy app. It needs a little Android
setup to make a sound when your phone is quiet.

**Important:** Android has two different quiet settings:

- **Do Not Disturb:** ntfy can be allowed through this (step 3 below).
- **Silent or vibrate ringer mode:** this mutes notification sounds, and on many
  phones ntfy can't get through it.

So for ntfy to ring when you want quiet, **use Do Not Disturb rather than
silent mode**. If you need it to ring on full silent, use Phone Alarm or
Pushover instead.

### 1. Install ntfy

Install **ntfy** from the Google Play Store (or F-Droid) and open it. Allow
notifications when Android asks.

### 2. Subscribe to your topic

1. In the Pebble app, open **Find my Phone → Settings** and set **Alert
   service** to **ntfy**. A long random **Topic** is filled in for you; copy
   it. Anyone who knows the topic can send to it, so keep it random.
2. Tap **Save**.
3. In the ntfy app, tap **+**, paste the topic, leave the server as
   ntfy.sh, and subscribe.

### 3. Let max-priority alerts through

1. In the ntfy app, open **Settings → Channel settings** (or long-press the ntfy
   app icon → **Notifications**).
2. Open the **Max priority** channel and make sure:
   - **Sound** is on, with a loud sound chosen,
   - it's set to **alert / pop on screen**,
   - **Override Do Not Disturb** is on.
3. In ntfy's settings, turn on **Keep alerting for highest priority** if your
   version has it. Alerts then keep sounding until you dismiss them.

### 4. Stop Android delaying alerts

Go to **Android Settings → Apps → ntfy → Battery** and choose **Unrestricted**,
so alerts arrive straight away.

### 5. Try it from the watch

Turn on **Do Not Disturb**, then open Find my Phone on the watch and press
SELECT. The watch shows “Ringing!” and the phone should sound. With **Keep
ringing every 30 seconds** on, it re-sends the alert every 30 seconds for up to
5 minutes while the app is open on the watch. Press DOWN to stop.

### 6. If it doesn’t work

- **Notification arrives but makes no sound:** the phone is probably on silent
  or vibrate rather than Do Not Disturb. Use Do Not Disturb, or switch to
  Phone Alarm. Also recheck the Max priority channel in step 3.
- **Notification never arrives:** check the ntfy app is subscribed to exactly
  the same topic (and server) as in Find my Phone's settings, and that battery
  saving isn't restricting ntfy (step 4).
- **“Error: …”:** usually a mistyped topic or server.
- **Repeats stop early:** repeats only run while Find my Phone is open on the
  watch, so keep it on screen until you find the phone.