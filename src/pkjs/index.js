// Find my Phone - PebbleKit JS half. Runs inside the Pebble app on the phone.
// Receives "Ping" / "Cancel" from the watch and sends an alert to the phone
// through the provider chosen in settings:
//   - Pushover  (iPhone + Android; emergency priority/critical alerts with server-side repeats)
//   - Bark      (free, iPhone only; critical alerts, repeats driven from here)
//   - ntfy      (free, best on Android; max priority, repeats driven from here.  
//                Does not have critical priority on iOS, so it is not recommended for iPhone users.)
//   - Play on phone (free, Android only; plays a tone directly on the phone, no internet or account needed)

var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var clayCustom = require('./config-custom');
var phoneAlarm = require('./phone-alarm');

// We handle the settings page ourselves so the provider keys stay on the
// phone and are never sent to the watch.
var clay = new Clay(clayConfig, clayCustom, { autoHandleEvents: false });

var SETTINGS_KEY = 'ping-phone-settings';
var RECEIPT_KEY = 'ping-phone-last-receipt';
var REQUEST_TIMEOUT_MS = 10000;

var PUSHOVER_API = 'https://api.pushover.net/1/';
var BARK_DEFAULT_SERVER = 'https://api.day.app';
var NTFY_DEFAULT_SERVER = 'https://ntfy.sh';

// Repeat behaviour: every 30s for up to 5 minutes.
// Pushover does this server-side; for Bark and ntfy we re-send from here
// while the watchapp is open.
var REPEAT_EVERY_S = 30;
var REPEAT_FOR_S = 300;

var ALERT_TITLE = 'Ping Phone';
var ALERT_BODY = 'Your watch is looking for this phone.';

var PROVIDERS = ['pushover', 'bark', 'ntfy', 'phone'];
var PROVIDER_NAMES = { pushover: 'Pushover', bark: 'Bark', ntfy: 'ntfy', phone: 'Phone alarm' };

// Which services make sense on which phone: Bark is iPhone-only, ntfy can't
// ring through silent on iPhone, and the phone alarm needs Android's web view.
var PROVIDERS_FOR_OS = {
  ios: ['pushover', 'bark'],
  android: ['pushover', 'ntfy', 'phone']
};

function detectOS(userAgent) {
  var ua = String(userAgent || '');
  if (/iPhone|iPad|iPod/i.test(ua)) { return 'ios'; }
  if (/Android/i.test(ua)) { return 'android'; }
  return '';
}

// Prefer what the phone reports right now; fall back to what the settings
// page detected when it was last saved.
function phoneOS(stored) {
  var live = '';
  try { live = detectOS(navigator.userAgent); } catch (e) {}
  return live || stored || '';
}

function allowedProviders(os) {
  return PROVIDERS_FOR_OS[os] || PROVIDERS;
}

var repeatTimer = null;
var repeatsLeft = 0;

// ---------- Settings ----------

function unwrap(v) {
  if (v !== null && typeof v === 'object' && 'value' in v) {
    return v.value;
  }
  return v;
}

function str(v) {
  var u = unwrap(v);
  return String(u === undefined || u === null ? '' : u).trim();
}

function bool(v, dflt) {
  var u = unwrap(v);
  return u === undefined || u === null ? dflt : !!u;
}

