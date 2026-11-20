#pragma once
// PC stand-in for the ESP32 Arduino core: just enough for the firmware files
// api_client.cpp, net_config.h, secrets_select.h and telemetry.h to compile
// and run unchanged on Linux. Nothing here talks to hardware.

#include <chrono>
#include <cmath>
#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <random>
#include <string>
#include <thread>

using std::isfinite;

// ---------- String (Arduino) ----------
class String {
 public:
  String() = default;
  String(const char *s) : s_(s ? s : "") {}
  String(const std::string &s) : s_(s) {}
  size_t length() const { return s_.size(); }
  const char *c_str() const { return s_.c_str(); }
 private:
  std::string s_;
};

// ---------- Serial ----------
struct PcSerial {
  void begin(unsigned long) {}
  int printf(const char *fmt, ...) __attribute__((format(printf, 2, 3))) {
    va_list ap; va_start(ap, fmt); int n = std::vprintf(fmt, ap); va_end(ap); std::fflush(stdout); return n;
  }
  void print(const char *s) { std::fputs(s, stdout); std::fflush(stdout); }
  void println(const char *s = "") { std::puts(s); std::fflush(stdout); }
};
inline PcSerial Serial;
#define F(s) (s)

// ---------- time / random ----------
inline uint32_t millis() {
  using namespace std::chrono;
  static const auto start = steady_clock::now();
  return (uint32_t)duration_cast<milliseconds>(steady_clock::now() - start).count();
}
inline void delay(uint32_t ms) { std::this_thread::sleep_for(std::chrono::milliseconds(ms)); }
inline std::mt19937 &pcRng() { static std::mt19937 r{std::random_device{}()}; return r; }
inline long random(long lo, long hi) { return std::uniform_int_distribution<long>(lo, hi - 1)(pcRng()); }
inline void randomSeed(unsigned long) {}

// ---------- ESP object (diagnostics only, printed by api_client.cpp on errors) ----------
struct PcEsp {
  uint32_t getFreeHeap() { return 0; }
  uint32_t getMaxAllocHeap() { return 0; }
  uint32_t getMinFreeHeap() { return 0; }
  uint64_t getEfuseMac() { return 0; }
};
inline PcEsp ESP;

// ---------- FreeRTOS bits referenced by telemetry.h (its task is not used on PC) ----------
typedef int portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(x) (void)(x)
#define portEXIT_CRITICAL(x) (void)(x)
#define pdMS_TO_TICKS(x) (x)
#define pdPASS 1
inline void vTaskDelay(uint32_t ms) { delay(ms); }
inline int xTaskCreatePinnedToCore(void (*)(void *), const char *, int, void *, int, void *, int) { return pdPASS; }
