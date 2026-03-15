export function Name() { return "Home Assistant Bridge"; }
export function Version() { return "1.11.0"; }
export function Type() { return "network"; }
export function Publisher() { return "SignalRGB Community"; }
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
*/

export function ControllableParameters() {
	return [
		{"property":"LightingMode", "group":"settings", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"settings", "label":"Forced Color", "type":"color", "default":"#009bde"}
	];
}

// -------------------------------------------<( Device Core Logic )>--------------------------------------------------

let HA_DEVICE;

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
		device.log("Initializing channels from the user's selected entity list...");
		
		let allowedLights = {};
		if (this.targetEntities) {
			try {
				allowedLights = JSON.parse(this.targetEntities);
			} catch(e) {
				const arr = this.targetEntities.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
				arr.forEach(id => { allowedLights[id] = 5; });
			}
		}
		
		if (Object.keys(allowedLights).length === 0) {
			device.log("No entities are currently selected for sync. Check your settings.");
			return;
		}

		const xhr = new XMLHttpRequest();
		xhr.open("GET", `${this.url}/api/states`, false); 
		xhr.setRequestHeader("Accept", "application/json");
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.setRequestHeader("Authorization", "Bearer " + this.token);
		
		try {
			xhr.send();
			if (xhr.status === 200) {
				const states = JSON.parse(xhr.response);
				this.lights = [];
				
				states.forEach(state => {
					const entityId = state.entity_id.toLowerCase();
					if (state.entity_id.startsWith("light.") && allowedLights.hasOwnProperty(entityId)) {
						const attrs = state.attributes || {};
						const friendlyName = attrs.friendly_name || state.entity_id;
						const colorModes = attrs.supported_color_modes || [];

						const supportsColor = colorModes.includes("rgb") || colorModes.includes("rgbw") || colorModes.includes("hs") || colorModes.includes("xy");
						const supportsBrightness = supportsColor || colorModes.includes("brightness") || colorModes.includes("color_temp");

						if (supportsColor || supportsBrightness) {
							
							let initialState = { state: state.state };
							if (state.state === "on") {
								if (attrs.brightness !== undefined) initialState.brightness = attrs.brightness;
								
								if (attrs.color_mode === "color_temp" || (attrs.color_temp_kelvin !== undefined && attrs.color_temp_kelvin !== null)) {
									if (attrs.color_temp_kelvin !== undefined && attrs.color_temp_kelvin !== null) {
										initialState.color_temp_kelvin = attrs.color_temp_kelvin;
									} else if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
										initialState.color_temp = attrs.color_temp;
									}
								} else {
									if (attrs.rgb_color !== undefined && attrs.rgb_color !== null) initialState.rgb_color = attrs.rgb_color;
									else if (attrs.hs_color !== undefined && attrs.hs_color !== null) initialState.hs_color = attrs.hs_color;
									else if (attrs.xy_color !== undefined && attrs.xy_color !== null) initialState.xy_color = attrs.xy_color;
								}
							}

							this.lights.push({
								id: state.entity_id,
								name: friendlyName,
								fps: allowedLights[entityId] || 5, 
								lastRenderTime: 0,                 
								supportsColor: supportsColor,
								supportsBrightness: supportsBrightness,
								lastColor: [-1, -1, -1],
								initialState: initialState 
							});
						}
					}
				});

				device.SetLedLimit(this.lights.length);
				this.lights.forEach(light => {
					device.addChannel(light.id, 1);
				});

				device.log(`Successfully mapped ${this.lights.length} selected Home Assistant lights.`);
			} else {
				device.log("HA API returned status: " + xhr.status);
			}
		} catch (e) {
			device.log("Failed to connect or parse HA response during initialization: " + e);
		}
	}

	updateColors() {
		if (this.lights.length === 0) return;

		const currentMode = typeof LightingMode !== "undefined" ? LightingMode : "Canvas";
		const currentColor = typeof forcedColor !== "undefined" ? forcedColor : "#009bde";
		const now = Date.now();

		this.lights.forEach(light => {
			const safeFPS = light.fps > 0 ? light.fps : 5;
			const frameDelay = 1000 / safeFPS;
			
			if (now - light.lastRenderTime >= frameDelay) {
				light.lastRenderTime = now;

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
			}
		});
	}

	shutdown() {
		if (this.lights.length === 0) return;
		this.lights.forEach(light => {
			let payload = { "entity_id": light.id };
			
			if (light.initialState && light.initialState.state === "on") {
				if (light.initialState.brightness !== undefined) payload.brightness = light.initialState.brightness;
				
				if (light.initialState.color_temp_kelvin !== undefined) {
					payload.color_temp_kelvin = light.initialState.color_temp_kelvin;
				} else if (light.initialState.color_temp !== undefined) {
					payload.color_temp = light.initialState.color_temp;
				} else if (light.initialState.rgb_color !== undefined) {
					payload.rgb_color = light.initialState.rgb_color;
				} else if (light.initialState.hs_color !== undefined) {
					payload.hs_color = light.initialState.hs_color;
				} else if (light.initialState.xy_color !== undefined) {
					payload.xy_color = light.initialState.xy_color;
				}
				
				XmlHttp.Post(`${this.url}/api/services/light/turn_on`, this.token, payload, null, false);
			} else {
				XmlHttp.Post(`${this.url}/api/services/light/turn_off`, this.token, payload, null, false);
			}
		});
	}
}

