// Settings page shown in the Pebble phone app (Ping Phone -> Settings).
// Items tagged with group 'pushover', 'bark' or 'ntfy' are shown/hidden by
// config-custom.js depending on the selected provider and the phone type
module.exports = [
  {
    type: 'heading',
    defaultValue: 'Find my Phone'
  },
  {
    type: 'text',
    defaultValue:
      'Press a button on your watch to make your phone ring. ' +
      'Your keys are stored only on this phone and are never sent to the watch.'
  },
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Service'
      },
      {
        type: 'heading',
        defaultValue: 'You can set up more than one service: fill in each one\'s details, then save. Press UP on the watch to switch services.</br>Pushover is the easiest to set up and has a free trial, then a small one-time fee.</br>Other option is free but needs a bit more setup.',
        size: 6
      },
      {
        type: 'select',
        messageKey: 'Provider',
        label: 'Alert service',
        defaultValue: 'pushover',
       // description: 'You can set up more than one service: fill in each one\'s details, then save. Press UP on the watch to switch services.</br>Pushover is the easiest to set up and has a free trial, then a small one-time fee.</br>Bark is free, but needs a bit more setup and only works on iPhone.</br>ntfy is free and works best on Android (does not have critical priority notifications on iOS, so will not make a sound when phone is silent).',
        options: [
          { label: 'Pushover (iOS/Android)', value: 'pushover' },
          { label: 'Bark (free, iPhone only)', value: 'bark' },
          { label: 'ntfy (free, best on Android)', value: 'ntfy' },
          { label: 'Play on phone (free, Android only)', value: 'phone' }
        ]
      },
      {
        // Filled in automatically by config-custom.js; never shown.
        type: 'input',
        messageKey: 'PhoneOS',
        group: 'internal',
        defaultValue: ''
      },
      {
        type: 'toggle',
        messageKey: 'PingOnLaunch',
        label: 'Ping when opened with Quick Launch',
        description: 'On = ping immediately, Off = press select to ping',
        defaultValue: true
      }
    ]
  },

  // ---------- Pushover ----------
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Pushover',
        group: 'pushover'
      },
      {
        type: 'input',
        messageKey: 'PushoverUserKey',
        group: 'pushover',
        label: 'User key',
        description: 'Shown on your Pushover dashboard after you sign in at pushover.net.',
        attributes: { placeholder: 'u...', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'input',
        messageKey: 'PushoverAppToken',
        group: 'pushover',
        label: 'Application API token',
        description: 'Create an application at pushover.net (Your Applications -> Create) and paste its token here.',
        attributes: { placeholder: 'a...', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'input',
        messageKey: 'PushoverDevice',
        group: 'pushover',
        label: 'Device name (optional)',
        description: 'Leave blank to ring every phone on your Pushover account. Enter a device name from your Pushover dashboard (e.g. iphone or pixel) to ring only that phone. Separate several with commas.',
        attributes: { placeholder: 'all devices', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'select',
        messageKey: 'Priority',
        group: 'pushover',
        label: 'Priority',
        defaultValue: '2',
        description: 'Emergency repeats every 30 seconds until you acknowledge it, and rings on silent once Critical Alerts are enabled in the Pushover app.',
        options: [
          { label: 'Emergency (recommended)', value: '2' },
          { label: 'High', value: '1' },
          { label: 'Normal', value: '0' }
        ]
      },
      {
        type: 'select',
        messageKey: 'Sound',
        group: 'pushover',
        label: 'Sound',
        defaultValue: 'persistent',
        options: [
          { label: 'Persistent', value: 'persistent' },
          { label: 'Echo', value: 'echo' },
          { label: 'Climb', value: 'climb' },
          { label: 'Up down', value: 'updown' },
          { label: 'Alien alarm', value: 'alien' },
          { label: 'Vibrate (no sound)', value: 'vibrate'}
        ]
      }
    ]
  },

  // ---------- Bark ----------
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Bark',
        group: 'bark'
      },
      {
        type: 'input',
        messageKey: 'BarkKey',
        group: 'bark',
        label: 'Device key or URL',
        description: 'Open the Bark app and copy the URL on its home screen (e.g. https://api.day.app/yourkey/). Pasting the whole URL is fine.',
        attributes: { placeholder: 'https://api.day.app/...', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'input',
        messageKey: 'BarkServer',
        group: 'bark',
        label: 'Server (optional)',
        description: 'Leave blank for the official server. Only needed if you run your own Bark server.',
        attributes: { placeholder: 'https://api.day.app', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'select',
        messageKey: 'BarkSound',
        group: 'bark',
        label: 'Sound',
        description: 'upload a file called watchping.caf to Bark to use Custom sound (example file with Sonar sound available at https://github.com/astosia/FindmyPhone).',
        defaultValue: 'alarm',
        options: [
          { label: 'Alarm', value: 'alarm' },
          { label: 'Horn', value: 'horn' },
          { label: 'Electronic', value: 'electronic' },
          { label: 'Ringtone', value: 'multiwayinvitation' },
          { label: 'Telegraph', value: 'telegraph' },
          { label: 'NewsFlash', value: 'newsflash' },
          { label: 'Minuet', value: 'minuet' },
          { label: 'Silence (no sound)', value: 'silence' },
          { label: 'Custom', value: 'watchping' }
        ]
      },
      {
        type: 'toggle',
        messageKey: 'BarkRepeat',
        group: 'bark',
        label: 'Keep ringing every 30 seconds',
        description: 'Re-sends the alert for up to 5 minutes while Ping Phone is open on the watch. Press DOWN to stop.',
        defaultValue: true
      }
    ]
  },

  // ---------- ntfy ----------
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'ntfy',
        group: 'ntfy'
      },
      {
        type: 'text',
        group: 'ntfy',
        defaultValue:
          'Install the ntfy app on the phone, tap + and subscribe to the topic below. ' +
          'Anyone who knows the topic name can send to it, so keep the long random name.'
      },
      {
        type: 'input',
        messageKey: 'NtfyTopic',
        group: 'ntfy',
        label: 'Topic',
        description: 'A random topic is filled in for you. You can also paste a full topic URL such as https://ntfy.sh/your-topic.',
        attributes: { placeholder: 'ping-phone-...', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'input',
        messageKey: 'NtfyServer',
        group: 'ntfy',
        label: 'Server (optional)',
        description: 'Leave blank for the free public server, ntfy.sh.',
        attributes: { placeholder: 'https://ntfy.sh', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'input',
        messageKey: 'NtfyToken',
        group: 'ntfy',
        label: 'Access token (optional)',
        description: 'Only needed if your topic or server requires sign-in.',
        attributes: { placeholder: 'tk_...', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'toggle',
        messageKey: 'NtfyRepeat',
        group: 'ntfy',
        label: 'Keep ringing every 30 seconds',
        description: 'Re-sends the alert for up to 5 minutes while Ping Phone is open on the watch. Press DOWN to stop.',
        defaultValue: true
      }
    ]
  },

  // ---------- Play on phone (Android only) ----------
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Play on phone',
        group: 'phone'
      },
      {
        type: 'text',
        group: 'phone',
        defaultValue:
          'Plays an alarm tone directly from the Pebble app on your phone. No account, app or internet needed. ' +
          'It uses your phone\'s media volume, so it sounds even when the phone is on silent or vibrate, ' +
          'as long as the media volume is turned up. It plays for up to 5 minutes, ' +
          'and stops when you press DOWN or close the app on the watch.'
      },
      {
        type: 'select',
        messageKey: 'PhoneTune',
        group: 'phone',
        label: 'Tone',
        defaultValue: 'sonarclip',
        options: [
          { label: 'Sonar', value: 'sonarclip' },
          { label: 'Ping', value: 'sonar' },
          { label: 'Alarm', value: 'alarm' },
          { label: 'Siren', value: 'siren' },
          { label: 'Chirps', value: 'chirps' },
          { label: 'Beeper', value: 'beeper' }
        ]
      }
    ]
  },

  {
    type: 'submit',
    defaultValue: 'Save'
  }
];
