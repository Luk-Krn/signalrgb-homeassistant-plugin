export function Name() { return "Home Assistant Bridge"; }
export function Version() { return "1.2.0"; }
export function Type() { return "network"; }
export function Publisher() { return "SignalRGB Community"; }
export function Documentation() { return "gettingstarted/udp-device"; }
export function Size() { return [10, 10]; }
export function DefaultPosition() { return [0, 0]; }
export function DefaultScale() { return 1.0; }
export function SubdeviceController() { return true; }

/* global
controller:readonly
discovery:readonly
service:readonly
device:readonly
LightingMode:readonly
forcedColor:readonly
FPSLimit:readonly
filterWLED:readonly
*/

export function ControllableParameters() {
	return [
		{"property":"filterWLED", "group":"settings", "label":"Filter WLED/Clock", "type":"boolean", "default":true},
		{"property":"LightingMode", "group":"settings", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"settings", "label":"Forced Color", "type":"color", "default":"#009bde"},
		{"property":"FPSLimit", "group":"settings", "label":"FPS Limit", "type":"number", "default":5, "min":1, "max":15}
	];
}

// -------------------------------------------<( Device Core Logic )>--------------------------------------------------

let HA_DEVICE;
let lastRenderTime = 0;

class HomeAssistantDevice {
	constructor(controllerData) {
		this.url = controllerData.url ? (controllerData.url.endsWith('/') ? controllerData.url.slice(0, -1) : controllerData.url) : "";
		this.token = controllerData.token || "";
		this.name = controllerData.name || "Home Assistant";
		this.targetEntities = controllerData.entities || "";
		this.lights = [];
	}

	initializeChannels() {
		if (!this.url || !this.token) return;
		device.log("Fetching Home Assistant entities synchronously for channel setup...");
		
		const allowedLights = this.targetEntities ? this.targetEntities.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0) : [];
		// Safe check for filterWLED in case UI properties crash
		const isFilterEnabled = typeof filterWLED !== "undefined" ? filterWLED : true;

		const xhr = new XMLHttpRequest();
		xhr.open("GET", `${this.url}/api/states`, false); 
		xhr.setRequestHeader("Accept", "application/json");
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.setRequestHeader("Authorization", "Bearer " + this.token);
		
		try {
			xhr.send();
			if (xhr.status === 200) {
				const states = JSON.parse(xhr.response);
				this.lights = []; // Clear existing in case of a live reload
				
				states.forEach(state => {
					if (state.entity_id.startsWith("light.")) {
						if (allowedLights.length > 0 && !allowedLights.includes(state.entity_id.toLowerCase())) {
							return;
						}

						const attrs = state.attributes || {};
						const friendlyName = attrs.friendly_name || state.entity_id;
						const colorModes = attrs.supported_color_modes || [];

						if (isFilterEnabled) {
							const nameLower = friendlyName.toLowerCase();
							const idLower = state.entity_id.toLowerCase();
							if (nameLower.includes("wled") || idLower.includes("wled") || 
								nameLower.includes("clock") || idLower.includes("clock")) {
								return; 
							}
						}

						const supportsColor = colorModes.includes("rgb") || colorModes.includes("rgbw") || colorModes.includes("hs") || colorModes.includes("xy");
						const supportsBrightness = colorModes.includes("brightness") || supportsColor;

						if (supportsColor || supportsBrightness) {
							this.lights.push({
								id: state.entity_id,
								name: friendlyName,
								supportsColor: supportsColor,
								supportsBrightness: supportsBrightness,
								lastColor: [-1, -1, -1] 
							});
						}
					}
				});

				// Capital 'S' to prevent crashes
				device.SetLedLimit(this.lights.length);
				this.lights.forEach(light => {
					// Add channel by entity_id, not friendly name, to prevent invalid character crashes
					device.addChannel(light.id, 1);
				});

				device.log(`Successfully mapped ${this.lights.length} HA lights to SignalRGB.`);
			} else {
				device.log("HA API returned status: " + xhr.status);
			}
		} catch (e) {
			device.log("Failed to connect or parse HA response during initialization: " + e);
		}
	}

	updateColors() {
		if (this.lights.length === 0) return;

		// Safe checks for Lighting properties
		const currentMode = typeof LightingMode !== "undefined" ? LightingMode : "Canvas";
		const currentColor = typeof forcedColor !== "undefined" ? forcedColor : "#009bde";

		this.lights.forEach(light => {
			const channel = device.channel(light.id);
			if (!channel) return;

			let RGBData = [];

			if (currentMode === "Forced") {
				RGBData = device.createColorArray(currentColor, 1, "Inline");
			} else if (channel.shouldPulseColors()) {
				const pulseColor = device.getChannelPulseColor(light.id);
				RGBData = device.createColorArray(pulseColor, 1, "Inline");
			} else {
				RGBData = channel.getColors("Inline");
			}

			if (RGBData.length >= 3) {
				const r = RGBData[0];
				const g = RGBData[1];
				const b = RGBData[2];

				if (r !== light.lastColor[0] || g !== light.lastColor[1] || b !== light.lastColor[2]) {
					light.lastColor = [r, g, b];

					const isOff = (r === 0 && g === 0 && b === 0);
					const endpoint = isOff ? "/api/services/light/turn_off" : "/api/services/light/turn_on";
					let payload = { "entity_id": light.id };

					if (!isOff) {
						if (light.supportsColor) {
							payload["rgb_color"] = [r, g, b];
						}
						
						if (light.supportsBrightness) {
							payload["brightness"] = Math.max(r, g, b); 
						}
					}

					XmlHttp.Post(`${this.url}${endpoint}`, this.token, payload, null, true);
				}
			}
		});
	}

	shutdown() {
		if (this.lights.length === 0) return;
		this.lights.forEach(light => {
			let payload = { "entity_id": light.id };
			XmlHttp.Post(`${this.url}/api/services/light/turn_off`, this.token, payload, null, false);
		});
	}
}