// Accepts either a bare key/topic, or a full URL such as
// "https://api.day.app/AbCdEf123/" or "https://ntfy.sh/my-topic".
// The server typed into the separate server field wins over one in the URL.
function splitUrl(input, serverInput, defaultServer) {
  var id = str(input);
  var server = str(serverInput).replace(/\/+$/, '');
  var m = id.match(/^(https?:\/\/[^\/]+)\/([^\/?#]+)/i);
  if (m) {
    if (!server) { server = m[1]; }
    id = m[2];
  }
  return { id: id, server: server || defaultServer };
}

function loadSettings() {
  var raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch (e) {
    raw = {};
  }
  var priority = parseInt(unwrap(raw.Priority), 10);
  var bark = splitUrl(raw.BarkKey, raw.BarkServer, BARK_DEFAULT_SERVER);
  var ntfy = splitUrl(raw.NtfyTopic, raw.NtfyServer, NTFY_DEFAULT_SERVER);
  var os = phoneOS(str(raw.PhoneOS));
  var allowed = allowedProviders(os);
  var provider = str(raw.Provider);
  if (allowed.indexOf(provider) === -1) { provider = 'pushover'; }

  return {
    provider: provider,
    os: os,
    pingOnLaunch: bool(raw.PingOnLaunch, true),

    userKey: str(raw.PushoverUserKey),
    appToken: str(raw.PushoverAppToken),
    device: str(raw.PushoverDevice).replace(/\s*,\s*/g, ','),
    priority: isNaN(priority) ? 2 : priority,
    sound: str(raw.Sound) || 'persistent',

    barkKey: bark.id,
    barkServer: bark.server,
    barkSound: str(raw.BarkSound) || 'alarm',
    barkRepeat: bool(raw.BarkRepeat, true),

    ntfyTopic: ntfy.id,
    ntfyServer: ntfy.server,
    ntfyToken: str(raw.NtfyToken),
    ntfyRepeat: bool(raw.NtfyRepeat, true),

    phoneTune: str(raw.PhoneTune) || 'sonarclip'
  };
}

function isConfiguredFor(s, provider) {
  if (provider === 'bark') { return !!s.barkKey; }
  if (provider === 'ntfy') { return !!s.ntfyTopic; }
  if (provider === 'phone') { return phoneAlarm.isSupported(); }   // nothing to set up
  return !!(s.userKey && s.appToken);
}

function isConfigured(s) {
  return isConfiguredFor(s, s.provider);
}

// First run on a phone that can play sound itself (Android): start with
// "Play on phone" selected, so it works without opening settings. Also
// written into Clay's copy so the settings page shows the same choice.
// Does nothing once any settings have been saved, so it never overrides
// a user's choice.
function applyFirstRunDefaults() {
  if (localStorage.getItem(SETTINGS_KEY) || !phoneAlarm.isSupported()) { return; }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ Provider: 'phone', PhoneTune: 'sonarclip' }));
  if (!localStorage.getItem('clay-settings')) {
    localStorage.setItem('clay-settings', JSON.stringify({ Provider: 'phone', PhoneTune: 'sonarclip' }));
  }
}

// What to tell the user when the selected service can't be used yet.
function notReadyMessage(s) {
  if (s.provider === 'phone') {
    // No Web Audio here: an iPhone, or the emulator (no Android web view).
    return 'Phone alarm needs Android';
  }
  return 'Add keys in settings';
}

// Writes the chosen provider into our settings and into Clay's own copy,
// so the settings page shows the same choice next time it opens.
function storeProvider(provider) {
  [SETTINGS_KEY, 'clay-settings'].forEach(function (key) {
    var obj = {};
    try {
      obj = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (e) {
      obj = {};
    }
    if (key === 'clay-settings' && !localStorage.getItem(key)) { return; }
    if (obj.Provider !== null && typeof obj.Provider === 'object' && 'value' in obj.Provider) {
      obj.Provider.value = provider;
    } else {
      obj.Provider = provider;
    }
    localStorage.setItem(key, JSON.stringify(obj));
  });
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

// Every status also carries the active service name, shown as the title.
// ringing (optional): true/false tells the watch to start/stop its animation.
function sendStatus(text, ok, ringing) {
  var provider = loadSettings().provider;
  var msg = { Status: text, Service: PROVIDER_NAMES[provider] };
  if (ok !== null && ok !== undefined) {
    msg.Result = ok ? 1 : 0;           // watch vibrates on a result
  }
  if (ringing !== undefined) {
    msg.Ringing = ringing ? 1 : 0;
  }
  Pebble.sendAppMessage(
    msg,
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
        params[key] !== undefined && params[key] !== null && params[key] !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
  }
  return parts.join('&');
}

// req: { url, body, contentType, headers, isOk(httpStatus, json) }
// callback(err, json)
function post(req, callback) {
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
    if (req.isOk(xhr.status, json)) {
      finish(null, json);
    } else {
      var msg = 'HTTP ' + xhr.status;
      if (json && json.errors && json.errors.length) {
        msg = json.errors.join('; ');          // Pushover
      } else if (json && json.error) {
        msg = json.error;                      // ntfy
      } else if (json && json.message) {
        msg = json.message;                    // Bark
      }
      finish(msg, json);
    }
  };
  xhr.onerror = function () { finish('No internet'); };

  xhr.open('POST', req.url, true);
  xhr.setRequestHeader('Content-Type', req.contentType);
  var headers = req.headers || {};
  for (var h in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, h)) {
      xhr.setRequestHeader(h, headers[h]);
    }
  }
  xhr.send(req.body);
}

