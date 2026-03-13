# SignalRGB Home Assistant Bridge

![Coded with Gemini](https://img.shields.io/badge/Coded_with-Gemini-8e75ff?style=for-the-badge&logo=googlegemini&logoColor=white)

A powerful, custom plugin for [SignalRGB](https://signalrgb.com/) that bridges your [Home Assistant](https://www.home-assistant.io/) smart home ecosystem directly into your SignalRGB canvas. 

This plugin dynamically fetches your Home Assistant lights, automatically groups them by Area, and allows you to seamlessly sync your smart bulbs, LED strips, and other HA-integrated lights with your PC's RGB setup.

## ✨ Features
* **mDNS Auto-Discovery:** Automatically detects Home Assistant instances on your local network.
* **Dynamic Entity Fetching:** No need to type entity IDs manually. The plugin natively fetches all compatible lights and displays them in a clean QML interface.
* **Area Grouping:** Automatically categorizes your lights based on their assigned Home Assistant "Areas" (Rooms).
* **Per-Entity FPS Control:** Assign independent update rates (FPS) to every single light to prevent overloading your smart home network.
* **Smart Filtering:** Built-in toggles to automatically hide Light Groups to keep your interface clean.
* **Full Canvas Support:** Extracts brightness and RGB intents directly from SignalRGB's canvas and translates them into native Home Assistant API calls.

## 📋 Prerequisites
1. **SignalRGB** installed and running on your PC.
2. A running **Home Assistant** server on the same local network.
3. A **Long-Lived Access Token** generated from your Home Assistant profile.

## 🚀 Installation

1. Open your terminal or command prompt.
2. Navigate to your SignalRGB plugins folder, typically located at:
   `cd Documents\WhirlwindFX\Plugins\`
3. Clone this repository directly into the folder:
   `git clone https://github.com/Luk-Krn/signalrgb-homeassistant-plugin.git`
4. Completely **Quit and Restart SignalRGB** (Right-click the icon in the system tray -> Quit).

## 🔑 Getting Your Home Assistant Token
To allow SignalRGB to communicate with your Home Assistant server, you must provide a Long-Lived Access Token:
1. Open your Home Assistant web dashboard.
2. Click on your **User Profile** in the bottom left corner.
3. Go to the **Security** tab.
4. Scroll down to **Long-Lived Access Tokens** and click **Create Token**.
5. Name it something memorable (e.g., "SignalRGB") and copy the massive text string it gives you. *Keep this safe!*

## ⚙️ Configuration in SignalRGB

1. Open **SignalRGB** and navigate to the **Devices** tab, then find the **Network** section.
2. You should see the **Home Assistant Bridge** listed. Click the gear icon to open its settings.
3. **Connecting:**
   * **If Auto-Discovered:** If your network supports mDNS, your bridge will appear automatically with a yellow **Authenticate** button. Paste your Token into the top box and click Authenticate.
   * **If Manual:** Type your Home Assistant URL (e.g., `http://192.168.1.100:8123`) and paste your Token into the top boxes, then click **Connect**.
4. **Select Your Lights:** Once connected, a list of your Home Assistant lights will populate, sorted by Area. 
   * Check the boxes next to the lights you want to sync.
   * Adjust the **FPS** text box for each light (Default is `5`).
   * *Tip: Use the "Hide Light Groups" checkbox to clean up your list.*
5. Click **Save Selections & Link**.
6. Go to your **Layouts** page in SignalRGB. Your Home Assistant lights will now be sitting on the canvas ready to be positioned!

## 🛑 Troubleshooting / Known Issues
* **I don't see my lights in the list:** Ensure your lights support RGB, RGBW, HS, XY, Brightness, or Color Temperature modes. The plugin automatically filters out switches and non-dimmable basic relays.
* **The plugin created a "Ghost" bridge:** If a `.local` network discovery fails, you can easily remove it by clicking the "Forget" button next to it. 
* **Settings aren't saving:** Make sure you click "Save Selections & Link" after making any changes to your checkboxes or FPS limits. If the UI glitches, simply restart SignalRGB to flush the cache.