export function Initialize() {
	device.setName(controller.name);
	HA_DEVICE = new HomeAssistantDevice(controller);
	HA_DEVICE.initializeChannels();
}

export function Render() {
	// Safely check if FPSLimit exists, default to 5 if it doesn't
	const safeFPS = typeof FPSLimit !== "undefined" ? FPSLimit : 5;
	const frameDelay = 1000 / safeFPS;
	const now = Date.now();
	
	if (now - lastRenderTime >= frameDelay) {
		lastRenderTime = now;
		if (HA_DEVICE) {
			HA_DEVICE.updateColors();
		}
	}
}

export function Shutdown(suspend) {
	if (HA_DEVICE) {
		HA_DEVICE.shutdown();
	}
}

export function ImageUrl() { return ""; }


// -------------------------------------------<( Discovery Service & Bridge )>------------------------------------------

class XmlHttp {
	static Get(url, token, callback, async = true) {
		const xhr = new XMLHttpRequest();
		xhr.open("GET", url, async);
		xhr.setRequestHeader("Accept", "application/json");
		xhr.setRequestHeader("Content-Type", "application/json");
		if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
		xhr.onreadystatechange = callback.bind(null, xhr);
		xhr.send();
	}

	static Post(url, token, data, callback, async = true) {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", url, async);
		xhr.setRequestHeader("Accept", "application/json");
		xhr.setRequestHeader("Content-Type", "application/json");
		if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
		if (callback) xhr.onreadystatechange = callback.bind(null, xhr);
		xhr.send(JSON.stringify(data));
	}
}

