#include <pebble.h>

static Window *s_window;
static TextLayer *s_title_layer;
static TextLayer *s_status_layer;
static ActionBarLayer *s_action_bar;
static GBitmap *s_icon_up;     /* swap service */
static GBitmap *s_icon_play;   /* ping */
static GBitmap *s_icon_stop;   /* stop */

/* Ping-on-launch only applies when the app was opened with Quick Launch,
 * not from the app menu or when the phone opens it after an install. */
static bool s_launch_ping_pending = false;

/* Status layout, kept so the text can be re-centred whenever it changes. */
static GFont s_status_font;
static int16_t s_status_left, s_status_width, s_status_min_y, s_screen_h;

static char s_status[64] = "Press to Ping";
static char s_service[24] = "Find Phone";

/* ---------- Ping animation (Pebble Draw Command sequence) ----------
 * A phone that shakes while sonar waves ripple out. It plays while the
 * phone is ringing and shows a still phone otherwise. Aplite has too little
 * memory for draw commands, so it goes without. */
#if !defined(PBL_PLATFORM_APLITE)
#define HAVE_PING_ANIM 1
#endif

#define ANIM_MAX_MS (60 * 1000)   /* stop animating after a minute to save battery */
#define ANIM_GAP 2                /* pixels between animation and status text */

static Layer *s_anim_layer;
#ifdef HAVE_PING_ANIM
static GDrawCommandSequence *s_anim_seq;
static AppTimer *s_anim_timer;
static AppTimer *s_anim_stop_timer;
static int s_anim_frame;
static bool s_anim_running;

/* The last frame is the still phone (no waves, no shake). */
static int anim_idle_frame(void) {
  return (int)gdraw_command_sequence_get_num_frames(s_anim_seq) - 1;
}

static void anim_update_proc(Layer *layer, GContext *ctx) {
  if (!s_anim_seq) { return; }
  GDrawCommandFrame *frame = gdraw_command_sequence_get_frame_by_index(s_anim_seq, s_anim_frame);
  if (frame) {
    GRect b = layer_get_bounds(layer);
    GSize size = gdraw_command_sequence_get_bounds_size(s_anim_seq);
    gdraw_command_frame_draw(ctx, s_anim_seq, frame,
                             GPoint((b.size.w - size.w) / 2, (b.size.h - size.h) / 2));
  }
}

static void anim_step(void *context) {
  s_anim_timer = NULL;
  if (!s_anim_running || !s_anim_seq) { return; }
  int frames = (int)gdraw_command_sequence_get_num_frames(s_anim_seq);
  s_anim_frame = (s_anim_frame + 1) % frames;
  layer_mark_dirty(s_anim_layer);
  GDrawCommandFrame *frame = gdraw_command_sequence_get_frame_by_index(s_anim_seq, s_anim_frame);
  uint32_t ms = frame ? gdraw_command_frame_get_duration(frame) : 90;
  s_anim_timer = app_timer_register(ms ? ms : 90, anim_step, NULL);
}

static void anim_stop(void) {
  s_anim_running = false;
  if (s_anim_timer) { app_timer_cancel(s_anim_timer); s_anim_timer = NULL; }
  if (s_anim_stop_timer) { app_timer_cancel(s_anim_stop_timer); s_anim_stop_timer = NULL; }
  if (s_anim_seq) {
    s_anim_frame = anim_idle_frame();
    if (s_anim_layer) { layer_mark_dirty(s_anim_layer); }
  }
}

static void anim_timeout(void *context) {
  s_anim_stop_timer = NULL;
  anim_stop();
}

static void anim_start(void) {
  if (!s_anim_seq) { return; }
  if (s_anim_stop_timer) { app_timer_cancel(s_anim_stop_timer); }
  s_anim_stop_timer = app_timer_register(ANIM_MAX_MS, anim_timeout, NULL);
  if (s_anim_running) { return; }
  s_anim_running = true;
  s_anim_frame = 0;
  layer_mark_dirty(s_anim_layer);
  s_anim_timer = app_timer_register(90, anim_step, NULL);
}
#else
static void anim_start(void) {}
static void anim_stop(void) {}
#endif

/* Measures the status text and centres the animation + status text together
 * vertically on the screen (never overlapping the title). If both don't fit
 * (e.g. a two-line message on a round watch), the animation is hidden. */
