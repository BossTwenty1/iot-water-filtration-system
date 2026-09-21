#pragma once

// Selects the credentials header. Include from exactly one translation unit
// (main.cpp) so credential strings are not duplicated and the fallback warning
// is printed once.

#if __has_include("secrets.h")
#include "secrets.h"
#define SECRETS_ARE_PLACEHOLDERS 0
#else
#warning "include/secrets.h not found - building with placeholder values from secrets.example.h (Wi-Fi disabled). Copy secrets.example.h to secrets.h and fill it in."
#include "secrets.example.h"
#define SECRETS_ARE_PLACEHOLDERS 1
#endif
