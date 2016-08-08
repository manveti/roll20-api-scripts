var FindTok = FindTok || {
    SQUARE_SIZE: 70,
    BEACON_FRAME: 50,
    AURA_PROPS: ["aura1_radius", "aura2_radius", "aura1_color", "aura2_color", "aura1_square", "aura2_square",
		    "showplayers_aura1", "showplayers_aura2"],
    AURA1_COLOR: "#00c0c0",
    AURA2_COLOR: "#c00000",

    beacon: null,

    init: function(){
	if (!state.hasOwnProperty('FindTok')){ state.FindTok = {}; }
	if (!state.FindTok.hasOwnProperty('turnCfg')){ state.FindTok.turnCfg = null; }
	if (!state.FindTok.hasOwnProperty('auraCache')){ state.FindTok.auraCache = null; }
	FindTok.revertAura();
    },

    write: function(s, who, style, from){
	if (who){
	    who = "/w " + who.split(" ", 1)[0] + " ";
	}
	sendChat(from, who + s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"));
    },

    revertAura: function(){
	if (!state.FindTok.auraCache){ return; }
	var tok = getObj("graphic", state.FindTok.auraCache.token);
	if (!tok){ return; }
	var props = {};
	for (var i = 0; i < FindTok.AURA_PROPS.length; i++){
	    props[FindTok.AURA_PROPS[i]] = state.FindTok.auraCache[FindTok.AURA_PROPS[i]];
	}
	tok.set(props);
	state.FindTok.auraCache = null;
    },

    handleTurnChange: function(newTurnOrder, oldTurnOrder){
	if (!state.FindTok.turnCfg){ return; }

	var newTurns = JSON.parse((typeof(newTurnOrder) == typeof("") ? newTurnOrder : newTurnOrder.get('turnorder') || "[]"));
	var oldTurns = JSON.parse((typeof(oldTurnOrder) == typeof("") ? oldTurnOrder : oldTurnOrder.turnorder || "[]"));

	if ((!newTurns) || (!newTurns.length)){ return; } // nothing in tracker
	if ((oldTurns) && (oldTurns.length) && (newTurns[0].id == oldTurns[0].id)){ return; } // turn didn't change

	var tok = getObj("graphic", newTurns[0].id);
	if (!tok){ return; }
	FindTok.findToken(tok, state.FindTok.turnCfg);
    },

    handleTokenDelete: function(tok){
	if ((!state.FindTok.auraCache) || (tok.id != state.FindTok.auraCache.token)){ return; }
	state.FindTok.auraCache = null;
	if (FindTok.beacon){
	    if (FindTok.beacon.timer){
		clearTimeout(FindTok.beacon.timer);
	    }
	    FindTok.beacon = null;
	}
    },

    updateBeacon: function(){
	if ((!FindTok.beacon) || (!FindTok.beacon.token)){ return; }

	if (FindTok.beacon.timer){
	    FindTok.beacon.timer = null;
	}

	var props = {
	    'aura1_radius':		FindTok.beacon.radius - (FindTok.beacon.step * FindTok.beacon.frame),
	    // aura2_radius computed below based on aura1_radius
	    'aura1_color':		FindTok.AURA1_COLOR,
	    'aura2_color':		FindTok.AURA2_COLOR,
	    'aura1_square':		false,
	    'aura2_square':		false,
	    'showplayers_aura1':	FindTok.beacon.showPlayers,
	    'showplayers_aura2':	FindTok.beacon.showPlayers};
	props['aura2_radius'] = props['aura1_radius'] - (FindTok.beacon.step / 2);
	if (props['aura1_radius'] < 0){ props['aura1_radius'] = 0; }
	if (props['aura2_radius'] < 0){ props['aura2_radius'] = 0; }

	var tok = getObj("graphic", FindTok.beacon.token);
	if ((!tok) || (!FindTok.beacon)){ return; }
	tok.set(props);

	FindTok.beacon.frame += 1;
	if (FindTok.beacon.frame >= FindTok.beacon.frames){
	    FindTok.beacon.frame = 0;
	    FindTok.beacon.cycles -= 1;
	    if (FindTok.beacon.cycles <= 0){
		// beacon completed; revert aura and bail
		FindTok.revertAura();
		FindTok.beacon = null;
		return;
	    }
	}

	if (FindTok.beacon){
	    FindTok.beacon.timer = setTimeout(FindTok.updateBeacon, FindTok.BEACON_FRAME);
	}
    },

    findToken: function(tok, opts){
	// if beacon currently active, abort it
	if (FindTok.beacon){
	    if (FindTok.beacon.timer){
		clearTimeout(FindTok.beacon.timer);
	    }
	    FindTok.beacon = null;
	}
	FindTok.revertAura();

	if ((opts['beaconCount'] > 0) && (opts['beaconTime'] > 0)){
	    // beacon requested; set it up
	    var page = getObj("page", tok.get('pageid'));
	    var width = page.get('width') * FindTok.SQUARE_SIZE, height = page.get('height') * FindTok.SQUARE_SIZE;
	    var scale = page.get('scale_number');
	    // get radius of larger aura (distance to furthest edge), in page units
	    var radius = Math.max(tok.get('left'), width - tok.get('left'));
	    radius = Math.max(radius, tok.get('top'), height - tok.get('top'));
	    radius *= scale / FindTok.SQUARE_SIZE;
	    // determine how many frames in beacon animation and how much aura must shrink each frame
	    var frames = Math.ceil(opts['beaconTime'] / FindTok.BEACON_FRAME);
	    var frameStep = radius / frames;
	    // set up beacon animation data
	    FindTok.beacon = {
		'token':	tok.id,
		'radius':	radius,
		'step':		frameStep,
		'frames':	frames,
		'cycles':	opts['beaconCount'],
		'showPlayers':	opts['playerBeacon'],
		'frame':	0,
		'timer':	null
	    };
	    // cache tok's aura stats so we can revert to them when beacon is done
	    state.FindTok.auraCache = {'token': tok.id};
	    for (var i = 0; i < FindTok.AURA_PROPS.length; i++){
		state.FindTok.auraCache[FindTok.AURA_PROPS[i]] = tok.get(FindTok.AURA_PROPS[i]);
	    }
	    //state.FindTok.auraCache={'aura1_radius':"",'aura2_radius':""};
	    // hand off to beacon animation handler
	    FindTok.updateBeacon();
	}

	if (opts['ping']){
	    // ping requested; ping everyone to tok's location
	    sendPing(tok.get('left'), tok.get('top'), tok.get('pageid'), null, true);
	}
    },

    showHelp: function(who, cmd){
	FindTok.write(cmd + " [options]", who, "", "Find");
	var helpMsg = "Options:\n";
	helpMsg += "  -h, --help          display this help message\n";
	helpMsg += "  -c N, --cycles N    number of beacon cycles\n";
	helpMsg += "                      (default: 3; 0 to disable beacon)\n";
	helpMsg += "  -d N, --duration N  length of each beacon cycle in seconds\n";
	helpMsg += "                      (default: 1)\n";
	helpMsg += "  -a, --all           show beacon to all players\n";
	helpMsg += "                      (default: only show to GM)\n";
	helpMsg += "  -p, --ping          ping token to be found\n";
	helpMsg += "  -t ID, --token ID   find specified token\n";
	helpMsg += "                      (default: token at top of tracker)\n";
	helpMsg += "  -T, --turnchange    use these options every time turn changes\n";
	helpMsg += "                      (default: find token once)\n";
	helpMsg += "  -C, --clear         clear turn-change options\n";
	FindTok.write(helpMsg, who, "font-size: small; font-family: monospace", "Find");
    },

    handleFindMessage: function(tokens, msg){
	var findOpts = {'beaconTime':	1000,
			'beaconCount':	3,
			'playerBeacon':	false,
			'ping':		false};
	var tok = null, setTurnCfg = false, getTime = false, getCount = false, getToken = false, clearTurnCfg = false;
	for (var i = 1; i < tokens.length; i++){
	    if (getTime){
		findOpts['beaconTime'] = Math.round(parseFloat(tokens[i]) * 1000);
		getTime = false;
		continue;
	    }
	    if (getCount){
		findOpts['beaconCount'] = parseInt(tokens[i]);
		getCount = false;
		continue;
	    }
	    if (getToken){
		tok = getObj("graphic", tokens[i]);
		if (!tok){
		    FindTok.write("Error: Unable to find token " + tokens[i], msg.who, "", "Find");
		    return;
		}
		getToken = false;
		continue;
	    }
	    switch (tokens[i]){
	    case "-h":
	    case "--help":
		return FindTok.showHelp(msg.who, tokens[0]);
	    case "-c":
	    case "--cycles":
		getCount = true;
		break;
	    case "-d":
	    case "--duration":
		getTime = true;
		break;
	    case "-a":
	    case "--all":
		findOpts['playerBeacon'] = true;
		break;
	    case "-p":
	    case "--ping":
		findOpts['ping'] = true;
		break;
	    case "-t":
	    case "--token":
		getToken = true;
		break;
	    case "-T":
	    case "--turnchange":
		setTurnCfg = true;
		break;
	    case "-C":
	    case "--clear":
		clearTurnCfg = true;
		break;
	    }
	}
	if ((getTime) || (getCount) || (getToken)){
	    FindTok.write("Error: Missing parameter", msg.who, "", "Find");
	    return FindTok.showHelp(msg.who, tokens[0]);
	}
	if (clearTurnCfg){
	    tok = null;
	    findOpts['beaconCount'] = 0;
	    findOpts['ping'] = false;
	    setTurnCfg = true;
	}
	if ((findOpts['beaconTime'] <= 0) && (findOpts['beaconCount'] > 0)){
	    FindTok.write("Warning: Setting cycles to 0 because duration <= 0", msg.who, "", "Find");
	    findOpts['beaconCount'] = 0;
	}

	if (setTurnCfg){
	    if (tok){
		FindTok.write("Error: Cannot specify token with --turnchange", msg.who, "", "Find");
		return;
	    }
	    if ((findOpts['beaconCount'] > 0) || (findOpts['ping'])){ 
		state.FindTok.turnCfg = findOpts;
	    }
	    else{
		state.FindTok.turnCfg = null;
	    }
	    return;
	}

	if (!tok){
	    var turnOrder = JSON.parse(Campaign().get('turnorder') || "[]");
	    if ((turnOrder) && (turnOrder[0]) && (turnOrder[0].id) && (turnOrder[0].id != "-1")){
		tok = getObj("graphic", turnOrder[0].id);
	    }
	}
	if (!tok){
	    FindTok.write("Error: Unable to get token from turn tracker", msg.who, "", "Find");
	    return;
	}
	FindTok.findToken(tok, findOpts);
    },

    handleChatMessage: function(msg){
	if ((msg.type != "api") || (msg.content.indexOf("!find") !=0 )){ return; }

	return FindTok.handleFindMessage(msg.content.split(" "), msg);
    },

    registerFindTok: function(){
	FindTok.init();
	on("change:campaign:turnorder", FindTok.handleTurnChange);
	on("destroy:graphic", FindTok.handleTokenDelete);
	if ((typeof(Shell) != "undefined") && (Shell) && (Shell.registerCommand)){
	    Shell.registerCommand("!find", "!find [options]", "Locate tokens", FindTok.handleFindMessage);
	    Shell.permissionCommand(["!shell-permission", "add", "!find"], {'who': "gm"});
	    if (Shell.write){
		FindTok.write = Shell.write;
	    }
	}
	else{
	    on("chat:message", FindTok.handleChatMessage);
	}
    }
};

on("ready", function(){ FindTok.registerFindTok(); });
