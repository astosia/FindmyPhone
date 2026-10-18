// Ping Phone - PebbleKit JS half. Runs inside the Pebble app on the phone.
// Receives "Ping" / "Cancel" from the watch and calls the Pushover API.

var Clay = require('@rebble/clay');
var clayConfig = require('./config');

// We handle the settings page ourselves so the Pushover keys stay on the
// phone and are never sent to the watch.
var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var PUSHOVER_API = 'https://api.pushover.net/1/';
var SETTINGS_KEY = 'ping-phone-settings';
var RECEIPT_KEY = 'ping-phone-last-receipt';
var REQUEST_TIMEOUT_MS = 10000;

// Emergency-priority options: retry every 30s (Pushover's minimum) for 5 minutes.
var EMERGENCY_RETRY_S = 30;
var EMERGENCY_EXPIRE_S = 300;

// ---------- Settings ----------

function unwrap(v) {
  if (v !== null && typeof v === 'object' && 'value' in v) {
    return v.value;
  }
  return v;
}

function loadSettings() {
  var raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch (e) {
    raw = {};
  }
  var priority = parseInt(unwrap(raw.Priority), 10);
  var pingOnLaunch = unwrap(raw.PingOnLaunch);
  return {
    userKey: String(unwrap(raw.PushoverUserKey) || '').trim(),
    appToken: String(unwrap(raw.PushoverAppToken) || '').trim(),
    priority: isNaN(priority) ? 2 : priority,
    sound: unwrap(raw.Sound) || 'persistent',
    pingOnLaunch: pingOnLaunch === undefined ? true : !!pingOnLaunch
  };
}

function saveSettings(raw) {
  var clean = {};
  for (var key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      clean[key] = unwrap(raw[key]);
    }
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
}

// ---------- Watch messaging ----------

function sendStatus(text, ok) {
  Pebble.sendAppMessage(
    { Status: text, Result: ok ? 1 : 0 },
    function () {},
    function (e) {
      console.log('Failed to send status to watch: ' + JSON.stringify(e));
    }
  );
}

// ---------- HTTP ----------

function encodeForm(params) {
  var parts = [];
  for (var key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key) &&
        params[key] !== undefined && params[key] !== null) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
  }
  return parts.join('&');
}

// callback(err, json)
function postForm(url, params, callback) {
  var done = false;
  var xhr = new XMLHttpRequest();

  var timer = setTimeout(function () {
    if (done) { return; }
    done = true;
    try { xhr.abort(); } catch (e) {}
    callback('Timed out');
  }, REQUEST_TIMEOUT_MS);

  function finish(err, json) {
    if (done) { return; }
    done = true;
    clearTimeout(timer);
    callback(err, json);
  }

  xhr.onload = function () {
    var json = null;
    try { json = JSON.parse(xhr.responseText); } catch (e) {}
    if (xhr.status >= 200 && xhr.status < 300 && json && json.status === 1) {
      finish(null, json);
    } else {
      var msg = (json && json.errors && json.errors.length) ?
        json.errors.join('; ') : ('HTTP ' + xhr.status);
      finish(msg, json);
    }
  };
  xhr.onerror = function () { finish('No internet'); };

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send(encodeForm(params));
}

// ---------- Actions ----------

function ping() {
  var s = loadSettings();
  if (!s.userKey || !s.appToken) {
    sendStatus('Add keys in settings', false);
    return;
  }

  var params = {
    token: s.appToken,
    user: s.userKey,
    title: 'Ping Phone',
    message: 'Your watch is looking for this phone.',
    priority: s.priority,
    sound: s.sound
  };
  if (s.priority === 2) {
    params.retry = EMERGENCY_RETRY_S;
    params.expire = EMERGENCY_EXPIRE_S;
  }

  postForm(PUSHOVER_API + 'messages.json', params, function (err, json) {
    if (err) {
      console.log('Pushover error: ' + err);
      sendStatus('Error: ' + String(err).substring(0, 24), false);
      return;
    }
    if (json && json.receipt) {
      localStorage.setItem(RECEIPT_KEY, json.receipt);
      sendStatus('Ringing!', true);
    } else {
      localStorage.removeItem(RECEIPT_KEY);
      sendStatus('Sent!', true);
    }
  });
}

function cancel() {
  var s = loadSettings();
  var receipt = localStorage.getItem(RECEIPT_KEY);
  if (!receipt) {
    sendStatus('Nothing to stop', false);
    return;
  }
  if (!s.appToken) {
    sendStatus('Add keys in settings', false);
    return;
  }

  postForm(PUSHOVER_API + 'receipts/' + encodeURIComponent(receipt) + '/cancel.json',
    { token: s.appToken },
    function (err) {
      localStorage.removeItem(RECEIPT_KEY);
      if (err) {
        console.log('Cancel error: ' + err);
        sendStatus('Stop failed', false);
      } else {
        sendStatus('Stopped', true);
      }
    });
}

// ---------- Pebble events ----------

Pebble.addEventListener('ready', function () {
  var s = loadSettings();
  if (!s.userKey || !s.appToken) {
    sendStatus('Add keys in settings', false);
  } else if (s.pingOnLaunch) {
    ping();
  }
});

Pebble.addEventListener('appmessage', function (e) {
  var payload = e.payload || {};
  if (payload.Ping !== undefined) {
    ping();
  } else if (payload.Cancel !== undefined) {
    cancel();
  }
});

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) { return; }
  var settings = clay.getSettings(e.response, false);
  saveSettings(settings);
  sendStatus('Settings saved', true);
});
