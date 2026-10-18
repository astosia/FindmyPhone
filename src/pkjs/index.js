// Find my Phone - PebbleKit JS half. Runs inside the Pebble app on the phone.
// Receives "Ping" / "Cancel" from the watch and sends an alert to the phone
// through the provider chosen in settings:
//   - Pushover  (iPhone + Android; emergency priority/critical alerts with server-side repeats)
//   - Bark      (free, iPhone only; critical alerts, repeats driven from here)
//   - ntfy      (free, best on Android; max priority, repeats driven from here.  
//                Does not have critical priority on iOS, so it is not recommended for iPhone users.)

var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var clayCustom = require('./config-custom');

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

var PROVIDERS = ['pushover', 'bark', 'ntfy'];
var PROVIDER_NAMES = { pushover: 'Pushover', bark: 'Bark', ntfy: 'ntfy' };

// Which services make sense on which phone: Bark is iPhone-only, and ntfy
// can't ring through silent on iPhone.
var PROVIDERS_FOR_OS = {
  ios: ['pushover', 'bark'],
  android: ['pushover', 'ntfy']
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
    ntfyRepeat: bool(raw.NtfyRepeat, true)
  };
}

function isConfiguredFor(s, provider) {
  if (provider === 'bark') { return !!s.barkKey; }
  if (provider === 'ntfy') { return !!s.ntfyTopic; }
  return !!(s.userKey && s.appToken);
}

function isConfigured(s) {
  return isConfiguredFor(s, s.provider);
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
function sendStatus(text, ok) {
  var provider = loadSettings().provider;
  var msg = { Status: text, Service: PROVIDER_NAMES[provider] };
  if (ok !== null && ok !== undefined) {
    msg.Result = ok ? 1 : 0;           // watch vibrates on a result
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
  stopRepeats();
  sendOnce(s, function (err) {
    if (err) {
      console.log(label + ' error: ' + err);
      sendStatus(shortErr(err), false);
      return;
    }
    sendStatus('Ringing!', true);

    if (repeat) {
      repeatsLeft = Math.floor(REPEAT_FOR_S / REPEAT_EVERY_S) - 1;
      repeatTimer = setInterval(function () {
        if (repeatsLeft <= 0) {
          stopRepeats();
          return;
        }
        repeatsLeft--;
        sendOnce(loadSettings(), function (e) {
          if (e) { console.log(label + ' repeat error: ' + e); }
        });
      }, REPEAT_EVERY_S * 1000);
    }
  });
}

function cancelRepeats() {
  if (repeatTimer) {
    stopRepeats();
    sendStatus('Stopped', true);
  } else {
    sendStatus('Nothing to stop', false);
  }
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

  postForm(PUSHOVER_API + 'messages.json', params, pushoverOk, function (err, json) {
    if (err) {
      console.log('Pushover error: ' + err);
      sendStatus(shortErr(err), false);
      return;
    }
    if (json && json.receipt) {
      localStorage.setItem(RECEIPT_KEY, json.receipt);
    } else {
      localStorage.removeItem(RECEIPT_KEY);
    }
    sendStatus('Ringing!', true);
  });
}

function pushoverCancel(s) {
  var receipt = localStorage.getItem(RECEIPT_KEY);
  if (!receipt) {
    sendStatus('Nothing to stop', false);
    return;
  }
  postForm(PUSHOVER_API + 'receipts/' + encodeURIComponent(receipt) + '/cancel.json',
    { token: s.appToken }, pushoverOk,
    function (err) {
      localStorage.removeItem(RECEIPT_KEY);
      if (err) {
        console.log('Pushover cancel error: ' + err);
        sendStatus('Stop failed', false);
      } else {
        sendStatus('Stopped', true);
      }
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
    sendStatus('Add keys in settings', false);
    return;
  }
  if (s.provider === 'bark') {
    pingWithRepeats(s, 'Bark', barkSend, s.barkRepeat);
  } else if (s.provider === 'ntfy') {
    pingWithRepeats(s, 'ntfy', ntfySend, s.ntfyRepeat);
  } else {
    pushoverPing(s);
  }
}

function cancel() {
  var s = loadSettings();
  if (s.provider === 'bark' || s.provider === 'ntfy') {
    cancelRepeats();
  } else if (!s.appToken) {
    sendStatus('Add keys in settings', false);
  } else {
    pushoverCancel(s);
  }
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

  stopRepeats();
  storeProvider(next);
  sendStatus('Using ' + PROVIDER_NAMES[next], true);
}

// ---------- Pebble events ----------

Pebble.addEventListener('ready', function () {
  var s = loadSettings();
  if (!isConfigured(s)) {
    sendStatus('Add keys in settings', false);
  } else if (s.pingOnLaunch) {
    ping();
  } else {
    sendStatus('Press to ping', null);
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
  }
});

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) { return; }
  var settings = clay.getSettings(e.response, false);
  saveSettings(settings);
  stopRepeats();
  sendStatus('Settings saved', true);
});
