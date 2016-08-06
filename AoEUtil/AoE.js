var AoEUtil = AoEUtil || {
    CROSSHAIR_IMAGE: "https://s3.amazonaws.com/files.d20.io/images/21660349/y0ZYGERfgSU15XCLcv94zA/thumb.png?1470463643",
    DEFAULT_SIZE: 70,
    GRID_DIMS: {'square': {
			'width': 70,
			'height': 70
			},
		'hex': {
			'width': 37.5992809922301, // half-hex width, to account for offset odd rows
			'height': 66.9658278242677
			},
		'hexr': {
			'width': 69.585127490378,
			'height': 39.84439499 // half-hex height, to account for offset odd columns
			}
		},
    COMP_FUNCS: {'>':	function(x, y){ return x > y; },
		'>=':	function(x, y){ return x >= y; },
		'=':	function(x, y){ return x == y; },
		'==':	function(x, y){ return x == y; },
		'<=':	function(x, y){ return x <= y; },
		'<':	function(x, y){ return x < y; },
		'!=':	function(x, y){ return x != y; }},

    ignoreRemoval: {},

    init: function(){
	if (!state.hasOwnProperty('AoEUtil')){ state.AoEUtil = {}; }
	if (!state.AoEUtil.hasOwnProperty('aimTok')){ state.AoEUtil.aimTok = null; }
	if (!state.AoEUtil.hasOwnProperty('aimRange')){ state.AoEUtil.aimRange = -1; }
	if (!state.AoEUtil.hasOwnProperty('aimSource')){ state.AoEUtil.aimSource = [0, 0]; }
	if (!state.AoEUtil.hasOwnProperty('targets')){ state.AoEUtil.targets = []; }
    },

    write: function(s, who, style, from){
	if (who){
	    who = "/w " + who.split(" ", 1)[0] + " ";
	}
	sendChat(from, who + s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"));
    },

    removeToken: function(tokId){
	var tok = getObj("graphic", tokId);
	if (!tok){ return; }
	AoEUtil.ignoreRemoval[tok.id] = true;
	tok.remove();
    },

    getDistance: function(p0, p1, page){
	var grid = (page.get('showgrid') ? page.get('grid_type') : null);
	var diag = page.get('diagonaltype'), scale = page.get('scale_number');
	var xOff = Math.abs(p1[0] - p0[0]), yOff = Math.abs(p1[1] - p0[1]);
	if (grid){
	    xOff = Math.round(xOff / AoEUtil.GRID_DIMS[grid]['width']);
	    yOff = Math.round(yOff / AoEUtil.GRID_DIMS[grid]['height']);
	}
	else{
	    xOff /= AoEUtil.GRID_DIMS['square']['width'];
	    yOff /= AoEUtil.GRID_DIMS['square']['height'];
	}
	switch (grid){
	case "hexr":
	    // swap x and y, then fall through to hex case
	    var tOff = xOff;
	    xOff = yOff;
	    yOff = tOff;
	    // fall through to hex case
	case "hex":
	    if (xOff > yOff){
		xOff = Math.round((xOff - yOff) / 2);
	    }
	    else{
		xOff = 0;
	    }
	    return (xOff + yOff) * scale;
	case "square":
	    switch (diag){
	    case "foure": return Math.max(xOff, yOff) * scale;
	    case "manhattan": return (xOff + yOff) * scale;
	    case "threefive": return Math.floor(Math.max(xOff, yOff) + (Math.min(xOff, yOff) / 2)) * scale;
	    // Euclidean: fall through to gridless case
	    }
	default:
	    return Math.sqrt((xOff * xOff) + (yOff * yOff)) * scale;
	}
    },

    handleTokenMove: function(tok, prev){
	if (tok.id == state.AoEUtil.aimTok){
	    // tok is aim token; check whether it's within range and set the X icon if not
	    if (state.AoEUtil.aimRange < 0){ return; }
	    var page = getObj("page", tok.get('pageid'));
	    var dist = AoEUtil.getDistance(state.AoEUtil.aimSource, [tok.get('left'), tok.get('top')], page);
	    tok.set({"status_dead": (dist > state.AoEUtil.aimRange)});
	    return;
	}

	// check if tok is a target token or a targeted token; move target token to targeted token if so
	for (var i = 0; i < state.AoEUtil.targets.length; i++){
	    if (tok.id == state.AoEUtil.targets[i].crosshair){
		tok.set({'left': prev.left, 'top': prev.top});
		return;
	    }
	    if (tok.id == state.AoEUtil.targets[i].target){
		var chTok = getObj("graphic", state.AoEUtil.targets[i].crosshair);
		if (chTok){
		    chTok.set({'left': tok.get('left'), 'top': tok.get('top')});
		}
		return;
	    }
	}
    },

    handleTokenDelete: function(tok){
	if (AoEUtil.ignoreRemoval[tok.id]){
	    delete AoEUtil.ignoreRemoval[tok.id];
	    return;
	}

	if (tok.id == state.AoEUtil.aimTok){
	    // tok is aim token; abort aiming
	    state.AoEUtil.aimTok = null;
	    state.AoEUtil.aimRange = -1;
	    state.AoEUtil.aimSource = [0, 0];
	}

	// check if tok is a target token or a targeted token; remove that target if so
	for (var i = 0; i < state.AoEUtil.targets.length; i++){
	    if ((tok.id == state.AoEUtil.targets[i].crosshair) || (tok.id == state.AoEUtil.targets[i].target)){
		state.AoEUtil.targets.splice(i, 1);
		return;
	    }
	}
    },

    showHelp: function(who, cmd, subCmd){
	var usage  = "", helpMsg = "";
	switch (subCmd){
	case "aim":
	    usage += "Usage: " + cmd + " aim [RANGE] [options]\n";
	    usage += "Creates an aim token on top of the selected token for the user to place as desired.\n";
	    helpMsg += "Parameters:\n";
	    helpMsg += "  RANGE  Maximum range to aim point\n";
	    helpMsg += "Options:\n";
	    helpMsg += "  -t ID, --token ID  Token firing effect (default: selected token)\n";
	    break;
	case "fire":
	    usage += "Usage: " + cmd + " fire [RANGE]\n";
	    usage += "Creates target tokens on top of each token within range of the aim token.\n";
	    helpMsg += "If RANGE is not specified, only tokens in the same space will be targeted.\n";
	    break;
	case "save":
	    usage += "Usage: " + cmd + " save ROLL [[COMP] DC] [options]\n";
	    usage += "Rolls a save for each targeted token, marking success or failure on each target overlay.\n";
	    helpMsg += "Parameters:\n";
	    helpMsg += "  ROLL:  Expression to roll for each token.\n";
	    helpMsg += "         Reference attributes like \"${attribute_name}\"\n";
	    helpMsg += "  COMP:  One of >, >=, =, <=, <, != (default: >=)\n";
	    helpMsg += "  DC:    Number against which to compare roll (default: 1)\n";
	    helpMsg += "Options:\n";
	    helpMsg += "  -g, --gm       Only show results to GM; don't show to players controlling targets\n";
	    helpMsg += "  -s, --summary  Show summary to everyone, not just GM\n";
	    helpMsg += "  -f, --full     Show all results to everyone, not just GM and controlling players\n";
	    helpMsg += "  -q, --quiet    Only generate summary; don't list individual results\n";
	    helpMsg += "  -Q, --silent   Don't generate any output; only mark tokens\n";
	    break;
	case "clear":
	    usage += "Usage: " + cmd + " clear\n";
	    usage += "Clears any remaining targeting tokens and removes all associated internal state.\n";
	    helpMsg += "Cleared state cannot be recovered; be sure to record necessary results before clearing.\n";
	    break;
	default:
	    usage += "Usage: " + cmd + " COMMAND [options]";
	    helpMsg += "help [COMMAND]:   display generic or command-specific help\n";
	    helpMsg += "aim [...]:        create a token to aim an effect\n";
	    helpMsg += "fire [RANGE]:     mark targets within the area of an effect\n";
	    helpMsg += "save ROLL [...]:  roll saves for affected targets\n";
	    helpMsg += "clear:            clear targeting tokens and associated state\n";
	}
	AoEUtil.write(usage, who, "", "AoE");
	AoEUtil.write(helpMsg, who, "font-size: small; font-family: monospace", "AoE");
    },

    fixupCommand: function(cmd, inlineRolls){
	function replaceInlines(s){
	    if (!inlineRolls){ return s; }
	    var i = parseInt(s.substring(3, s.length - 2));
	    if ((i < 0) || (i >= inlineRolls.length) || (!inlineRolls[i]) || (!inlineRolls[i]['expression'])){ return s; }
	    return "[[" + inlineRolls[i]['expression'] + "]]";
	}
	return cmd.replace(/\$\[\[\d+\]\]/g, replaceInlines);
    },

    doAim: function(tok, range){
	if (!tok){ return "Error: Aim command requires a token."; }
	var aimTok = createObj("graphic", {'_subtype':		"token",
					    '_pageid':		tok.get('pageid'),
					    'imgsrc':		AoEUtil.CROSSHAIR_IMAGE,
					    'left':		tok.get('left'),
					    'top':		tok.get('top'),
					    'width':		AoEUtil.DEFAULT_SIZE,
					    'height':		AoEUtil.DEFAULT_SIZE,
					    'layer':		tok.get('layer'),
					    'controlledby':	tok.get('controlledby'),
					    'showname':		false,
					    'showplayers_name':	false});
	if (!aimTok){ return "Error: Failed to create aim token."; }
	toFront(aimTok);
	state.AoEUtil.aimTok = aimTok.id;
	state.AoEUtil.aimRange = range;
	state.AoEUtil.aimSource = [tok.get('left'), tok.get('top')];
    },

    doFire: function(range){
	if (!state.AoEUtil.aimTok){ return "Error: Fire command requires prior aim command."; }
	var aimTok = getObj("graphic", state.AoEUtil.aimTok);
	if (!aimTok){ return "Error: Failed to get aim token."; }
	if (range < 0){ range = 0; }
	var aimPoint = [aimTok.get('left'), aimTok.get('top')];
	var page = getObj("page", aimTok.get('pageid'));
	var toks = findObjs({'_type': "graphic", '_pageid': aimTok.get('pageid')}) || [];
	for (var i = 0; i < toks.length; i++){
	    if (toks[i].id == aimTok.id){ continue; }
	    if (AoEUtil.getDistance(aimPoint, [toks[i].get('left'), toks[i].get('top')], page) > range){
		continue;
	    }
	    var chSize = Math.max(toks[i].get('width'), toks[i].get('height'));
	    var chTok = createObj("graphic", {'subtype':	"token",
					    '_pageid':		toks[i].get('pageid'),
					    'imgsrc':		AoEUtil.CROSSHAIR_IMAGE,
					    'left':		toks[i].get('left'),
					    'top':		toks[i].get('top'),
					    'width':		chSize,
					    'height':		chSize,
					    'layer':		toks[i].get('layer'),
					    'controlledby':	aimTok.get('controlledby'),
					    'showname':		false,
					    'showplayers_name':	false});
	    if (!chTok){ return "Error: Failed to create target token."; }
	    toFront(chTok);
	    state.AoEUtil.targets.push({'crosshair': chTok.id, 'target': toks[i].id});
	}
	AoEUtil.removeToken(state.AoEUtil.aimTok);
	state.AoEUtil.aimTok = null;
    },

    doSave: function(roll, compFunc, dc, results, summary){
	var err;

	state.AoEUtil.summary = {'need': state.AoEUtil.targets.length, 'pass': 0, 'fail': 0, 'error': 0, 'total': 0};
/////
//
	//figure out attributes we'll need for roll spec
//
/////
	for (var i = 0; i < state.AoEUtil.targets.length; i++){
	    var chTok = getObj("graphic", state.AoEUtil.targets[i].crosshair);
	    var tok = getObj("graphic", state.AoEUtil.targets[i].target);
	    if ((!chTok) || (!tok)){
		err = "Error: Unable to locate target token.";
		continue;
	    }
	    chTok.set({'statusmarkers': "stopwatch"});
	    var saveCB = function(chTok, tok, msg){
		var status, res = (tok.get('name') + ": ") || "Unnamed token: ";
		if ((!msg) || (!msg[0]) || (!msg[0].inlinerolls) || (!msg[0].inlinerolls[0]) || (!msg[0].inlinerolls[0].results)){
		    status = "spanner";
		    res += "Failed to determine result.";
		    state.AoEUtil.summary.error += 1;
		}
		else if (compFunc(msg[0].inlinerolls[0].results.total, dc)){
		    status = "angel-outfit";
		    res += msg[0].inlinerolls[0].results.total + " vs. " + dc + ": Success";
		    state.AoEUtil.summary.pass += 1;
		}
		else{
		    status = "skull";
		    res += msg[0].inlinerolls[0].results.total + " vs. " + dc + ": Failure";
		    state.AoEUtil.summary.fail += 1;
		}
		state.AoEUtil.summary.total += 1;
		chTok.set({'statusmarkers': status})
		// send results if necessary
		var toArray = [];
		switch (results){
		case "owner":
		    toArray = (tok.get('controlledby') || "").split(',');
		    if (!toArray[0]){ toArray.pop(); }
		    // fall through to add GM too
		case "gm":
		    toArray.push("gm");
		    break;
		case "all":
		    toArray = [null];
		    break;
		}
		while (toArray.length > 0){
		    var to = toArray.pop();
		    AoEUtil.write(res, to, "", "AoE");
		}
		if (state.AoEUtil.summary.total >= state.AoEUtil.summary.need){
		    // send summary if necessary
		    if ((summary == "gm") || (summary == "all")){
			var sum = "&{template:default} {{name=AoE Saves}}";
			sum += "{{Saved=" + state.AoEUtil.summary.pass;
			sum += "}} {{Failed=" + state.AoEUtil.summary.fail;
			sum += "}} {{Targets=" + state.AoEUtil.summary.total;
			if (state.AoEUtil.summary.error > 0){
			    sum += "}} {{Errors=" + state.AoEUtil.summary.error;
			}
			sum += "}}";
			AoEUtil.write(sum, (summary == "gm" ? "gm" : ""), "", "AoE");
		    }
		}
	    };
/////
//
	    //look up attributes for state.AoEUtil.targets[i].target; error=>set status_spanner on tok
	    //cmd = "[["+substitute attributes into roll+"]]"
	    var cmd = "[[" + roll + "]]";
//
/////
	    sendChat("AoE", cmd, saveCB.bind(undefined, chTok, tok));
	}
	return err;
    },

    doClear: function(){
	if (state.AoEUtil.aimTok){
	    AoEUtil.removeToken(state.AoEUtil.aimTok);
	    state.AoEUtil.aimTok = null;
	}
	state.AoEUtil.aimRange = -1;
	state.AoEUtil.aimSource = [0, 0];
	while (state.AoEUtil.targets.length > 0){
	    var tgt = state.AoEUtil.targets.pop();
	    AoEUtil.removeToken(tgt.crosshair);
	}
    },

    handleAoEMessage: function(tokens, msg){
	if (tokens.length < 2){
	    return AoEUtil.showHelp(msg.who, tokens[0], null);
	}
	var inlineRolls = msg.inlinerolls || [];
	var err;
	switch (tokens[1]){
	case "help":
	    return AoEUtil.showHelp(msg.who, tokens[0], null);
	case "aim":
	    var tok = null, range = -1, force = false, getTok = false;
	    for (var i = 2; i < tokens.length; i++){
		if (getTok){
		    tok = getObj("graphic", tokens[i]);
		    if (!tok){
			err = "Error: Token " + tokens[i] + " not found";
			break;
		    }
		    getTok = false;
		    continue;
		}
		if ((tokens[i] == "-t") || (tokens[i] == "--token")){
		    getTok = true;
		    continue;
		}
		if (tokens[i] == "--force"){
		    force = true;
		}
		if (range < 0){
		    range = parseInt(AoEUtil.fixupCommand(tokens[i], inlineRolls))
		    continue;
		}
		err = "Error: Unrecognized argument: " + tokens[i];
		break;
	    }
	    if (err){ break; }
	    if ((!tok) && (msg.selected)){
		for (var i = 0; i < msg.selected.length; i++){
		    tok = getObj(msg.selected[i]._type, msg.selected[i]._id);
		    if (tok){ break; }
		}
	    }
	    if (!tok){
		err = "Error: Aim command requires a token.";
		break;
	    }
	    if ((state.AoEUtil.aimTok) || (state.AoEUtil.targets.length > 0)){
		if (force){
		    err = AoEUtil.doClear();
		}
		else{
		    err = "Warning: Already existing targets.  Clear?\n";
		    err += "[Yes](" + tokens[0] + " " + tokens[1] + " -t " + tok.id + " " + range + " --force)";
		}
	    }
	    if (!err){
		err = AoEUtil.doAim(tok, range);
	    }
	    break;
	case "fire":
	    if (!state.AoEUtil.aimTok){
		err = "Error: Fire command requires prior aim command.";
		break;
	    }
	    var range = (tokens.length > 2 ? parseInt(AoEUtil.fixupCommand(tokens[2], inlineRolls)) : 0);
	    if (tokens.length > 3){
		err = "Error: Unrecognized argument: " + tokens[3];
		break;
	    }
	    err = AoEUtil.doFire(range);
	    break;
	case "save":
	    if (tokens.length < 3){
		err = "Error: Save command requires a roll specification.";
		break;
	    }
	    if (state.AoEUtil.targets.length <= 0){
		err = "Error: No tokens targeted.";
		break;
	    }
	    var roll = null, comp = ">=", dc = 1, results = "owner", summary = "gm";
	    var gotRoll = false, gotDc = false, gotComp = false;
	    for (var i = 2; i < tokens.length; i++){
		switch (tokens[i]){
		case "-g":
		case "--gm":
		    results = "gm";
		    break;
		case "-s":
		case "--summary":
		    summary = "all";
		    break;
		case "-f":
		case "--full":
		    results = "all";
		    summary = "all";
		    break;
		case "-q":
		case "--quiet":
		    results = "none";
		    break;
		case "-Q":
		case "--silent":
		    results = "none";
		    summary = "none";
		    break;
		default:
		    if (!gotRoll){
			roll = AoEUtil.fixupCommand(tokens[i]);
			gotRoll = true;
		    }
		    else if (!gotDc){
			dc = AoEUtil.fixupCommand(tokens[i]);
			gotDc = true;
		    }
		    else if (!gotComp){
			comp = dc;
			dc = AoEUtil.fixupCommand(tokens[i]);
			gotComp = true;
		    }
		    else{
			err = "Error: Unrecognized argument: " + tokens[i];
			break;
		    }
		}
	    }
	    if (err){ break; }
	    if (!gotRoll){
		err = "Error: Save command requires a roll specification.";
		break;
	    }
	    if (gotDc){
		var tDc = parseInt(dc);
		if (isNaN(tDc)){
		    err = "Error: Invalid DC: " + tDc;
		    break;
		}
		dc = tDc;
	    }
	    if (!AoEUtil.COMP_FUNCS[comp]){
		err = "Error: Invalid comparison operator: " + comp;
		break;
	    }
	    comp = AoEUtil.COMP_FUNCS[comp];
	    err = AoEUtil.doSave(roll, comp, dc, results, summary);
	    break;
	case "clear":
	    err = AoEUtil.doClear();
	    if (!err){
		AoEUtil.write("Cleared", msg.who, "", "AoE");
	    }
	    break;
	default:
	    AoEUtil.write("Error: Unrecognized command: " + tokens[1], who, "", "AoE");
	    return AoEUtil.showHelp(msg.who, tokens[0], null);
	}
	if (typeof(err) == typeof("")){
	    AoEUtil.write(err, msg.who, "", "AoE");
	}
    },

    handleChatMessage: function(msg){
	if ((msg.type != "api") || (msg.content.indexOf("!aoe") !=0 )){ return; }

	return AoEUtil.handleAoEMessage(msg.content.split(" "), msg);
    },

    registerAoEUtil: function(){
	AoEUtil.init();
	on("change:graphic", AoEUtil.handleTokenMove); //maybe change:graphic:left and change:graphic:top
	on("destroy:graphic", AoEUtil.handleTokenDelete);
	if ((typeof(Shell) != "undefined") && (Shell) && (Shell.registerCommand)){
	    Shell.registerCommand("!aoe", "!aoe <command> [options]", "Aim and fire AoE effects", AoEUtil.handleAoEMessage);
	    Shell.permissionCommand(["!shell-permission", "add", "!aoe"], {'who': "gm"});
	    if (Shell.write){
		AoEUtil.write = Shell.write;
	    }
	}
	else{
	    on("chat:message", AoEUtil.handleChatMessage);
	}
    }
};

on("ready", function(){ AoEUtil.registerAoEUtil(); });
