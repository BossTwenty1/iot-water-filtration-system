#pragma once
// PC stand-in for the ESP32 HTTPClient used by firmware api_client.cpp.
// Same method names and return codes (HTTP status, or a negative error);
// the request itself is made with the `curl` command, verifying TLS against
// the root CA given to WiFiClientSecure::setCACert() and nothing else.
#include <unistd.h>
#include <vector>
#include "Arduino.h"
#include "WiFiClientSecure.h"

#define HTTPC_ERROR_CONNECTION_REFUSED (-1)
#define HTTPC_ERROR_READ_TIMEOUT (-11)

class HTTPClient {
 public:
  void setConnectTimeout(int32_t ms) { connectMs_ = ms; }
  void setTimeout(uint16_t ms) { timeoutMs_ = ms; }
  void setReuse(bool) {}
  bool begin(WiFiClientSecure &client, const char *url) {
    url_ = url ? url : "";
    ca_ = client.caPem();
    headers_.clear();
    return url_.rfind("https://", 0) == 0;
  }
  void addHeader(const char *name, const char *value) { headers_.push_back(std::string(name) + ": " + value); }
  int POST(uint8_t *payload, size_t size) { return send("POST", std::string((const char *)payload, size)); }
  int GET() { return send("GET", ""); }
  String getString() { return String(body_); }
  void end() {}
  static String errorToString(int code) {
    return String(code == HTTPC_ERROR_READ_TIMEOUT ? "read Timeout" : "connection refused / failed");
  }

 private:
  static std::string tempFile(const char *tag, const std::string &content) {
    std::string path = std::string("/tmp/pcsim_") + tag + "_XXXXXX";
    std::vector<char> buf(path.begin(), path.end());
    buf.push_back('\0');
    int fd = mkstemp(buf.data());
    if (fd < 0) return "";
    (void)!write(fd, content.data(), content.size());
    close(fd);
    return buf.data();
  }
  static std::string quote(const std::string &s) {   // single-quote for the shell
    std::string q = "'";
    for (char c : s) q += (c == '\'') ? std::string("'\\''") : std::string(1, c);
    return q + "'";
  }

  int send(const char *method, const std::string &body) {
    body_.clear();
    std::string caFile = tempFile("ca", ca_);
    std::string bodyFile = body.empty() ? "" : tempFile("body", body);
    std::string cmd = "curl -s -X " + std::string(method) + " " + quote(url_) +
                      " --cacert " + quote(caFile) + " --capath /nonexistent" +
                      " --connect-timeout " + std::to_string(connectMs_ / 1000 + 1) +
                      " -m " + std::to_string((connectMs_ + timeoutMs_) / 1000 + 1);
    for (const auto &h : headers_) cmd += " -H " + quote(h);
    if (!bodyFile.empty()) cmd += " --data-binary @" + quote(bodyFile);
    cmd += " -w '\\n%{http_code}' 2>/dev/null";

    std::string out;
    if (FILE *p = popen(cmd.c_str(), "r")) {
      char chunk[1024];
      size_t n;
      while ((n = fread(chunk, 1, sizeof chunk, p)) > 0) out.append(chunk, n);
      pclose(p);
    }
    unlink(caFile.c_str());
    if (!bodyFile.empty()) unlink(bodyFile.c_str());

    size_t nl = out.find_last_of('\n');
    int code = nl == std::string::npos ? 0 : std::atoi(out.c_str() + nl + 1);
    if (code <= 0) return HTTPC_ERROR_CONNECTION_REFUSED;   // TLS / DNS / timeout, like the board's negative codes
    body_ = out.substr(0, nl);
    return code;
  }

  std::string url_, ca_, body_;
  std::vector<std::string> headers_;
  int32_t connectMs_ = 5000;
  uint16_t timeoutMs_ = 5000;
};