static void centre_status(void) {
  if (!s_status_layer) { return; }
  const int16_t max_h = s_screen_h - s_status_min_y;
  GSize size = graphics_text_layout_get_content_size(
      s_status, s_status_font, GRect(0, 0, s_status_width, max_h),
      GTextOverflowModeWordWrap, GTextAlignmentCenter);
  /* Gothic fonts sit a few pixels low in their box; nudge up to look centred. */
  const int16_t text_h = size.h + 6;

  int16_t anim_h = 0;
#ifdef HAVE_PING_ANIM
  if (s_anim_seq) {
    anim_h = gdraw_command_sequence_get_bounds_size(s_anim_seq).h;
  }
#endif
  const int16_t bottom_margin = PBL_IF_ROUND_ELSE(s_screen_h / 10, 2);
  bool show_anim = anim_h > 0 &&
      (anim_h + ANIM_GAP + text_h) <= (s_screen_h - s_status_min_y - bottom_margin);
  const int16_t total = show_anim ? anim_h + ANIM_GAP + text_h : text_h;

  int16_t y = (s_screen_h - total) / 2;
  if (y < s_status_min_y) { y = s_status_min_y; }

  if (s_anim_layer) {
    layer_set_hidden(s_anim_layer, !show_anim);
    if (show_anim) {
      layer_set_frame(s_anim_layer, GRect(s_status_left, y, s_status_width, anim_h));
      y += anim_h + ANIM_GAP;
    }
  }
  layer_set_frame(text_layer_get_layer(s_status_layer),
                  GRect(s_status_left, y, s_status_width, text_h));
}

static void set_status(const char *text) {
  strncpy(s_status, text, sizeof(s_status) - 1);
  s_status[sizeof(s_status) - 1] = '\0';
  if (s_status_layer) {
    text_layer_set_text(s_status_layer, s_status);
    centre_status();
  }
}

static void set_service(const char *text) {
  strncpy(s_service, text, sizeof(s_service) - 1);
  s_service[sizeof(s_service) - 1] = '\0';
  if (s_title_layer) {
    text_layer_set_text(s_title_layer, s_service);
  }
}

/* Returns true if the message was handed to the phone. */
static bool send_command(uint32_t key, const char *pending_text) {
  if (!connection_service_peek_pebble_app_connection()) {
    set_status("Phone not connected");
    vibes_double_pulse();
    return false;
  }

  DictionaryIterator *iter;
  AppMessageResult result = app_message_outbox_begin(&iter);
  if (result != APP_MSG_OK) {
    set_status("Busy, try again");
    return false;
  }

  dict_write_uint8(iter, key, 1);
  result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    set_status("Send failed");
    return false;
  }

  if (pending_text) {
    set_status(pending_text);
  }
  return true;
}

/* ---------- Buttons ---------- */

static void ping_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (send_command(MESSAGE_KEY_Ping, "Pinging...")) {
    anim_start();
  }
}

static void cancel_click_handler(ClickRecognizerRef recognizer, void *context) {
  anim_stop();
  send_command(MESSAGE_KEY_Cancel, "Stopping...");
}

static void switch_click_handler(ClickRecognizerRef recognizer, void *context) {
  anim_stop();
  send_command(MESSAGE_KEY_Switch, "Switching...");
}

static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, switch_click_handler);     /* swap service */
  window_single_click_subscribe(BUTTON_ID_SELECT, ping_click_handler);   /* ping */
  window_single_click_subscribe(BUTTON_ID_DOWN, cancel_click_handler);   /* stop */
}

/* ---------- AppMessage ---------- */

