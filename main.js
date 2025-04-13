"use strict";

const utils = require("@iobroker/adapter-core");
const net = require('net');
const ESPClients = require('./ESPClients.js');



class Esppython extends utils.Adapter {
	
	
	clientlist = [];
	
    constructor(options) {
        super({
            ...options,
            name: "esppython",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }


    async onReady() {
        this.setState("info.connection", false, true);		// Infoleuchte

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
		this.log.info("Loading Config");
        this.log.info("config Port: " + this.config.port);
		
		
		
		this.log.info ("Setting up ESP Python-Server");
		this._startServer();
		

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync("admin", "iobroker");
        //this.log.info("check user admin pw iobroker: " + result);

        //result = await this.checkGroupAsync("admin", "admin");
        //this.log.info("check group user admin group admin: " + result);
    }
	
	
	_startServer() {
		this.server = net.createServer(function(con) {
			this._newClientConnection(con);
		}.bind(this));
		
		//this.config.port
		this.server.listen(9999, function() {
			this._log ("Server listening on Port: " + this.config.port);
			
		}.bind(this));
	}
	
	// on New Clientconnection
	_newClientConnection(cl) {
		const client = new ESPClients(cl, this);
		this.clientlist.push(client);
		this._log ("Neuer Client erfolgreich eingetragen");
	}
	
	
	
	
	_log (s, lvl=5) {
		
		if (lvl == 5 ) 
			this.log.info (s);
		
	}
	
	
	

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.server.end();
			this.clientlist = [];
            callback();
        } catch (e) {
            callback();
        }
    }



    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
		
		try {
			if (state) {
				// The state was changed
				this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
				
				
				if (!state.ack) {
					
					var sid = id.split(".");
					
					this.log.info ("Var geändert: " + sid[2]);				
					
					for (let i = 0; i < this.clientlist.length; i++) {
					  var c = this.clientlist[i];
					  
					  if (c.getID() == sid[2]) {
						  
						  c.sendValue (sid[sid.length-1], state.val);
						  this.setState(id, {ack: true});
						  break;
						  
					  }
					}
					
					
				}
				
				
				
			} else {
				// The state was deleted
				this.log.info(`state ${id} deleted`);
			}
		
		} catch (e) {
			this.log.info("Fehler in onStateChange: " + e);
		}
    }
	
	
	delClient (c) {
		
		for (let i = 0; i < this.clientlist.length; i++) {
			var c = this.clientlist[i];
			  
			if (c.getID() == c.getID()) {
				  
			  this.clientlist.splice(i, 1);
			  this.log.info ("Client " + c.getID() + " gelöscht");	
			  break;
				  
			}
		}
				
		
	}

   

}




// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Esppython(options);
} else {
    // otherwise start the instance directly
    new Esppython();
}