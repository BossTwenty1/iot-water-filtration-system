#pragma once

//  Wi-Fi MENU  (main menu -> 3)
//
//    1 = Scan and connect         pick a network from the list (or type its name), enter the password
//    2 = Connect by typing name   for hidden networks
//    3 = Disconnect               Wi-Fi off until you connect again
//    4 = Forget saved network     go back to the network in secrets.h
//
//  After a successful connection you can SAVE the network. A saved network is used
//  at every boot instead of the one in secrets.h (stored in flash, not encrypted).
//
//  Include order in main.ino: AFTER calibration.h (uses calReadLine) and BEFORE
//  device_info.h and menu.h.

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <string.h>
#include "net_config.h"

// ---------------- STATE ----------------

// true once the Wi-Fi start-up decision has been made (by startNetwork() or by this menu).
// Stops startNetwork() from overriding a connection the user chose by hand.
bool gWifiInitDone = false;

// Where the credentials in use came from (shown on the Device Info screen).
const char *gWifiSource = "secrets.h";

constexpr char kWifiPrefsNamespace[] = "wifi";

// ---------------- SAVED NETWORK (flash) ----------------

bool wifiLoadSaved(char *ssid, size_t ssidCap, char *pass, size_t passCap)
{
  Preferences p;
  if (!p.begin(kWifiPrefsNamespace, false)) return false;
  String s  = p.getString("ssid", "");
  String pw = p.getString("pass", "");
  p.end();

  if (s.length() == 0 || s.length() >= ssidCap || pw.length() >= passCap) return false;
  strlcpy(ssid, s.c_str(), ssidCap);
  strlcpy(pass, pw.c_str(), passCap);
  return true;
}

bool wifiSaveCredentials(const char *ssid, const char *pass)
{
  Preferences p;
  if (!p.begin(kWifiPrefsNamespace, false)) return false;
  bool ok = p.putString("ssid", ssid) > 0;
  p.putString("pass", pass);   // an open network has an empty password
  p.end();
  return ok;
}

void wifiForgetSaved()
{
  Preferences p;
  if (p.begin(kWifiPrefsNamespace, false)) { p.clear(); p.end(); }
}

// Called once from startNetwork(): saved network first, secrets.h otherwise.
void wifiInitialStart()
{
  if (gWifiInitDone) return;
  gWifiInitDone = true;

  char ssid[33], pass[65];
  if (wifiLoadSaved(ssid, sizeof ssid, pass, sizeof pass))
  {
    Serial.printf("[wifi] using the saved network \"%s\"\n", ssid);
    gWifiSource = "saved (Wi-Fi menu)";
    gWifi.connectTo(ssid, pass);
  }
  else
  {
    gWifi.begin(WIFI_SSID, WIFI_PASSWORD, millis());
  }
}

// ---------------- HELPERS ----------------

// Waits for the result of an attempt that is already running.
// 1 = connected, 0 = attempt failed, -1 = cancelled with ESC.
// Wi-Fi itself is driven by pollKey() -> networkService() -> gWifi.loop().
int wifiWaitForResult(const char *ssid)
{
  const uint32_t start = millis();
  const uint32_t limit = config::kWifiConnectTimeoutMs + 3000;

  while (millis() - start < limit)
  {
    int k = pollKey();
    if (k == KEY_ESC) return -1;

    // Compare the SSID too: right after a switch the driver may still report the old network.
    if (gWifi.isConnected() && WiFi.SSID() == ssid) return 1;
    if (gWifi.state() == WifiManager::State::kWaitingToRetry) return 0;   // attempt timed out
    delay(20);
  }
  return 0;
}

bool wifiAskYesNo(const char *question)
{
  Serial.printf("%s (y/n): \n", question);
  const uint32_t start = millis();
  while (millis() - start < 30000)
  {
    int k = pollKey();
    if (k == 'y' || k == 'Y') return true;
    if (k == 'n' || k == 'N' || k == KEY_ESC) return false;
    delay(10);
  }
  return false;
}

// Connects, waits and reports. Returns true when connected.
bool wifiConnectAndReport(const char *ssid, const char *pass)
{
  gWifiInitDone = true;   // the user has decided: startNetwork() must not override this

  Serial.printf("Connecting to \"%s\" ... (ESC cancels)\n", ssid);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting...");
  lcd.setCursor(0, 1);
  char line[21];
  snprintf(line, sizeof line, "%s", ssid);
  lcd.print(line);

  gWifi.connectTo(ssid, pass);
  const int result = wifiWaitForResult(ssid);

  if (result == 1)
  {
    Serial.printf("Connected. IP %s, signal %d dBm.\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    Serial.println("(Time sync and uploads continue automatically once Run is chosen.)");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Wi-Fi CONNECTED");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString().c_str());
    delay(1500);
    return true;
  }

  gWifi.stop();
  Serial.println(result < 0 ? "Cancelled. Wi-Fi is off."
                            : "Could not connect. Check the name and password, and that the network is 2.4 GHz.");
  Serial.println("Wi-Fi is off. Try again, or use option 4 to go back to secrets.h.");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(result < 0 ? "CANCELLED" : "CONNECT FAILED");
  delay(1500);
  return false;
}

