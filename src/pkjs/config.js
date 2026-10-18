// Settings page shown in the Pebble phone app (Ping Phone -> Settings).
// Built with Clay: https://github.com/pebble/clay
module.exports = [
  {
    type: 'heading',
    defaultValue: 'Ping Phone'
  },
  {
    type: 'text',
    defaultValue:
      'Press a button on your watch to make your phone ring through a Pushover alert. ' +
      'Your keys are stored only on this phone and are never sent to the watch.'
  },
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Pushover'
      },
      {
        type: 'input',
        messageKey: 'PushoverUserKey',
        label: 'User key',
        description: 'Shown on your Pushover dashboard after you sign in at pushover.net.',
        attributes: { placeholder: 'u...', autocapitalize: 'off', autocorrect: 'off' }
      },
      {
        type: 'input',
        messageKey: 'PushoverAppToken',
        label: 'Application API token',
        description: 'Create an application at pushover.net (Your Applications -> Create) and paste its token here.',
        attributes: { placeholder: 'a...', autocapitalize: 'off', autocorrect: 'off' }
      }
    ]
  },
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Alert'
      },
      {
        type: 'select',
        messageKey: 'Priority',
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
        label: 'Sound',
        defaultValue: 'persistent',
        options: [
          { label: 'Persistent (long, 30s)', value: 'persistent' },
          { label: 'Siren', value: 'siren' },
          { label: 'Space alarm', value: 'spacealarm' },
          { label: 'Echo', value: 'echo' },
          { label: 'Up down', value: 'updown' },
          { label: 'Alien alarm', value: 'alien' },
          { label: 'Pushover (default)', value: 'pushover' }
        ]
      },
      {
        type: 'toggle',
        messageKey: 'PingOnLaunch',
        label: 'Ping as soon as the app opens',
        description: 'Pair this with Quick Launch so one long-press on the watch rings your phone.',
        defaultValue: true
      }
    ]
  },
  {
    type: 'submit',
    defaultValue: 'Save'
  }
];