export function Initialize() {
	device.setName(controller.name);
	HA_DEVICE = new HomeAssistantDevice(controller);
	HA_DEVICE.initializeChannels();
}

export function Render() {
	if (HA_DEVICE) {
		HA_DEVICE.updateColors();
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
	this.MDns = [ "_home-assistant._tcp.local." ]; 

	this.Initialize = function() {
		service.log("Initializing Home Assistant Bridge Plugin...");
		this.loadSavedCredentials();
	};

	this.loadSavedCredentials = function() {
		const savedUrl = service.getSetting("HA_Config", "url");
		const savedToken = service.getSetting("HA_Config", "token");
		const savedEntities = service.getSetting("HA_Config", "entities") || "";
		const savedGroups = service.getSetting("HA_Config", "filterGroups") || "true";
		
		if (savedUrl && savedToken) {
			this.setCredentials(savedUrl, savedToken, savedEntities, savedGroups === "true", false);
		}
	};

	this.setCredentials = function(url, token, entities, filterGroups, autoLink = false) {
		if (!url || !token) return;

		let cleanUrl = url.trim();
		if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
			cleanUrl = "http://" + cleanUrl;
		}
		if (cleanUrl.endsWith('/')) {
			cleanUrl = cleanUrl.slice(0, -1);
		}

		service.log(`Authenticating with Home Assistant at ${cleanUrl}...`);

		XmlHttp.Get(`${cleanUrl}/api/config`, token, (xhr) => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200 || xhr.status === 201) {
					service.log("Authentication successful! Building dynamic entity list...");
					const configData = JSON.parse(xhr.response);
					
					let finalEntities = entities;
					if (finalEntities === undefined || finalEntities === null || finalEntities === "") {
						finalEntities = service.getSetting("HA_Config", "entities") || "";
					}
					
					let finalFilterGroups = filterGroups;
					if (finalFilterGroups === undefined || finalFilterGroups === null) {
						finalFilterGroups = service.getSetting("HA_Config", "filterGroups") !== "false";
					}
					
					service.saveSetting("HA_Config", "url", cleanUrl);
					service.saveSetting("HA_Config", "token", token);
					service.saveSetting("HA_Config", "entities", finalEntities); 
					service.saveSetting("HA_Config", "filterGroups", finalFilterGroups ? "true" : "false");

					const discoveryPayload = {
						hostname: cleanUrl,
						name: configData.location_name || "Home Assistant",
						mac: configData.uuid || cleanUrl, 
						token: token,
						entities: finalEntities,
						filterGroups: finalFilterGroups,
						autoLink: autoLink, 
						forced: true
					};

					for (let i = service.controllers.length - 1; i >= 0; i--) {
						const cont = service.controllers[i];
						if (cont.id !== discoveryPayload.mac) {
							service.suppressController(cont);
							service.removeController(cont);
						}
					}

					this.Discovered(discoveryPayload);
				} else {
					service.log(`Authorization failed. Check your Long-Lived Access Token. HTTP Status: ${xhr.status}`);
				}
			}
		});
	};

	this.Discovered = function(value) {
		if (!value.forced && value.hostname) {
			let cleanUrl = value.hostname;
			if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
				cleanUrl = "http://" + cleanUrl;
			}
			if (value.port && !cleanUrl.match(/:\d+\/?$/)) {
				cleanUrl += ":" + value.port;
			}
			
			cleanUrl = cleanUrl.replace(/\.local\.:/g, '.local:');
			if (cleanUrl.endsWith('.local.')) cleanUrl = cleanUrl.slice(0, -1);
			value.hostname = cleanUrl;
			
			if (!value.token) value.token = service.getSetting("HA_Config", "token") || "";
			if (!value.entities) value.entities = service.getSetting("HA_Config", "entities") || "";
			if (value.filterGroups === undefined) value.filterGroups = service.getSetting("HA_Config", "filterGroups") !== "false";

			if (value.token) {
				try {
					const xhr = new XMLHttpRequest();
					xhr.open("GET", `${cleanUrl}/api/config`, false); 
					xhr.setRequestHeader("Accept", "application/json");
					xhr.setRequestHeader("Content-Type", "application/json");
					xhr.setRequestHeader("Authorization", "Bearer " + value.token);
					xhr.send();
					
					if (xhr.status === 200 || xhr.status === 201) {
						const configData = JSON.parse(xhr.response);
						if (configData.uuid) {
							value.mac = configData.uuid; 
							value.name = configData.location_name || value.name;
						}
					} else {
						value.token = ""; 
					}
				} catch (e) {}
			}
		}

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

	this.forgetBridge = function(bridgeId) {
		service.log("Forgetting Home Assistant Bridge: " + bridgeId);

		let wasLinked = false;
		
		for (let i = service.controllers.length - 1; i >= 0; i--) {
			const cont = service.controllers[i];
			if (cont.id === bridgeId) {
				if (cont.obj.connected) {
					wasLinked = true;
				}
				service.suppressController(cont);
				service.removeController(cont);
			}
		}

		if (wasLinked || service.controllers.length === 0) {
			service.log("Clearing saved HA credentials...");
			service.removeSetting("HA_Config", "url");
			service.removeSetting("HA_Config", "token");
			service.removeSetting("HA_Config", "entities");
			service.removeSetting("HA_Config", "filterGroups");
			service.removeSetting("HA_Linked", "id");
		}
	};
}

