#define main gptokeyb_program_main
#include "gptokeyb.cpp"
#undef main
#include <cassert>

static void button(Uint8 key, bool pressed) {
  SDL_Event event{};
  event.type = pressed ? SDL_CONTROLLERBUTTONDOWN : SDL_CONTROLLERBUTTONUP;
  event.cbutton.button = key;
  assert(handleEvent(event));
}

int main() {
  assert(!config.dpad_as_mouse);
  config.dpad_as_mouse = true;
  config.fake_mouse_scale = 8192;
  button(SDL_CONTROLLER_BUTTON_DPAD_RIGHT, true);
  assert(state.mouseX > 0 && state.mouseY == 0);
  button(SDL_CONTROLLER_BUTTON_DPAD_UP, true);
  assert(state.mouseX > 0 && state.mouseY < 0);
  button(SDL_CONTROLLER_BUTTON_DPAD_LEFT, true);
  assert(state.mouseX == 0);
  button(SDL_CONTROLLER_BUTTON_DPAD_RIGHT, false);
  assert(state.mouseX < 0);
  button(SDL_CONTROLLER_BUTTON_DPAD_LEFT, false);
  button(SDL_CONTROLLER_BUTTON_DPAD_UP, false);
  assert(state.mouseX == 0 && state.mouseY == 0 && state.dpad_mouse_buttons == 0);
  config.fake_mouse_scale = 0;
  button(SDL_CONTROLLER_BUTTON_DPAD_DOWN, true);
  assert(state.mouseY > 0);
  button(SDL_CONTROLLER_BUTTON_DPAD_DOWN, false);
  assert(state.mouseX == 0 && state.mouseY == 0);
}