export function DiscoveryService() {
	this.MDns = []; // mDNS removed to prevent empty ghost instances

	this.Initialize = function() {
		service.log("Initializing Home Assistant Plugin...");
		this.loadSavedCredentials();
	};

	this.loadSavedCredentials = function() {
		const savedUrl = service.getSetting("HA_Config", "url");
		const savedToken = service.getSetting("HA_Config", "token");
		const savedEntities = service.getSetting("HA_Config", "entities") || "";
		
		if (savedUrl && savedToken) {
			this.setCredentials(savedUrl, savedToken, savedEntities);
		}
	};

	this.setCredentials = function(url, token, entities) {
		if (!url || !token) return;

		let cleanUrl = url.trim();
		if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
			cleanUrl = "http://" + cleanUrl;
		}
		if (cleanUrl.endsWith('/')) {
			cleanUrl = cleanUrl.slice(0, -1);
		}

		service.log(`Testing connection to ${cleanUrl}...`);

		XmlHttp.Get(`${cleanUrl}/api/config`, token, (xhr) => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200 || xhr.status === 201) {
					service.log("Successfully connected to Home Assistant!");
					const data = JSON.parse(xhr.response);
					
					service.saveSetting("HA_Config", "url", cleanUrl);
					service.saveSetting("HA_Config", "token", token);
					service.saveSetting("HA_Config", "entities", entities || ""); 

					// LIVE UPDATE FEATURE: Push updates immediately without restarting SignalRGB
					if (typeof HA_DEVICE !== "undefined" && HA_DEVICE !== null) {
						service.log("Pushing live entity updates to running device...");
						HA_DEVICE.url = cleanUrl;
						HA_DEVICE.token = token;
						HA_DEVICE.targetEntities = entities || "";
						HA_DEVICE.initializeChannels();
					}

					const discoveryPayload = {
						hostname: cleanUrl,
						name: data.location_name || "Home Assistant",
						mac: data.uuid || cleanUrl, 
						token: token,
						entities: entities || "",
						forced: true
					};

					this.Discovered(discoveryPayload);
				} else {
					service.log(`Failed to authorize with Home Assistant. Status Code: ${xhr.status}`);
				}
			}
		});
	};

	this.Discovered = function(value) {
		const controller = service.getController(value.mac);

		if (controller === undefined) {
			service.addController(new HABridge(value));
		} else {
			controller.updateWithValue(value);
		}
	};

	this.Update = function() {
		for (const cont of service.controllers) {
			cont.obj.update();
		}
	};

    this.deleteBridge = function(bridgeId) {
		service.log("Deleting Bridge and clearing saved data...");
		service.removeSetting("HA_Config", "url");
		service.removeSetting("HA_Config", "token");
		service.removeSetting("HA_Config", "entities");
		service.removeSetting("HA_Linked", "id");

		// Loop through the UI controllers and explicitly remove the matching one
		for (const controller of service.controllers) {
			if (controller.id === bridgeId) {
				service.suppressController(controller);
				service.removeController(controller);
				return;
			}
		}
	};
}

class HABridge {
	constructor(value) {
		this.url = value.hostname;
		this.token = value.token;
		this.entities = value.entities;
		this.name = value.name;
		this.mac = value.mac;
		this.id = value.mac;
		this.ip = value.hostname; 
		this.forced = value.forced;
		this.deviceledcount = 0;
		this.connected = false;
		this.offline = false;
		this.readyToAnnounce = true;
		this.announced = false;
		this.lastUpdate = Date.now();

		const linkedId = service.getSetting("HA_Linked", "id");
		if (linkedId === this.id) {
			this.connected = true;
		}

		service.log(`Bridge Constructed: ${this.name}`);
		this.getDeviceStats();
	}

	updateWithValue(value) {
		this.url = value.hostname;
		this.token = value.token;
		this.entities = value.entities;
		this.name = value.name;
		this.ip = value.hostname;
		service.updateController(this);
		this.getDeviceStats();
	}

	update() {
		if (this.readyToAnnounce && !this.announced) {
			if (this.connected) {
				service.announceController(this);
			}
			this.announced = true;
			service.updateController(this);
		}

		const currentTime = Date.now();
		if (currentTime - this.lastUpdate >= 60000) {
			this.lastUpdate = currentTime;
			this.getDeviceStats();
		}
	}

	getDeviceStats() {
		const allowedLights = this.entities ? this.entities.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0) : [];

		XmlHttp.Get(`${this.url}/api/states`, this.token, (xhr) => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					try {
						const states = JSON.parse(xhr.response);
						let count = 0;
						states.forEach(s => {
							if (s.entity_id.startsWith("light.")) {
								if (allowedLights.length === 0 || allowedLights.includes(s.entity_id.toLowerCase())) {
									count++;
								}
							}
						});
						this.deviceledcount = count;
						this.offline = false;
						service.updateController(this);
					} catch (e) {}
				} else {
					this.offline = true;
					service.updateController(this);
				}
			}
		});
	}

	startLink() {
		service.saveSetting("HA_Linked", "id", this.id);
		this.connected = true;
		service.announceController(this);
		service.updateController(this);
	}

	startRemove() {
		service.removeSetting("HA_Linked", "id");
		this.connected = false;
		service.suppressController(this);
		service.updateController(this);
	}
}