// Scans, prints a numbered list, and lets the user pick a number or type a name.
// Returns false if cancelled.
bool wifiPickNetwork(char *ssidOut, size_t cap)
{
  constexpr int MAX_LISTED = 15;
  String names[MAX_LISTED];
  int listed = 0;

  Serial.println("Scanning for networks (a few seconds)...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scanning Wi-Fi...");

  if (WiFi.getMode() == WIFI_OFF) WiFi.mode(WIFI_STA);
  const int found = WiFi.scanNetworks();

  if (found > 0)
  {
    Serial.println("  #  Network                           Signal   Security");
    for (int i = 0; i < found && listed < MAX_LISTED; i++)
    {
      String name = WiFi.SSID(i);
      if (name.length() == 0) continue;                          // hidden network
      bool dup = false;
      for (int j = 0; j < listed; j++) if (names[j] == name) dup = true;
      if (dup) continue;                                         // same network, other access point

      names[listed] = name;
      Serial.printf(" %2d  %-32s  %4d dBm  %s\n", listed + 1, name.c_str(), WiFi.RSSI(i),
                    WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "open" : "secured");
      listed++;
    }
  }
  else
  {
    Serial.println(found == 0 ? "No networks found." : "Scan failed.");
  }
  WiFi.scanDelete();

  Serial.println(listed > 0 ? "Type the number (or the network name) and press Enter. ESC cancels."
                            : "Type the network name and press Enter. ESC cancels.");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Choose network in");
  lcd.setCursor(0, 1);
  lcd.print("the Serial Monitor");

  char input[33];
  if (!calReadLine(input, sizeof input)) return false;

  // All digits and within the list -> a list number
  bool numeric = true;
  for (const char *c = input; *c; c++) if (*c < '0' || *c > '9') numeric = false;
  if (numeric)
  {
    int n = atoi(input);
    if (n >= 1 && n <= listed) { strlcpy(ssidOut, names[n - 1].c_str(), cap); return true; }
  }

  strlcpy(ssidOut, input, cap);
  return true;
}

// ---------------- CONNECT FLOW ----------------

void wifiConnectFlow(bool scan)
{
  char ssid[33] = "";
  char pass[65] = "";

  if (scan)
  {
    if (!wifiPickNetwork(ssid, sizeof ssid)) { Serial.println("Cancelled."); return; }
  }
  else
  {
    Serial.println("Network name (SSID), then Enter. ESC cancels:");
    if (!calReadLine(ssid, sizeof ssid)) { Serial.println("Cancelled."); return; }
  }

  Serial.printf("Password for \"%s\" (just Enter if the network is open). ESC cancels:\n", ssid);
  if (!calReadLine(pass, sizeof pass, true)) { Serial.println("Cancelled."); return; }

  if (pass[0] != '\0' && strlen(pass) < 8)
  {
    Serial.println("A Wi-Fi password has 8-63 characters. Nothing was changed.");
    return;
  }

  if (!wifiConnectAndReport(ssid, pass)) return;

  gWifiSource = "manual (this session)";
  if (wifiAskYesNo("Save this network so the device uses it at every boot?"))
  {
    if (wifiSaveCredentials(ssid, pass))
    {
      gWifiSource = "saved (Wi-Fi menu)";
      Serial.println("Saved. It replaces the secrets.h network until you use option 4.");
    }
    else
    {
      Serial.println("Could not write to flash - the network is only used until the next reboot.");
    }
  }
  else
  {
    Serial.println("Not saved - it is only used until the next reboot.");
  }
}

// ---------------- MENU ----------------

void showWifiMenu()
{
  Serial.println("\n========== Wi-Fi MENU ==========");
  Serial.printf("Status: %s", WifiManager::stateName(gWifi.state()));
  if (gWifi.isConnected())
  {
    Serial.printf(" to \"%s\", IP %s, %d dBm", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
  }
  Serial.println();
  Serial.println("  1 = Scan and connect");
  Serial.println("  2 = Connect by typing the network name (hidden networks)");
  Serial.println("  3 = Disconnect (Wi-Fi off)");
  Serial.println("  4 = Forget the saved network and use secrets.h");
  Serial.println("  0 or ESC = Back");
  Serial.println(">>> WIFI MENU READY");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Wi-Fi MENU");
  lcd.setCursor(0, 1);
  lcd.print("1Scan 2Type 3Off");
  lcd.setCursor(0, 2);
  lcd.print("4 Use secrets.h");
  lcd.setCursor(0, 3);
  lcd.print("0/ESC Back");
}

void wifiMenu()
{
  showWifiMenu();

  while (true)
  {
    int k = pollKey();
    if (k < 0 || k == '\r' || k == '\n' || k == ' ')
    {
      delay(10);
      continue;
    }

    if (k == '0' || k == KEY_ESC)
    {
      Serial.println("Back to the main menu.");
      return;
    }

    if (k == '1')      wifiConnectFlow(true);
    else if (k == '2') wifiConnectFlow(false);
    else if (k == '3')
    {
      gWifiInitDone = true;   // an explicit "off" must survive pressing Run
      gWifi.stop();
      Serial.println("Wi-Fi is off. Uploads and time sync pause until you connect again.");
    }
    else if (k == '4')
    {
      wifiForgetSaved();
      gWifiSource = "secrets.h";
      if (WIFI_SSID[0] == '\0')
      {
        gWifiInitDone = true;
        gWifi.stop();
        Serial.println("Saved network forgotten. secrets.h has no SSID, so Wi-Fi stays off.");
      }
      else
      {
        Serial.println("Saved network forgotten. Connecting with the secrets.h network.");
        wifiConnectAndReport(WIFI_SSID, WIFI_PASSWORD);
      }
    }
    else
    {
      Serial.printf("Unknown option '%c'. Press 0-4.\n", (char)k);
      continue;
    }

    showWifiMenu();
  }
}