function postForm(url, params, isOk, callback) {
  post({
    url: url,
    body: encodeForm(params),
    contentType: 'application/x-www-form-urlencoded',
    isOk: isOk
  }, callback);
}

function http2xx(status) {
  return status >= 200 && status < 300;
}

function shortErr(err) {
  return 'Error: ' + String(err).substring(0, 24);
}

// ---------- Stopping everything ----------
//
// pingGen identifies the current ping. Stopping or switching bumps it, so a
// send that finishes afterwards knows it's stale: it doesn't start repeats or
// report "Ringing!", and a late Pushover emergency alert is cancelled at once.
var pingGen = 0;
var pingInFlight = false;

function cancelPushoverReceipt(receipt, token, callback) {
  postForm(PUSHOVER_API + 'receipts/' + encodeURIComponent(receipt) + '/cancel.json',
    { token: token }, pushoverOk, function (err) {
      if (err) { console.log('Pushover cancel error: ' + err); }
      if (callback) { callback(err); }
    });
}

// Stops whatever any service is doing: Bark/ntfy repeats, a Pushover
// emergency alert (whichever service is selected now), and any send still
// in flight. callback(hadSomething, err) is optional.
function stopEverything(s, callback) {
  var had = !!repeatTimer || pingInFlight || phoneAlarm.isPlaying();
  pingGen++;
  pingInFlight = false;
  stopRepeats();
  phoneAlarm.stop();

  var receipt = localStorage.getItem(RECEIPT_KEY);
  localStorage.removeItem(RECEIPT_KEY);
  if (receipt && s.appToken) {
    cancelPushoverReceipt(receipt, s.appToken, function (err) {
      if (callback) { callback(true, err); }
    });
  } else if (callback) {
    callback(had, null);
  }
}

// ---------- Repeats (Bark and ntfy) ----------

function stopRepeats() {
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  repeatsLeft = 0;
}

// sendOnce(settings, callback(err)) sends one alert.
function pingWithRepeats(s, label, sendOnce, repeat) {
  var gen = pingGen;
  pingInFlight = true;
  sendOnce(s, function (err) {
    if (gen !== pingGen) { return; }     // stopped or switched meanwhile
    pingInFlight = false;
    if (err) {
      console.log(label + ' error: ' + err);
      sendStatus(shortErr(err), false, false);
      return;
    }
    sendStatus('Ringing!', true, true);

    if (repeat) {
      repeatsLeft = Math.floor(REPEAT_FOR_S / REPEAT_EVERY_S) - 1;
      repeatTimer = setInterval(function () {
        if (repeatsLeft <= 0) {
          stopRepeats();
          return;
        }
        repeatsLeft--;
        if (gen !== pingGen) { stopRepeats(); return; }
        sendOnce(loadSettings(), function (e) {
          if (e) { console.log(label + ' repeat error: ' + e); }
        });
      }, REPEAT_EVERY_S * 1000);
    }
  });
}

// ---------- Pushover ----------

function pushoverOk(status, json) {
  return http2xx(status) && !!json && json.status === 1;
}

function pushoverPing(s) {
  var params = {
    token: s.appToken,
    user: s.userKey,
    device: s.device,          // optional: ring only these devices
    title: ALERT_TITLE,
    message: ALERT_BODY,
    priority: s.priority,
    sound: s.sound
  };
  if (s.priority === 2) {
    params.retry = REPEAT_EVERY_S;
    params.expire = REPEAT_FOR_S;
  }

  var gen = pingGen;
  pingInFlight = true;
  postForm(PUSHOVER_API + 'messages.json', params, pushoverOk, function (err, json) {
    if (gen !== pingGen) {
      // Stopped or switched while this was sending: cancel it straight away.
      if (!err && json && json.receipt) {
        cancelPushoverReceipt(json.receipt, s.appToken);
      }
      return;
    }
    pingInFlight = false;
    if (err) {
      console.log('Pushover error: ' + err);
      sendStatus(shortErr(err), false, false);
      return;
    }
    if (json && json.receipt) {
      localStorage.setItem(RECEIPT_KEY, json.receipt);
    } else {
      localStorage.removeItem(RECEIPT_KEY);
    }
    sendStatus('Ringing!', true, true);
  });
}

// ---------- Bark ----------

function barkOk(status, json) {
  return http2xx(status) && (!json || json.code === undefined || json.code === 200);
}

