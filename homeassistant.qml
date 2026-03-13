Item {
	anchors.fill: parent
	Column {
		width: parent.width
		height: parent.height
		
		// 1. INFO BANNER
		Column {
			width: 700 
			height: 105
			Rectangle {
				width: parent.width
				height: parent.height - 10
				color: "#03a9f4"
				radius: 5
				Column {
					x: 10
					y: 10
					width: parent.width - 20
					spacing: 0
					Text {
						color: theme.primarytextcolor
						textFormat: Text.RichText
						text: "<table><tr><td width=\"24\" style=\"text-align:center;vertical-align:middle\"></td><td><u><strong>Important:<strong></u><br>Generate a <strong>Long-Lived Access Token</strong> from your HA Profile page.<br>Input your credentials, click <strong>'Connect'</strong>, and then select your lights<br>from the dynamic list below.</td></tr></table>"
						font.pixelSize: 12
						font.family: "Poppins"
						font.bold: false
					}
				}
			}
		}

		// 2. INPUT SECTION
		Column {
			id: inputBlock
			width: 700 
			height: 170 
			Rectangle {
				width: parent.width
				height: parent.height - 10
				color: "#141414"
				radius: 5
				
				Column {
					x: 10
					y: 10
					width: parent.width - 20
					spacing: 12
					
					Text {
						color: theme.primarytextcolor
						text: "Home Assistant Configuration"
						font.pixelSize: 16
						font.family: "Poppins"
						font.bold: true
					}
					
					Row {
						spacing: 6
						Text {
							text: "URL: "
							color: theme.primarytextcolor
							font.family: "Poppins"
							font.bold: true
							anchors.verticalCenter: parent.verticalCenter
							width: 70
						}
						Rectangle {
							width: 580 
							height: 35
							radius: 5
							border.color: "#1c1c1c"
							border.width: 2
							color: "#0a0a0a"
							TextField {
								id: haURL
								width: parent.width
								leftPadding: 10
								rightPadding: 10
								color: theme.primarytextcolor
								font.family: "Poppins"
								font.pixelSize: 14
								verticalAlignment: TextInput.AlignVCenter
								placeholderText: "Optional if auto-discovered below"
								background: Item {}
							}
						}
					}

					Row {
						spacing: 6
						Text {
							text: "Token:"
							color: theme.primarytextcolor
							font.family: "Poppins"
							font.bold: true
							anchors.verticalCenter: parent.verticalCenter
							width: 70
						}
						Rectangle {
							width: 580 
							height: 35
							radius: 5
							border.color: "#1c1c1c"
							border.width: 2
							color: "#0a0a0a"
							TextField {
								id: haToken
								width: parent.width
								leftPadding: 10
								rightPadding: 10
								color: theme.primarytextcolor
								font.family: "Poppins"
								font.pixelSize: 14
								verticalAlignment: TextInput.AlignVCenter
								placeholderText: "ey..."
								echoMode: TextInput.Password
								background: Item {}
							}
						}
					}
				}

				ToolButton {
					x: 550 
					y: 120
					height: 30
					width: 110
					font.family: "Poppins"
					font.bold: true
					text: "Connect" 
					onClicked: {
						discovery.setCredentials(haURL.text, haToken.text, "", null, false);
					}
				}
			}
		}

		// 3. MAIN BRIDGE & ENTITY LISTVIEW
		ListView {
			id: controllerList
			model: service.controllers   
			width: 700 
			height: parent.height - 295
			clip: true
			spacing: 15

			ScrollBar.vertical: ScrollBar {
				id: controllerListScrollBar
				anchors.right: parent.right
				width: 10
				visible: parent.height < parent.contentHeight
				policy: ScrollBar.AlwaysOn

				height: parent.availableHeight
				contentItem: Rectangle {
					radius: parent.width / 2
					color: theme.scrollBar
				}
			}

			delegate: Item {
				id: bridgeDelegate
				visible: true
				width: 700 
				height: 500
				property var device: model.modelData.obj
				
				property color btnColor: "#292929"
				property color btnHover: "#404040"
				property color accent: "#03a9f4"

				property string jsonPayload: device.availableEntitiesJson ? device.availableEntitiesJson : "[]"
				
				onJsonPayloadChanged: {
					entityListModel.clear();
					try {
						var items = JSON.parse(jsonPayload);
						for (var i = 0; i < items.length; i++) {
							entityListModel.append(items[i]);
						}
					} catch(e) {}
				}

				ListModel {
					id: entityListModel
				}

				Rectangle {
					id: bridgeBlock
					width: parent.width
					height: parent.height - 10
					color: device.offline ? "#101010" : "#141414"
					radius: 5
				}
				
				Column {
					x: 10
					y: 10
					spacing: 10
					width: parent.width - 20

					Item {
						width: parent.width
						height: 30
						
						Text {
							color: theme.primarytextcolor
							text: device.name
							font.pixelSize: 18
							font.family: "Poppins"
							font.bold: true
							anchors.verticalCenter: parent.verticalCenter
							anchors.left: parent.left
						}
						
						Row {
							anchors.verticalCenter: parent.verticalCenter
							anchors.right: parent.right
							spacing: 10

							Rectangle {
								width: 100
								height: 30
								radius: 5
								color: device.connected ? accent : (device.token === "" ? "#C0A21B" : btnColor)
								MouseArea {
									anchors.fill: parent
									cursorShape: Qt.PointingHandCursor
									hoverEnabled: true
									onEntered: parent.color = device.connected ? accent : (device.token === "" ? Qt.lighter("#C0A21B", 1.1) : btnHover)
									onExited: parent.color = device.connected ? accent : (device.token === "" ? "#C0A21B" : btnColor)
									onClicked: {
										if(device.connected) {
											device.startRemove();
										} else {
											if (device.token === "") {
												if (haToken.text !== "") {
													discovery.setCredentials(device.url, haToken.text, "", null, true);
												}
											} else {
												device.startLink();
											}
										}
									}
								}
								Text {
									anchors.centerIn: parent
									color: theme.primarytextcolor
									text: device.connected ? "Linked" : (device.token === "" ? "Authenticate" : "Link")
									font.family: "Poppins"
									font.bold: true 
								}
							}

							Rectangle {
								id: btnForget
								width: 80
								height: 30
								radius: 5
								color: btnColor
								MouseArea {
									anchors.fill: parent
									cursorShape: Qt.PointingHandCursor
									hoverEnabled: true
									onEntered: parent.color = btnHover
									onExited: parent.color = btnColor
									onClicked: {
										discovery.forgetBridge(device.id);
									}
								}
								Text {
									anchors.centerIn: parent
									color: theme.primarytextcolor
									text: "Forget"
									font.family: "Poppins"
									font.bold: true 
								}
							}
						}
					}

					Text { color: theme.primarytextcolor; text: "URL: " + device.ip; font.family: "Poppins" }
					
					Text { color: theme.primarytextcolor; text: "Lights Synced: " + device.deviceledcount; font.family: "Poppins"; font.bold: true; visible: device.token !== "" }
					Text { color: "#C0A21B"; text: "Requires Authentication! Enter token in top box and click Authenticate."; font.family: "Poppins"; font.bold: true; visible: device.token === "" }

					Rectangle { width: parent.width; height: 1; color: "#202020" }
				}

				Column {
					id: configSection
					x: 10
					y: 120
					width: parent.width - 20
					spacing: 10
					height: 350
					enabled: device.connected 
					opacity: device.connected ? 1.0 : 0.4
					
					Item {
						width: parent.width
						height: 30
						
						Row {
							anchors.left: parent.left
							anchors.verticalCenter: parent.verticalCenter
							spacing: 15

							CheckBox {
								id: uiFilterGroups
								text: "Hide Light Groups"
								checked: device.filterGroups === true
								font.family: "Poppins"
								font.bold: true
								palette.windowText: theme.primarytextcolor
								onClicked: {
									var entitiesObj = {};
									for (var i = 0; i < entityListModel.count; ++i) {
										var item = entityListModel.get(i);
										if (item.checked) entitiesObj[item.id] = parseInt(item.fps) || 5;
									}
									discovery.setCredentials(device.url, device.token, JSON.stringify(entitiesObj), checked, false);
								}
							}
						}
						
						Rectangle {
							id: btnSaveSelections
							width: 140
							height: 30
							radius: 5
							color: accent
							anchors.verticalCenter: parent.verticalCenter
							anchors.right: parent.right
							MouseArea {
								anchors.fill: parent
								cursorShape: Qt.PointingHandCursor
								hoverEnabled: true
								onEntered: parent.color = Qt.lighter(accent, 1.1)
								onExited: parent.color = accent
								onClicked: {
									var entitiesObj = {};
									for (var i = 0; i < entityListModel.count; ++i) {
										var item = entityListModel.get(i);
										if (item.checked) {
											entitiesObj[item.id] = parseInt(item.fps) || 5;
										}
									}
									var finalEntityString = JSON.stringify(entitiesObj);
									
									discovery.setCredentials(device.url, device.token, finalEntityString, uiFilterGroups.checked, true);
								}
							}
							Text {
								anchors.centerIn: parent
								color: theme.primarytextcolor
								text: "Save Selections & Link" 
								font.family: "Poppins"
								font.bold: true 
							}
						}
					}

					Text {
						color: theme.primarytextcolor
						text: "Available Home Assistant Lights (Syncs with Layouts page)"
						font.pixelSize: 14
						font.family: "Poppins"
						font.bold: true
					}

					ListView {
						id: entityNestedList
						model: entityListModel 
						width: parent.width
						height: 250
						clip: true
						spacing: 4

						ScrollBar.vertical: ScrollBar {
							anchors.right: parent.right
							width: 8
							visible: parent.height < parent.contentHeight
							policy: ScrollBar.AlwaysOn
							contentItem: Rectangle { radius: parent.width / 2; color: "#252525" }
						}

						section.property: "area"
						section.criteria: ViewSection.FullString
						section.delegate: Item {
							width: entityNestedList.width - 15
							height: 28
							
							Text {
								text: section
								color: accent
								font.pixelSize: 14
								font.family: "Poppins"
								font.bold: true
								anchors.verticalCenter: parent.verticalCenter
								anchors.left: parent.left
								anchors.leftMargin: 8
							}

							Rectangle {
								width: parent.width - parent.children[0].contentWidth - 25
								height: 2
								color: "#252525"
								anchors.verticalCenter: parent.verticalCenter
								anchors.right: parent.right
							}
						}

						delegate: Rectangle {
							width: entityNestedList.width - 15
							height: 35
							color: "#0a0a0a"
							radius: 5
							Item {
								x: 8
								width: parent.width - 16
								height: parent.height
								
								Row {
									anchors.left: parent.left
									anchors.verticalCenter: parent.verticalCenter
									spacing: 8
									
									CheckBox {
										checked: model.checked === true
										anchors.verticalCenter: parent.verticalCenter
										onClicked: {
											entityListModel.setProperty(index, "checked", checked);
										}
									}
									
									Text {
										text: model.name 
										color: theme.primarytextcolor
										font.family: "Poppins"
										font.bold: true
										anchors.verticalCenter: parent.verticalCenter
									}
								}

								Row {
									anchors.verticalCenter: parent.verticalCenter
									anchors.right: parent.right
									anchors.rightMargin: 10
									spacing: 15
									
									Text {
										text: "[" + model.id + "]" 
										color: "#505050"
										font.pixelSize: 12
										font.family: "Courier"
										anchors.verticalCenter: parent.verticalCenter
									}

									Row {
										spacing: 6
										anchors.verticalCenter: parent.verticalCenter

										Text {
											text: "FPS:" 
											color: "#505050"
											font.pixelSize: 12
											font.family: "Poppins"
											font.bold: true
											anchors.verticalCenter: parent.verticalCenter
										}

										Rectangle {
											width: 50 
											height: 25
											color: "#1c1c1c"
											radius: 3
											anchors.verticalCenter: parent.verticalCenter
											
											TextInput {
												width: parent.width
												height: 18
												anchors.centerIn: parent
												text: model.fps ? model.fps.toString() : "5"
												color: theme.primarytextcolor
												font.pixelSize: 14 
												horizontalAlignment: TextInput.AlignHCenter
												verticalAlignment: TextInput.AlignVCenter
												selectByMouse: true
												onTextEdited: {
													entityListModel.setProperty(index, "fps", parseInt(text) || 5);
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
}