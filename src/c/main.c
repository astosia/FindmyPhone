/*
 * Ping Phone - press a button on your Pebble to make your iPhone ring
 * via a Pushover emergency (critical) alert.
 *
 *   SELECT        -> ping the phone
 *   UP            -> ping the phone (alternative)
 *   hold SELECT   -> stop the alert (cancels the Pushover emergency retries)
 *
 * The watch has no internet of its own: it sends an AppMessage to the
 * PebbleKit JS half (src/pkjs/index.js), which runs inside the Pebble app
 * on the phone and calls the Pushover API.
 */
#include <pebble.h>

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_status_layer;
static TextLayer *s_hint_layer;

static char s_status[64] = "Press to ping";

static void set_status(const char *text) {
  strncpy(s_status, text, sizeof(s_status) - 1);
  s_status[sizeof(s_status) - 1] = '\0';
  if (s_status_layer) {
    text_layer_set_text(s_status_layer, s_status);
  }
}

static void send_command(uint32_t key, const char *pending_text) {
  if (!connection_service_peek_pebble_app_connection()) {
    set_status("Phone not connected");
    vibes_double_pulse();
    return;
  }

  DictionaryIterator *iter;
  AppMessageResult result = app_message_outbox_begin(&iter);
  if (result != APP_MSG_OK) {
    set_status("Busy, try again");
    return;
  }

  dict_write_uint8(iter, key, 1);
  result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    set_status("Send failed");
    return;
  }

  set_status(pending_text);
}

/* ---------- Buttons ---------- */

static void ping_click_handler(ClickRecognizerRef recognizer, void *context) {
  send_command(MESSAGE_KEY_Ping, "Pinging...");
}

static void cancel_long_click_handler(ClickRecognizerRef recognizer, void *context) {
  send_command(MESSAGE_KEY_Cancel, "Stopping...");
}

static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, ping_click_handler);
  window_single_click_subscribe(BUTTON_ID_UP, ping_click_handler);
  window_long_click_subscribe(BUTTON_ID_SELECT, 700, cancel_long_click_handler, NULL);
}

/* ---------- AppMessage ---------- */

static void inbox_received_handler(DictionaryIterator *iter, void *context) {
  Tuple *status_t = dict_find(iter, MESSAGE_KEY_Status);
  if (status_t && status_t->type == TUPLE_CSTRING) {
    set_status(status_t->value->cstring);
  }

  Tuple *result_t = dict_find(iter, MESSAGE_KEY_Result);
  if (result_t) {
    if (result_t->value->int32 == 1) {
      vibes_short_pulse();
    } else {
      vibes_double_pulse();
    }
  }
}

static void inbox_dropped_handler(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_WARNING, "Inbox dropped: %d", (int)reason);
}

static void outbox_failed_handler(DictionaryIterator *iter, AppMessageResult reason,
                                  void *context) {
  APP_LOG(APP_LOG_LEVEL_WARNING, "Outbox failed: %d", (int)reason);
  set_status("Can't reach phone");
  vibes_double_pulse();
}

/* ---------- Window ---------- */

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);
  const int16_t inset = PBL_IF_ROUND_ELSE(16, 2);
  const int16_t width = bounds.size.w - (2 * inset);

  /* Bigger hint text on the larger Pebble Time 2 screen (200x228). */
  const bool large_screen = bounds.size.w >= 200;
  GFont title_font  = fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD);
  GFont status_font = fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD);
  GFont hint_font   = fonts_get_system_font(large_screen ? FONT_KEY_GOTHIC_24_BOLD
                                                         : FONT_KEY_GOTHIC_18_BOLD);
  const int16_t hint_h  = large_screen ? 54 : 42;
  const int16_t title_y = PBL_IF_ROUND_ELSE(14, 0);
  const int16_t title_h = 34;
  const int16_t hint_y  = bounds.size.h - hint_h - PBL_IF_ROUND_ELSE(14, 2);
  const int16_t status_y = title_y + title_h;
  const int16_t status_h = hint_y - status_y;

  window_set_background_color(window, PBL_IF_COLOR_ELSE(GColorOxfordBlue, GColorBlack));

  s_title_layer = text_layer_create(GRect(inset, title_y, width, title_h));
  text_layer_set_text(s_title_layer, "Ping Phone");
  text_layer_set_font(s_title_layer, title_font);
  text_layer_set_text_alignment(s_title_layer, GTextAlignmentCenter);
  text_layer_set_background_color(s_title_layer, GColorClear);
  text_layer_set_text_color(s_title_layer, GColorWhite);
  layer_add_child(root, text_layer_get_layer(s_title_layer));

  s_status_layer = text_layer_create(GRect(inset, status_y, width, status_h));
  text_layer_set_text(s_status_layer, s_status);
  text_layer_set_font(s_status_layer, status_font);
  text_layer_set_text_alignment(s_status_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_status_layer, GTextOverflowModeWordWrap);
  text_layer_set_background_color(s_status_layer, GColorClear);
  text_layer_set_text_color(s_status_layer, PBL_IF_COLOR_ELSE(GColorChromeYellow, GColorWhite));
  layer_add_child(root, text_layer_get_layer(s_status_layer));

  s_hint_layer = text_layer_create(GRect(inset, hint_y, width, hint_h));
  text_layer_set_text(s_hint_layer, "Press: ping\nHold: stop");
  text_layer_set_font(s_hint_layer, hint_font);
  text_layer_set_text_alignment(s_hint_layer, GTextAlignmentCenter);
  text_layer_set_background_color(s_hint_layer, GColorClear);
  text_layer_set_text_color(s_hint_layer, PBL_IF_COLOR_ELSE(GColorLightGray, GColorWhite));
  layer_add_child(root, text_layer_get_layer(s_hint_layer));
}

static void window_unload(Window *window) {
  text_layer_destroy(s_title_layer);
  text_layer_destroy(s_status_layer);
  text_layer_destroy(s_hint_layer);
  s_title_layer = s_status_layer = s_hint_layer = NULL;
}

/* ---------- App lifecycle ---------- */

static void init(void) {
  app_message_register_inbox_received(inbox_received_handler);
  app_message_register_inbox_dropped(inbox_dropped_handler);
  app_message_register_outbox_failed(outbox_failed_handler);
  app_message_open(256, 64);

  s_window = window_create();
  window_set_click_config_provider(s_window, click_config_provider);
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });
  window_stack_push(s_window, true);

  if (!connection_service_peek_pebble_app_connection()) {
    set_status("Phone not connected");
  }
}

static void deinit(void) {
  window_destroy(s_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