class HABridge {
	constructor(value) {
		this.url = value.hostname;
		this.token = value.token || "";
		this.entities = value.entities || "";
		this.filterGroups = value.filterGroups !== undefined ? value.filterGroups : true;
		this.name = value.name || "Home Assistant";
		this.mac = value.mac;
		this.id = value.mac;
		this.ip = value.hostname; 
		this.forced = value.forced || false;
		this.deviceledcount = 0;
		this.connected = false;
		this.offline = false;
		this.readyToAnnounce = true;
		this.announced = false;
		this.lastUpdate = Date.now();

		this.availableEntitiesJson = "[]"; 

		const linkedId = service.getSetting("HA_Linked", "id");
		if (linkedId === this.id) {
			this.connected = true;
		}

		service.log(`Bridge Constructed: ${this.name}`);
		this.getAllHAEntities();
	}

	updateWithValue(value) {
		const entitiesChanged = this.entities !== value.entities;
		const groupFilterChanged = this.filterGroups !== value.filterGroups;
		const needsRestart = entitiesChanged || groupFilterChanged;

		this.url = value.hostname;
		if (value.token !== undefined) this.token = value.token;
		if (value.entities !== undefined) this.entities = value.entities;
		if (value.filterGroups !== undefined) this.filterGroups = value.filterGroups;
		this.name = value.name;
		this.ip = value.hostname;
		
		service.updateController(this);
		this.getAllHAEntities();

		if (this.connected) {
			if (needsRestart) {
				service.log("Settings changed! Restarting canvas device to pull new channels...");
				service.suppressController(this);
				service.announceController(this);
			}
		} else if (value.autoLink) {
			service.log("Auto-linking after saving settings...");
			this.startLink();
		}
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
			this.getAllHAEntities();
		}
	}

	getAllHAEntities() {
		if (!this.token || !this.url) return;

		let areaMap = {};
		const tplXhr = new XMLHttpRequest();
		tplXhr.open("POST", `${this.url}/api/template`, false); 
		tplXhr.setRequestHeader("Accept", "application/json");
		tplXhr.setRequestHeader("Content-Type", "application/json");
		tplXhr.setRequestHeader("Authorization", "Bearer " + this.token);
		
		try {
			tplXhr.send(JSON.stringify({template: "{% for state in states.light %}{{ state.entity_id }}|{{ area_name(state.entity_id) | default('Allgemein', true) }}::{% endfor %}"}));
			if (tplXhr.status === 200) {
				const responseText = tplXhr.response || tplXhr.responseText;
				const pairs = responseText.split("::");
				pairs.forEach(p => {
					const parts = p.split("|");
					if (parts.length === 2) {
						areaMap[parts[0]] = (parts[1] === "None" || parts[1].trim() === "") ? "Allgemein" : parts[1].trim();
					}
				});
			}
		} catch(e) {}

		XmlHttp.Get(`${this.url}/api/states`, this.token, (xhr) => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					try {
						const states = JSON.parse(xhr.response);
						let fullList = [];
						let mappedCount = 0;

						let allowedLights = {};
						if (this.entities) {
							try {
								allowedLights = JSON.parse(this.entities);
							} catch(e) {
								const arr = this.entities.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
								arr.forEach(id => { allowedLights[id] = 5; });
							}
						}

						states.forEach(state => {
							if (state.entity_id.startsWith("light.")) {
								const attrs = state.attributes || {};
								const friendlyName = attrs.friendly_name || state.entity_id;
								const colorModes = attrs.supported_color_modes || [];

								if (this.filterGroups) {
									if (attrs.hasOwnProperty("entity_id")) {
										return;
									}
								}

								const supportsColor = colorModes.includes("rgb") || colorModes.includes("rgbw") || colorModes.includes("hs") || colorModes.includes("xy");
								const supportsBrightness = supportsColor || colorModes.includes("brightness") || colorModes.includes("color_temp");

								if (supportsColor || supportsBrightness) {
									const isChecked = allowedLights.hasOwnProperty(state.entity_id.toLowerCase());
									fullList.push({
										id: state.entity_id,
										name: friendlyName,
										area: areaMap[state.entity_id.toLowerCase()] || "Allgemein",
										checked: isChecked,
										fps: isChecked ? allowedLights[state.entity_id.toLowerCase()] : 5
									});
									
									if (isChecked) {
										mappedCount++;
									}
								}
							}
						});
						
						fullList.sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));

						this.availableEntitiesJson = JSON.stringify(fullList);
						this.deviceledcount = mappedCount;
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