static void inbox_received_handler(DictionaryIterator *iter, void *context) {
  Tuple *status_t = dict_find(iter, MESSAGE_KEY_Status);
  if (status_t && status_t->type == TUPLE_CSTRING) {
    set_status(status_t->value->cstring);
  }

  Tuple *service_t = dict_find(iter, MESSAGE_KEY_Service);
  if (service_t && service_t->type == TUPLE_CSTRING) {
    set_service(service_t->value->cstring);
  }

  Tuple *result_t = dict_find(iter, MESSAGE_KEY_Result);
  if (result_t) {
    if (result_t->value->int32 == 1) {
      vibes_short_pulse();
    } else {
      vibes_double_pulse();
      anim_stop();                       /* something went wrong */
    }
  }

  /* The phone says whether it's ringing (e.g. after a Quick Launch ping). */
  Tuple *ringing_t = dict_find(iter, MESSAGE_KEY_Ringing);
  if (ringing_t) {
    if (ringing_t->value->int32) { anim_start(); } else { anim_stop(); }
  }

  /* The first message from the phone means its JS is ready; now tell it we
   * were opened with Quick Launch, so it can apply the "ping on launch" setting. */
  if (s_launch_ping_pending) {
    s_launch_ping_pending = false;
    send_command(MESSAGE_KEY_Launch, NULL);
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
  anim_stop();
}

/* ---------- Window ---------- */

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);

  window_set_background_color(window, PBL_IF_COLOR_ELSE(GColorOxfordBlue, GColorBlack));

  /* ---- Action bar: UP = swap service, SELECT = ping, DOWN = stop ----
   * Icons come from resources sized per platform (see package.json):
   * small set for 144px-wide and Round 1 watches, large set for
   * Pebble Time 2 (emery) and Round 2 (gabbro). */
  s_icon_up   = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ACTION_UP);
  s_icon_play = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ACTION_PLAY);
  s_icon_stop = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ACTION_STOP);

  s_action_bar = action_bar_layer_create();
  action_bar_layer_set_background_color(s_action_bar, GColorBlack);
  action_bar_layer_set_icon(s_action_bar, BUTTON_ID_UP, s_icon_up);
  action_bar_layer_set_icon(s_action_bar, BUTTON_ID_SELECT, s_icon_play);
  action_bar_layer_set_icon(s_action_bar, BUTTON_ID_DOWN, s_icon_stop);
  action_bar_layer_set_click_config_provider(s_action_bar, click_config_provider);
  action_bar_layer_add_to_window(s_action_bar, window);

  /* ---- Text area: everything left of the action bar ---- */
  const int16_t bar_w   = ACTION_BAR_WIDTH;
  const int16_t left    = PBL_IF_ROUND_ELSE(bar_w / 2 + 6, 4);
  const int16_t width   = bounds.size.w - bar_w - left - PBL_IF_ROUND_ELSE(4, 4);
  const int16_t title_h = 34;
  const int16_t title_y = PBL_IF_ROUND_ELSE(bounds.size.h / 5, 4);
  const int16_t status_y = title_y + title_h;
  const int16_t status_h = bounds.size.h - status_y - PBL_IF_ROUND_ELSE(bounds.size.h / 5, 4);

  GFont title_font  = fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD);
  GFont status_font = fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD);

  s_title_layer = text_layer_create(GRect(left, title_y, width, title_h));
  text_layer_set_text(s_title_layer, s_service);
  text_layer_set_font(s_title_layer, title_font);
  text_layer_set_text_alignment(s_title_layer, GTextAlignmentCenter);
  text_layer_set_background_color(s_title_layer, GColorClear);
  text_layer_set_text_color(s_title_layer, GColorWhite);
  layer_add_child(root, text_layer_get_layer(s_title_layer));

  s_status_font  = status_font;
  s_status_left  = left;
  s_status_width = width;
  s_status_min_y = status_y;
  s_screen_h     = bounds.size.h;

  /* ---- Ping animation, centred with the status text in centre_status() ---- */
  s_anim_layer = layer_create(GRect(left, status_y, width, 0));
#ifdef HAVE_PING_ANIM
  s_anim_seq = gdraw_command_sequence_create_with_resource(RESOURCE_ID_PING_ANIM);
  if (s_anim_seq) { s_anim_frame = anim_idle_frame(); }
  layer_set_update_proc(s_anim_layer, anim_update_proc);
#endif
  layer_add_child(root, s_anim_layer);

  s_status_layer = text_layer_create(GRect(left, status_y, width, status_h));
  text_layer_set_text(s_status_layer, s_status);
  text_layer_set_font(s_status_layer, status_font);
  text_layer_set_text_alignment(s_status_layer, GTextAlignmentCenter);
  text_layer_set_overflow_mode(s_status_layer, GTextOverflowModeWordWrap);
  text_layer_set_background_color(s_status_layer, GColorClear);
  text_layer_set_text_color(s_status_layer, PBL_IF_COLOR_ELSE(GColorChromeYellow, GColorWhite));
  layer_add_child(root, text_layer_get_layer(s_status_layer));
  centre_status();
}

static void window_unload(Window *window) {
  anim_stop();
#ifdef HAVE_PING_ANIM
  if (s_anim_seq) { gdraw_command_sequence_destroy(s_anim_seq); s_anim_seq = NULL; }
#endif
  layer_destroy(s_anim_layer);
  s_anim_layer = NULL;

  text_layer_destroy(s_title_layer);
  text_layer_destroy(s_status_layer);
  s_title_layer = s_status_layer = NULL;

  action_bar_layer_destroy(s_action_bar);
  s_action_bar = NULL;
  gbitmap_destroy(s_icon_up);
  gbitmap_destroy(s_icon_play);
  gbitmap_destroy(s_icon_stop);
  s_icon_up = s_icon_play = s_icon_stop = NULL;
}

/* ---------- App lifecycle ---------- */

static void init(void) {
  AppLaunchReason reason = launch_reason();
  s_launch_ping_pending = (reason == APP_LAUNCH_QUICK_LAUNCH);

  app_message_register_inbox_received(inbox_received_handler);
  app_message_register_inbox_dropped(inbox_dropped_handler);
  app_message_register_outbox_failed(outbox_failed_handler);
  app_message_open(256, 64);

  s_window = window_create();
  /* Buttons are handled by the action bar (set up in window_load). */
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
