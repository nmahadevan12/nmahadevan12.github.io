---
title: ESP32 / Arduino Builds
channel: ESP32 / Arduino builds
summary: Personal ESP32 and Arduino projects — wireless door alarm, Wi‑Fi home control, light-sensing blinds, and a proximity lamp.
status: completed
areas: [embedded]
start: 2024-01
end: 2025-08
platform: ESP32 · Arduino
featured: false
tags: [ESP32, Arduino]
highlights:
  - Wireless door alarm with reed-switch ESP32 nodes, hub, web log, and Discord alerts
  - Wi‑Fi home control page for blinds and lamps
  - Light-sensing blinds and an ultrasonic proximity lamp
role: Personal projects
repo: https://github.com/nmahadevan12/home-esp-builds
---

## Overview

Outside class and lab work I built a small home stack on ESP32 and Arduino boards: a wireless door alarm, Wi‑Fi control for blinds and lamps, light-sensing blinds, and a proximity lamp.

1. [Door alarm](#door-alarm)
2. [Wi‑Fi home control](#wifi-home-control)
3. [Light-sensing blinds](#light-sensing-blinds)
4. [Proximity lamp](#proximity-lamp)

Source for all of these lives in one repo: <a href="https://github.com/nmahadevan12/home-esp-builds" target="_blank" rel="noopener noreferrer">View all ESP32 / Arduino code</a>.

## Door alarm

An ESP32 on the door uses a reed switch to sense whether the door is open or closed, then sends that to an ESP32 hub. The hub keeps track of each door and whether its sensor is still responding. A web page lists those open/close events over time, and the hub can also push alerts to Discord.

The door ESP32 stays asleep to save power, wakes when the reed switch trips, and sends a short message. It also pings the hub every so often so a dead battery doesn’t go unnoticed.

- <a href="https://github.com/nmahadevan12/home-esp-builds/tree/main/door-alarm" target="_blank" rel="noopener noreferrer">View door alarm code</a>

## Wi‑Fi home control

ESP32 home control for blinds and lamps. A Wi‑Fi page where you can open and close the blinds and turn the lights on and off. Other ESP32 boards on the network run the blinds motors and the lamps.

- <a href="https://github.com/nmahadevan12/home-esp-builds/tree/main/wifi-home-control" target="_blank" rel="noopener noreferrer">View Wi‑Fi home control code</a>

## Light-sensing blinds

Arduino blinds that open and close from room light. A photoresistor watches brightness and drives a DC motor; if it stays bright or dark long enough, the blinds move on their own. A button switches to manual control so you can open or close them yourself.

- <a href="https://github.com/nmahadevan12/home-esp-builds/tree/main/light-sensing-blinds" target="_blank" rel="noopener noreferrer">View light-sensing blinds code</a>

## Proximity lamp

An Arduino lamp that toggles when you wave close to an ultrasonic distance sensor. If something stays about 1–3 inches away, the LED flips on or off (with a short cooldown so it doesn’t chatter). You can also type `on` or `off` over serial for manual control.

- <a href="https://github.com/nmahadevan12/home-esp-builds/tree/main/proximity-lamp" target="_blank" rel="noopener noreferrer">View proximity lamp code</a>