function barkSend(s, callback) {
  postForm(s.barkServer + '/' + encodeURIComponent(s.barkKey), {
    title: ALERT_TITLE,
    body: ALERT_BODY,
    level: 'critical',   // ignores silent mode and Do Not Disturb
    volume: 10,          // critical-alert volume, 0-10
    call: 1,             // repeat the sound for 30 seconds
    sound: s.barkSound,
    group: 'Ping Phone'
  }, barkOk, callback);
}

// ---------- ntfy ----------

function ntfyOk(status, json) {
  return http2xx(status) && (!json || !json.error);
}

function ntfySend(s, callback) {
  var headers = {};
  if (s.ntfyToken) {
    headers.Authorization = 'Bearer ' + s.ntfyToken;
  }
  // JSON publishing goes to the server root with the topic in the body.
  post({
    url: s.ntfyServer + '/',
    contentType: 'application/json',
    headers: headers,
    body: JSON.stringify({
      topic: s.ntfyTopic,
      title: ALERT_TITLE,
      message: ALERT_BODY,
      priority: 5,                 // "max": long vibration, pop-over
      tags: ['rotating_light']
    }),
    isOk: ntfyOk
  }, callback);
}

// ---------- Actions ----------

function ping() {
  var s = loadSettings();
  if (!isConfigured(s)) {
    sendStatus(notReadyMessage(s), false);
    return;
  }
  stopEverything(s);                     // a new ping replaces any earlier one
  if (s.provider === 'bark') {
    pingWithRepeats(s, 'Bark', barkSend, s.barkRepeat);
  } else if (s.provider === 'ntfy') {
    pingWithRepeats(s, 'ntfy', ntfySend, s.ntfyRepeat);
  } else if (s.provider === 'phone') {
    var err = phoneAlarm.play(s.phoneTune, REPEAT_FOR_S);
    if (err) {
      sendStatus(err, false, false);
    } else {
      sendStatus('Ringing!', true, true);
    }
  } else {
    pushoverPing(s);
  }
}

function cancel() {
  stopEverything(loadSettings(), function (had, err) {
    if (err) {
      sendStatus('Stop failed', false);
    } else if (had) {
      sendStatus('Stopped', true, false);
    } else {
      sendStatus('Nothing to stop', false, false);
    }
  });
}

function switchProvider() {
  var s = loadSettings();
  var options = allowedProviders(s.os);
  var ready = options.filter(function (p) { return isConfiguredFor(s, p); });

  if (ready.length === 0) {
    sendStatus('Add keys in settings', false);
    return;
  }
  if (ready.length === 1 && ready[0] === s.provider) {
    sendStatus('Only ' + PROVIDER_NAMES[s.provider] + ' set up', false);
    return;
  }

  // Next set-up provider after the current one, wrapping round.
  var start = options.indexOf(s.provider);
  var next = s.provider;
  for (var i = 1; i <= options.length; i++) {
    var candidate = options[(start + i) % options.length];
    if (isConfiguredFor(s, candidate)) {
      next = candidate;
      break;
    }
  }

  stopEverything(s);                     // nothing carries on from the old service
  storeProvider(next);
  sendStatus('Using ' + PROVIDER_NAMES[next], true, false);
}

// ---------- Pebble events ----------

// On start-up we only report status. Pinging on launch is decided by the
// watch, which sends "Launch" only when the app was opened with Quick Launch
// (not from the app menu, or when the phone opens it after an install).
Pebble.addEventListener('ready', function () {
  applyFirstRunDefaults();
  var s = loadSettings();
  if (!isConfigured(s)) {
    sendStatus(notReadyMessage(s), false);
  } else {
    sendStatus('Press to Ping', null);
  }
});

Pebble.addEventListener('appmessage', function (e) {
  var payload = e.payload || {};
  if (payload.Ping !== undefined) {
    ping();
  } else if (payload.Cancel !== undefined) {
    cancel();
  } else if (payload.Switch !== undefined) {
    switchProvider();
  } else if (payload.Launch !== undefined) {
    var s = loadSettings();
    if (isConfigured(s) && s.pingOnLaunch) {
      ping();
    }
  }
});

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) { return; }
  stopEverything(loadSettings());        // using the old keys, before they change
  var settings = clay.getSettings(e.response, false);
  saveSettings(settings);
  sendStatus('Settings saved', true);
});
