// Phone alarm: plays a tone directly on the phone, with no internet or account.
//
// On Android, PebbleKit JS runs inside a web view in the Pebble app, so it can
// use the Web Audio API to generate sound. That plays at the phone's *media*
// volume, which Android's silent/vibrate ringer mode doesn't mute.
// On iPhone, PebbleKit JS has no web view and no audio, so this isn't available.
//
// Tunes are either generated (a list of steps: [frequency Hz (0 = pause),
// seconds, glide-to Hz]) or a recorded clip, embedded as base64 MP3.

var CLIPS = {
  // The recorded sonar ping, played on a loop with a short gap.
  sonarclip: { data: require('./sonar-sound'), gap: 0.4 }
};
var decoded = {};          // clip name -> AudioBuffer, decoded once

var TUNES = {
  // A bright sonar-style ping that decays, three times, then a gap.
  sonar: { wave: 'sine', decay: true, steps: [
    [1760, 0.55], [0, 0.15], [1760, 0.55], [0, 0.15], [1760, 0.55], [0, 0.9]
  ] },
  // Classic two-tone alarm.
  alarm: { wave: 'square', steps: [
    [1320, 0.18], [990, 0.18], [1320, 0.18], [990, 0.18],
    [1320, 0.18], [990, 0.18], [0, 0.35]
  ] },
  // Rising sweep, like a siren winding up.
  siren: { wave: 'triangle', steps: [
    [700, 0.9, 1600], [1600, 0.9, 700], [0, 0.15]
  ] },
  // Quick bird-like chirps.
  chirps: { wave: 'sine', steps: [
    [2000, 0.07, 2600], [0, 0.05], [2000, 0.07, 2600], [0, 0.05],
    [2000, 0.07, 2600], [0, 0.6]
  ] },
  // Slow, steady beeps: easy to follow to the source.
  beeper: { wave: 'square', steps: [
    [1500, 0.25], [0, 0.5]
  ] }
};

var VOLUME = 0.9;
var LOOKAHEAD_S = 1.0;    // schedule this far ahead of the audio clock

var ctx = null;
var timer = null;
var stopTimer = null;
var nextStart = 0;

function audioClass() {
  try {
    if (typeof window === 'undefined') { return null; }
    return window.AudioContext || window.webkitAudioContext || null;
  } catch (e) {
    return null;
  }
}

function isSupported() {
  return !!audioClass();
}

function isPlaying() {
  return !!ctx;
}

// Schedules one pass of the tune starting at time t; returns when it ends.
function scheduleTune(tune, t) {
  var gainLevel = tune.wave === 'square' ? VOLUME * 0.45 : VOLUME;
  tune.steps.forEach(function (step) {
    var freq = step[0], dur = step[1], glideTo = step[2];
    if (freq > 0) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = tune.wave;
      osc.frequency.setValueAtTime(freq, t);
      if (glideTo) {
        osc.frequency.linearRampToValueAtTime(glideTo, t + dur);
      }
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(gainLevel, t + 0.01);
      if (tune.decay) {
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      } else {
        gain.gain.setValueAtTime(gainLevel, t + dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + dur);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    t += dur;
  });
  return t;
}

function base64ToArrayBuffer(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
  return bytes.buffer;
}

// Decodes a clip (callback form works on old and new web views).
function decodeClip(name, done) {
  if (decoded[name]) { done(decoded[name]); return; }
  var c = ctx;
  try {
    var p = c.decodeAudioData(base64ToArrayBuffer(CLIPS[name].data),
      function (buf) { decoded[name] = buf; done(buf); },
      function () { done(null); });
    if (p && p.catch) { p.catch(function () {}); }
  } catch (e) {
    done(null);
  }
}

function startLoop(schedule) {
  function topUp() {
    if (!ctx) { return; }
    while (nextStart < ctx.currentTime + LOOKAHEAD_S) {
      nextStart = schedule(nextStart);
    }
  }
  topUp();
  timer = setInterval(topUp, 250);
}

function scheduleClip(buffer, gap, t) {
  var src = ctx.createBufferSource();
  var gain = ctx.createGain();
  src.buffer = buffer;
  gain.gain.value = 1.0;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
  return t + buffer.duration + gap;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  if (ctx) {
    try { ctx.close(); } catch (e) {}
    ctx = null;
  }
}

// Plays the tune on a loop until stop() or maxSeconds. Returns an error
// string if sound isn't possible on this phone, otherwise null.
function play(tuneName, maxSeconds) {
  stop();
  var AC = audioClass();
  if (!AC) { return 'Not supported here'; }
  try {
    ctx = new AC();
    if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
  } catch (e) {
    ctx = null;
    return 'Audio error';
  }

  nextStart = ctx.currentTime + 0.1;
  var playingCtx = ctx;

  if (CLIPS[tuneName]) {
    var clip = CLIPS[tuneName];
    decodeClip(tuneName, function (buffer) {
      if (ctx !== playingCtx) { return; }          // stopped while decoding
      if (buffer) {
        nextStart = Math.max(nextStart, ctx.currentTime + 0.05);
        startLoop(function (t) { return scheduleClip(buffer, clip.gap, t); });
      } else {
        // Couldn't decode the clip on this phone: use the generated ping.
        startLoop(function (t) { return scheduleTune(TUNES.sonar, t); });
      }
    });
  } else {
    var tune = TUNES[tuneName] || TUNES.sonar;
    startLoop(function (t) { return scheduleTune(tune, t); });
  }

  if (maxSeconds) {
    stopTimer = setTimeout(stop, maxSeconds * 1000);
  }
  return null;
}

module.exports = {
  TUNES: Object.keys(CLIPS).concat(Object.keys(TUNES)),
  isSupported: isSupported,
  isPlaying: isPlaying,
  play: play,
  stop: stop
};
