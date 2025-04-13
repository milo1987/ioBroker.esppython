class ESPClients  {
	
	id = "";
	randID = "";
	name = "";
	version = -1;
	apiversion = -1;
	
	lastPing = 0;
	pingTimeout = 20;	// Sekunden bis zum Timeout
	
	
	
	
	constructor(socket, esppython) {
		this.socket = socket;
		this.socket.setKeepAlive(true);
		this.esppython = esppython;
		this.randID = Math.floor(Math.random() *99999999);
		
		socket.on ('data', function (data) {
			esppython._log ("Neue Daten: " + data);
			let ds = data.toString();
			
			
			
		// ###### Start Connection #######	
			if (ds.startsWith("Connect")) {
				
				let split = ds.split("~");
				
				for (let a=0; a < split.length; a++) {
					esppython._log ("Splitdaten: " + split[a]);
					let s = split[a].split("=");
					
					if (s[0] == "name")
						this.name = s[1];
					else if (s[0] == "id")
						this.id = s[1];
					else if (s[0] == "version")
						this.version = s[1];
					else if (s[0] == "apiversion")
						this.apiversion = s[1];
					else if (s[0] == "initVar")
						this.initVar(s[1]);
					
				}
				
				if (this.id != "" && this.name != "" && this.version != -1 && this.apiversion != -1) {
					this.sendToClient("CONNECT");
					this.log(" connected.");
					
					this.lastPing = Date.now();
					this.isRunning = true;
					
					// ###### Controlling Ping #######	
					this.log ("Starte Pingtimer");
					this.pingTimer = setInterval (this.pingTimerFunction.bind(this), 5000);
					
					
					// ##### Writing Sysobjects #####
					this.generateSysVars();
					this.esppython.setState(this.id + ".sys.status", { val: true, ack: true });
					
				} else {
					this.sendToClient("ERROR");
					this.endConnection()
					this.log(" connect failed.");
				}
				
				
				
				
				
			}
			
			
		// ###### Receiving Data #######	
		
		
			else if (ds.startsWith("Recv")) {
				
				this.log ("RECV: " + ds);
				let m = ds.split("~");
				this.sendToClient("RecvOK~" + m[1]);
				this.changeVar(m[2], m[3]);
				
			}
			
			
			
		// ###### Receiving Ping-Pong #######	
			else if (ds.startsWith("Pong")) {
				
				this.lastPing = Date.now();
				
			}
					
			
		}.bind(this));
		
		
		
		
		
		socket.on('end', function() {
			this.log ("disconnected");
		}.bind(this));
		
	}
	
	async initVar(ivar) {
		
		try {
			this.log ("Erhalte neue IVar: " + ivar);
			let s = ivar.split("|");
			let name = s[0];
			let value = s[1];
			let v = value;
			let type = Number.parseInt(s[2]);
			let t = "";
			
			let rO = true;
			if (s[3] == "True")
				rO = false;
			
			if (type == 1) {
				t = "string";
			} else if (type == 1 || type == 2 || type == 4) {
				t = "boolean";
				v = false;
				if (value == 1 || value == "1" || value == "True")
					v = true;
			} else if (type == 3) {
				t = "number";
				v = Number.parseFloat(value);
			}
				
			this.log ("Setze V: " + v);
			
			var ack = true;
			
			if (!rO)
				ack = false;
			
			await this.esppython.setObjectAsync(this.id + ".vars." + name, {
				type: "state",
				common: {
					name: "Status",
					type: t,
					role: "indicator",
					read: true,
					write: rO,
					val: v,
				},
				native: {},
			});
			
			await this.esppython.setStateAsync(this.id + ".vars." + name, {val: v, ack: true});
			
			this.esppython.subscribeStates(this.id + ".vars." + name);
			
			
		} catch (error) {
			this.log("Fehler bei initVar: " + ivar + " " + error);
		}
	}
	
	
	
	
	
	
	
	async changeVar (name, value) {
		
		try {
		
		this.log ("Änderung Variabel " + name);
		let ob = await this.esppython.getObjectAsync (this.id + ".vars." + name);
		let t = ob.common.type;
		let v = value
		
		if (t == "boolean") {
			v = false;
			if (value == 1 || value == "1" || value == "True") {
				v = true;
			}
		}
		
		if (t == "number") {
			v = Number.parseFloat(value);
		}
		
		await this.esppython.setStateAsync(this.id + ".vars." + name, { val: v, ack: true });
		
		} catch (error) {
			this.log("Fehler bei changeVar " + name + ": " + error);
		}
	}
	
	
	
	
	
	
	
	
	pingTimerFunction() {

		if (Date.now() > (this.lastPing + this.pingTimeout*1000) ) {
			this.log("Pingtimeout");
			this.endConnection();
		} else
			this.sendToClient("Ping");

	}
		
	
	sendToClient(msg) {
		let res = this.socket.write (msg + "\n");
		
		this.log ("Socket send: " + msg + " Result: " + res);
		//this.socket.pipe(this.socket);
	}
	
	async endConnection() {
		
		if (this.isRunning) {
			this.log ("Ending Connection");
			this.socket.destroy();
			clearInterval(this.pingTimer);
			this.isRunning = false;
			this.esppython.delClient(this);
			await this.esppython.setStateAsync(this.id + ".sys.status", { val: false, ack: true });
		}
	}
	
	
	
	log (s, lvl=5) {
		this.esppython._log ("Client: " + this.name + " (" + this.randID + ") : " + s, lvl);
	}
	
	sendValue(v, val) {
		this.sendToClient("valueChange~" + v + "~" + val);
	}
	
	getName() {
		return this.name;
	}
	
	getID() {
		return this.id;
	}
	

	
	async generateSysVars() {
		
		let pf = this.id + ".sys.";
		
		await this.esppython.setObjectNotExistsAsync(this.id, {
            type: "device",
            common: {
                name: this.name,
                type: "string",
                role: "text",
            },
            native: {},
        });
		
		
		await this.esppython.setObjectNotExistsAsync(pf + "status", {
            type: "state",
            common: {
                name: "Status",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
				val: true,
            },
            native: {},
        });
		
		
	}
		
	
	
}



module.exports = ESPClients;
