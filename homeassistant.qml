Item {
	anchors.fill: parent
	Column {
		width: parent.width
		height: parent.height
		
		// 1. INFO BANNER
		Column {
			width: 450
			height: 105
			Rectangle {
				width: parent.width
				height: parent.height - 10
				color: "#03a9f4" // Home Assistant Blue
				radius: 5
				Column {
					x: 10
					y: 10
					width: parent.width - 20
					spacing: 0
					Text {
						color: theme.primarytextcolor
						textFormat: Text.RichText
						text: "<table><tr><td width=\"24\" style=\"text-align:center;vertical-align:middle\"></td><td><u><strong>Important:<strong></u><br>To connect SignalRGB, you must generate a <strong>Long-Lived Access Token</strong><br>from your Home Assistant Profile page.<br>Enter your HA URL, Token, and target entities below.</td></tr></table>"
						font.pixelSize: 12
						font.family: "Poppins"
						font.bold: false
					}
				}
			}
		}

		// 2. INPUT SECTION
		Column {
			width: 450
			height: 210 // Height accounts for all 3 inputs
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
					
					// URL Input Field
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
							width: 330
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
								placeholderText: "http://192.168.1.100:8123"
								background: Item {}
							}
						}
					}

					// Token Input Field
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
							width: 330
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
								echoMode: TextInput.Password // Masks the giant token
								background: Item {}
							}
						}
					}

					// Entities Input Field
					Row {
						spacing: 6
						Text {
							text: "Entities:"
							color: theme.primarytextcolor
							font.family: "Poppins"
							font.bold: true
							anchors.verticalCenter: parent.verticalCenter
							width: 70
						}
						Rectangle {
							width: 330
							height: 35
							radius: 5
							border.color: "#1c1c1c"
							border.width: 2
							color: "#0a0a0a"
							TextField {
								id: haEntities
								width: parent.width
								leftPadding: 10
								rightPadding: 10
								color: theme.primarytextcolor
								font.family: "Poppins"
								font.pixelSize: 14
								verticalAlignment: TextInput.AlignVCenter
								placeholderText: "light.kugel, light.desk (leave empty for all)"
								background: Item {}
							}
						}
					}
				}

				// Action Button
				ToolButton {
					x: 320
					y: 160
					height: 30
					width: 110
					font.family: "Poppins"
					font.bold: true
					text: "Save && Link" 
					onClicked: {
						discovery.setCredentials(haURL.text, haToken.text, haEntities.text);
					}
				}
			}
		}

		// 3. DISCOVERY LIST
		ListView {
			id: controllerList
			model: service.controllers   
			width: contentItem.childrenRect.width + (controllerListScrollBar.width * 1.5)
			height: parent.height - 265
			clip: true

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
				visible: true
				width: 450
				height: 115
				property var device: model.modelData.obj

				Rectangle {
					width: parent.width
					height: parent.height - 10
					color: device.offline ? "#101010" : device.connected ? "#03a9f4" : "#292929"
					radius: 5
				}
				
				Column {
					x: 180 // Shifted slightly left to make room for all buttons
					y: 60
					width: parent.width - 20
					
					Row {
						spacing: 10
						
						// Status Indicator
						Rectangle {
							width: 80
							height: 30
							color: device.offline ? "#C0A21B" : device.connected ? "#292929" : "#03a9f4"
							radius: 5
							Text {
								anchors.centerIn: parent
								color: theme.primarytextcolor
								font.pixelSize: 13
								font.family: "Poppins"
								font.bold: true 
								text: device.offline ? "OFFLINE" : device.connected ? "LINKED" : "UNLINKED"
							}
						}

						// Link/Unlink Button
						ToolButton {
							height: 30
							width: 80
							font.family: "Poppins"
							font.bold: true 
							text: device.connected ? "Unlink" : "Link"
							onClicked: {
								if(device.connected) {
									device.startRemove();
								} else {
									device.startLink();
								}
							}
						}

						// Delete Button
						ToolButton {
							height: 30
							width: 80
							font.family: "Poppins"
							font.bold: true 
							text: "Delete"
							onClicked: {
								discovery.deleteBridge(device.id);
							}
						}
					}
				}
				Column {
					x: 10
					y: 10
					spacing: 6
					Row {
						width: parent.width - 20
						spacing: 6

						Text {
							color: theme.primarytextcolor
							text: device.name
							font.pixelSize: 18
							font.family: "Poppins"
							font.bold: true
						}
					}
					Text {
						color: theme.primarytextcolor
						text: "URL: " + device.ip
					}
					Text {
						color: theme.primarytextcolor
						text: "Lights Discovered: " + device.deviceledcount
					}		  
				}
			}
		}
	}
}