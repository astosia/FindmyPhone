// Runs inside the Clay settings page (a web view on the phone):
//  - works out whether the phone is an iPhone or Android and hides the
//    service that doesn't suit it (ntfy on iPhone, Bark on Android)
//  - shows only the settings for the provider that is currently selected
//  - fills in a random ntfy topic if none has been set yet
module.exports = function (minified) {
  var clayConfig = this;
  var GROUPS = ['pushover', 'bark', 'ntfy'];
  var HIDE_FOR_OS = { ios: 'ntfy', android: 'bark' };

  function detectOS() {
    var ua = String((window.navigator && window.navigator.userAgent) || '');
    if (/iPhone|iPad|iPod/i.test(ua)) { return 'ios'; }
    if (/Android/i.test(ua)) { return 'android'; }
    return '';
  }

  function randomTopic() {
    var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    var out = 'ping-phone-';
    for (var i = 0; i < 16; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function removeOption(item, value) {
    var root = item.$element && item.$element[0];
    var option = root && root.querySelector('option[value="' + value + '"]');
    if (option && option.parentNode) {
      option.parentNode.removeChild(option);
    }
  }

  function update() {
    var providerItem = clayConfig.getItemByMessageKey('Provider');
    var provider = providerItem ? providerItem.get() : 'pushover';
    if (GROUPS.indexOf(provider) === -1) { provider = 'pushover'; }

    GROUPS.forEach(function (group) {
      clayConfig.getItemsByGroup(group).forEach(function (item) {
        if (group === provider) { item.show(); } else { item.hide(); }
      });
    });
  }

  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var os = detectOS();

    // Remember the phone type so the watch can switch between the right services.
    clayConfig.getItemsByGroup('internal').forEach(function (item) { item.hide(); });
    var osItem = clayConfig.getItemByMessageKey('PhoneOS');
    if (osItem && os) {
      osItem.set(os);
    }

    var providerItem = clayConfig.getItemByMessageKey('Provider');
    var hidden = HIDE_FOR_OS[os];
    if (providerItem && hidden) {
      if (providerItem.get() === hidden) {
        providerItem.set('pushover');
      }
      removeOption(providerItem, hidden);
      // Its settings are never needed on this phone.
      clayConfig.getItemsByGroup(hidden).forEach(function (item) { item.hide(); });
      GROUPS = GROUPS.filter(function (g) { return g !== hidden; });
    }

    var topicItem = clayConfig.getItemByMessageKey('NtfyTopic');
    if (topicItem && !String(topicItem.get() || '').trim()) {
      topicItem.set(randomTopic());
    }

    if (providerItem) {
      providerItem.on('change', update);
    }
    update();
  });
};
