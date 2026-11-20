#pragma once

// Picks this board's settings: secrets.h (your real values, git-ignored) if it
// exists, otherwise secrets.example.h (committed template, no device key).
// Without secrets.h the sketch still builds, but uploads are rejected (401)
// because API_DEVICE_KEY is empty.

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #warning "secrets.h not found: using secrets.example.h (no device key, uploads will fail). Copy secrets.example.h to secrets.h and fill it in."
  #include "secrets.example.h"
#endif
