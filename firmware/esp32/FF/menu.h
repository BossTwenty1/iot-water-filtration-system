#pragma once

//  MENU & RUN MODE
//
//  Boot:  POST -> load calibration -> MAIN MENU (waits MENU_TIMEOUT_BOOT_MS)
//
//    1 = Run system      normal operation
//    2 = Calibration     final2.3 guided wizard and text export/import
//    3 = Wi-Fi           scan / connect by hand, disconnect, saved network (wifi_menu.h)
//    4 = Device info     identifiers, system and connectivity status (device_info.h)
//
//  No key within the boot timeout -> option 1 starts by itself. If a working pH or
//  turbidity sensor has no calibration, it first waits CAL_PROMPT_MISSING_MS (the copy
//  in flash may be incomplete), then runs anyway so an unattended reboot
//  never hangs forever.
//
//  While running, ESC (or M, for terminals that cannot send ESC such as the
//  Arduino Serial Monitor) brings the menu back.
//
//  Include order in main.ino: AFTER everything it uses (readAllSensors,
//  calibration.h, post.h, wifi_menu.h, device_info.h) and BEFORE setup().

#include <Arduino.h>

constexpr uint32_t MENU_TIMEOUT_BOOT_MS   = 60000;  // auto-run delay at power-up
constexpr uint32_t MENU_TIMEOUT_RETURN_MS = 0;      // after ESC: 0 = wait for a choice forever
constexpr uint32_t MENU_REMINDER_MS       = 15000;  // "starting in N s" reminders

// ---------------- MENU SCREENS ----------------

void showMainMenu(uint32_t timeoutMs)
{
  Serial.println("\n========== MAIN MENU ==========");
  Serial.println("  1 = Run system");
  Serial.println("  2 = Calibration");
  Serial.println("  3 = Wi-Fi (connect manually)");
  Serial.println("  4 = Device info");
  if (timeoutMs > 0)
  {
    Serial.printf("No key in %lu s -> option 1 starts automatically.\n",
                  (unsigned long)(timeoutMs / 1000));
  }
  Serial.println(">>> MAIN MENU READY");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("MAIN MENU");
  lcd.setCursor(0, 1);
  lcd.print("1 Run    2 Calibrate");
  lcd.setCursor(0, 2);
  lcd.print("3 Wi-Fi  4 Info");
}

void showCalibrationMenu()
{
  Serial.println("\n===== CALIBRATION MENU =====");
  Serial.println("  1 = Calibrate missing items (guided)");
  Serial.println("  2 = Recalibrate everything (guided; S skips a step)");
  Serial.println("  3 = Export calibration (to share / keep as a file)");
  Serial.println("  4 = Import calibration (from a saved file)");
  Serial.println("  0 or ESC = Back");
  Serial.println(">>> CALIBRATION MENU READY");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CALIBRATION MENU");
  lcd.setCursor(0, 1);
  lcd.print("1 Missing  2 Redo");
  lcd.setCursor(0, 2);
  lcd.print("3 Export  4 Import");
  lcd.setCursor(0, 3);
  lcd.print("0/ESC Back");
}

// ---------------- CALIBRATION SUBMENU ----------------

void calibrationMenu()
{
  showCalibrationMenu();

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

    if (k == '1')      runCalibrationWizard(true);
    else if (k == '2') runCalibrationWizard(false);
    else if (k == '3') exportCalibration();
    else if (k == '4') importCalibration();
    else
    {
      Serial.printf("Unknown option '%c'. Press 0-4.\n", (char)k);
      continue;
    }

    showCalibrationMenu();
  }
}

// ---------------- CHECK CALIBRATION BEFORE RUNNING ----------------

// Returns true to go ahead and run, false if the user pressed ESC (back to menu).
bool checkCalibrationBeforeRun()
{
  if (!calibrationMissing()) return true;

  Serial.println("\nNo calibration saved in memory (pH and/or turbidity).");
  Serial.println("  F = load a saved calibration file");
  Serial.println("  C = calibrate now");
  Serial.printf("  ESC = back to menu. Any other key, or waiting %lu s, runs without it.\n",
                (unsigned long)(CAL_PROMPT_MISSING_MS / 1000));
  Serial.println(">>> CALIBRATION CHECK");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("NO CALIBRATION");
  lcd.setCursor(0, 1);
  lcd.print("F = load file");
  lcd.setCursor(0, 2);
  lcd.print("C = calibrate now");
  lcd.setCursor(0, 3);
  lcd.print("else: run anyway");

  uint32_t start = millis();
  while (millis() - start < CAL_PROMPT_MISSING_MS)
  {
    int k = pollKey();
    if (k < 0 || k == '\r' || k == '\n' || k == ' ')
    {
      delay(10);
      continue;
    }

    if (k == KEY_ESC) return false;
    if (k == 'f' || k == 'F') { importCalibration();       return true; }
    if (k == 'c' || k == 'C') { runCalibrationWizard(true); return true; }
    break;   // any other key: run uncalibrated
  }

  Serial.println("Running without full calibration.");
  return true;
}

// ---------------- START RUNNING ----------------

void startRun()
{
  // Time spent in menus/calibration must not count as flow
  flowClearPulses();
  previousFlowMillis = millis();

  // Force an immediate sensor read, serial print and LCD update
  previousSensorMillis = 0;
  previousSerialMillis = 0;
  previousLCDMillis    = 0;

  Serial.println("\nIoT WATER FILTRATION SYSTEM RUNNING");
  Serial.println("Press ESC (or send M) to return to the menu.");
}

// ---------------- MAIN MENU ----------------

// Blocks until Run is chosen (or the timeout expires).
// timeoutMs = 0 means wait forever.
void enterMenu(uint32_t timeoutMs)
{
  showMainMenu(timeoutMs);
  uint32_t lastActivity = millis();
  uint32_t lastReminder = lastActivity;

  while (true)
  {
    int k = pollKey();

    if (k < 0)
    {
      if (timeoutMs > 0)
      {
        uint32_t now = millis();

        if (now - lastActivity >= timeoutMs)
        {
          Serial.println("\nNo input - starting the system automatically.");
          if (checkCalibrationBeforeRun())
          {
            startRun();
            return;
          }
          showMainMenu(timeoutMs);               // ESC: stay in the menu
          lastActivity = lastReminder = millis();
          continue;
        }

        if (now - lastReminder >= MENU_REMINDER_MS)
        {
          Serial.printf("  ... starting automatically in %lu s\n",
                        (unsigned long)((timeoutMs - (now - lastActivity)) / 1000));
          lastReminder = now;
        }
      }
      delay(10);
      continue;
    }

    if (k == '\r' || k == '\n' || k == ' ') continue;   // stray line endings

    lastActivity = lastReminder = millis();

    if (k == '1')
    {
      if (checkCalibrationBeforeRun())
      {
        startRun();
        return;
      }
      showMainMenu(timeoutMs);
    }
    else if (k == '2')
    {
      calibrationMenu();
      showMainMenu(timeoutMs);
      lastActivity = lastReminder = millis();
    }
    else if (k == '3')
    {
      wifiMenu();
      showMainMenu(timeoutMs);
      lastActivity = lastReminder = millis();
    }
    else if (k == '4')
    {
      deviceInfoScreen();
      showMainMenu(timeoutMs);
      lastActivity = lastReminder = millis();
    }
    else if (k == KEY_ESC)
    {
      showMainMenu(timeoutMs);
    }
    else
    {
      Serial.printf("Unknown option '%c'. Press 1-4.\n", (char)k);
    }
  }
}
