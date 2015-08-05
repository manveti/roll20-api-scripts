var TurnTable = TurnTable || {
    OBJ_PROPS: {
	'page':		['showgrid', 'showdarkness', 'showlighting', 'snapping_increment', 'grid_opacity', 'fog_opacity',
			'background_color', 'gridcolor', 'grid_type', 'scale_number', 'scale_units', 'gridlabels', 'diagonaltype',
			'archived', 'lightupdatedrop', 'lightenforcelos', 'lightrestrictmove', 'lightglobalillum'],
	'path':		['path', 'fill', 'stroke', 'layer', 'stroke_width', 'width', 'height', 'scaleX', 'scaleY', 'controlledby'],
	'text':		['width', 'height', 'text', 'font_size', 'color', 'font_family', 'layer', 'controlledby'],
	'graphic':	['subtype', 'imgsrc', 'bar1_link', 'bar2_link', 'bar3_link', 'represents', 'width', 'height', 'layer', 'isdrawing',
			'flipv', 'fliph', 'name', 'controlledby', 'bar1_value', 'bar2_value', 'bar3_value', 'bar1_max', 'bar2_max', 'bar3_max',
			'aura1_radius', 'aura2_radius', 'aura1_color', 'aura2_color', 'aura1_square', 'aura2_square', 'tint_color',
			'statusmarkers', 'showname', 'showplayers_name', 'showplayers_bar1', 'showplayers_bar2', 'showplayers_bar3',
			'showplayers_aura1', 'showplayers_aura2', 'playersedit_name', 'playersedit_bar1', 'playersedit_bar2', 'playersedit_bar3',
			'playersedit_aura1', 'playersedit_aura2', 'light_radius', 'light_dimradius', 'light_otherplayers', 'light_hassight',
			'light_angle', 'light_losangle', 'light_multiplier']
    },

    GRID_SIZE: 70,

    ignoreChange: {},
    ignoreDelete: {},

    init: function(){
	if (!state.hasOwnProperty('TurnTable')){ state.TurnTable = {}; }
	if (!state.TurnTable.hasOwnProperty('groups')){ state.TurnTable.groups = {}; }
    },

    transformCoords: function(x, y, fromPage, toPage){
	if ((!state.TurnTable.groups[fromPage]) || (!state.TurnTable.groups[toPage]) || (fromPage == toPage)){
	    return [x, y, 0];
	}
	var fromIdx = state.TurnTable.groups[fromPage].indexOf(fromPage),
	    toIdx = state.TurnTable.groups[fromPage].indexOf(toPage),
	    n = state.TurnTable.groups[fromPage].length;
	if ((fromIdx < 0) || (fromIdx >= n) || (toIdx < 0) || (toIdx >= n) || (fromIdx == toIdx)){
	    return [x, y, 0];
	}

	var page = getObj("page", fromPage);
	if (!page){
	    return [x, y, 0];
	}
	var fromWidth = page.get('width') * TurnTable.GRID_SIZE, fromHeight = page.get('height') * TurnTable.GRID_SIZE;
	page = getObj("page", toPage);
	if (!page){
	    return [x, y, 0];
	}
	var toWidth = page.get('width') * TurnTable.GRID_SIZE, toHeight = page.get('height') * TurnTable.GRID_SIZE;

	var offset = (n + toIdx - fromIdx) % n;
	var offsetDeg = offset * 360 / n;
/////
//
	//rotate [x,y] offsetDeg degrees clockwise about centroid: subtract old centroid, rotate, add new centroid
	switch (n){
	case 4:
	    if (offset == 1){
		return [fromHeight - y, x, offsetDeg];
	    }
	    else if (offset == 3){
		return [y, fromWidth - x, offsetDeg];
	    }
	    // else fall through to 2 case
	case 2:
	    return [fromWidth - x, fromHeight - y, offsetDeg];
	default:
	    return [x, y, offsetDeg];
	}
//
/////
    },

    findAnalogues: function(obj){
	function getObjProp(p){
	    if (obj.get){
		return obj.get(p);
	    }
	    if ((!obj.hasOwnProperty(p)) && (obj.hasOwnProperty("_" + p))){
		return obj["_" + p];
	    }
	    return obj[p];
	}
	var propList = TurnTable.OBJ_PROPS[getObjProp('type')];
	var identProps = {'type': getObjProp('type')};
	for (var i = 0; i < propList.length; i++){
	    identProps[propList[i]] = getObjProp(propList[i]);
	}
	var pageList = state.TurnTable.groups[getObjProp('pageid')];
	var byPage = {};
	for (var i = 0; i < pageList.length; i++){
	    if (pageList[i] == getObjProp('pageid')){ continue; }
	    byPage[pageList[i]] = [];
	}
	var potentialObjs = findObjs(identProps) || [];
	for (var i = 0; i < potentialObjs.length; i++){
	    var objPage = potentialObjs[i].get('pageid');
	    if (!byPage.hasOwnProperty(objPage)){ continue; }
	    byPage[objPage].push(potentialObjs[i]);
	}
	var retval = {'objs': [], 'empty': [], 'ambiguous': {}};
	for (var p in byPage){
	    if (!byPage.hasOwnProperty(p)){ continue; }
	    if (byPage[p].length <= 0){
		retval.empty.push(p);
		continue;
	    }
	    if (byPage[p].length == 1){
		retval.objs.push(byPage[p][0]);
		continue;
	    }
	    var rotCoords = TurnTable.transformCoords(getObjProp('left'), getObjProp('top'), getObjProp('pageid'), p);
	    var x = rotCoords[0], y = rotCoords[1], r = (getObjProp('rotation') + rotCoords[2] + 360) % 360;
	    var newMatches = [];
	    for (var i = 0; i < byPage[p].length; i++){
		if ((byPage[p][i].get('left') != x) || (byPage[p][i].get('top') != y)){ continue; }
		if ((byPage[p][i].get('rotation') + 360) % 360 != r){ continue; }
		newMatches.push(byPage[p][i]);
	    }
	    if (newMatches.length <= 0){
		retval.empty.push(p);
		continue;
	    }
	    if (newMatches.length == 1){
		retval.objs.push(newMatches[0]);
		continue;
	    }
	    retval.ambiguous[p] = newMatches;
	}
	return retval;
    },

    handleObjCreate: function(obj){
	if (!TurnTable.OBJ_PROPS[obj.get('type')]){
	    return;
	}
	if (!state.TurnTable.groups[obj.get('pageid')]){ return; }

	var propList = TurnTable.OBJ_PROPS[obj.get('type')];
	var newProps = {};
	for (var i = 0; i < propList.length; i++){
	    newProps[propList[i]] = obj.get(propList[i]);
	}

	var pages = state.TurnTable.groups[obj.get('pageid')];
	for (var i = 0; i < pages.length; i++){
	    if (pages[i] == obj.get('pageid')){ continue; }
	    newProps['_pageid'] = pages[i];
	    var rotCoords = TurnTable.transformCoords(obj.get('left'), obj.get('top'), obj.get('pageid'), pages[i]);
	    newProps['left'] = rotCoords[0];
	    newProps['top'] = rotCoords[1];
	    newProps['rotation'] = (obj.get('rotation') + rotCoords[2] + 360) % 360;
	    var newObj = createObj(obj.get('type'), newProps);
	    if (!newObj){
/////
//
		//report unable to create object
//
/////
	    }
	}
    },

    handleObjChange: function(obj, prev){
	if (!TurnTable.OBJ_PROPS[obj.get('type')]){
	    return;
	}
	if (TurnTable.ignoreChange[obj.id]){
	    delete TurnTable.ignoreChange[obj.id];
	    return;
	}
	if (!state.TurnTable.groups[obj.get('pageid')]){ return; }

	var propList = TurnTable.OBJ_PROPS[obj.get('type')];
	var newProps = {};
	for (var i = 0; i < propList.length; i++){
	    newProps[propList[i]] = obj.get(propList[i]);
	}

	var analogues = TurnTable.findAnalogues(prev);
/////
//
	//report analogues.empty and .ambiguous
//
/////
	for (var i = 0; i < analogues.objs.length; i++){
	    var rotCoords = TurnTable.transformCoords(obj.get('left'), obj.get('top'), obj.get('pageid'), analogues.objs[i].get('pageid'));
	    newProps['left'] = rotCoords[0];
	    newProps['top'] = rotCoords[1];
	    newProps['rotation'] = (obj.get('rotation') + rotCoords[2] + 360) % 360;
	    analogues.objs[i].set(newProps);
	}
    },

    handleObjDelete: function(obj){
	if (!TurnTable.OBJ_PROPS[obj.get('type')]){
	    return;
	}
	if (TurnTable.ignoreDelete[obj.id]){
	    delete TurnTable.ignoreDelete[obj.id];
	    return;
	}
	if (!state.TurnTable.groups[obj.get('pageid')]){ return; }

	var analogues = TurnTable.findAnalogues(obj);
/////
//
	//report analogues.empty and .ambiguous
//
/////
	for (var i = 0; i < analogues.objs.length; i++){
	    TurnTable.ignoreDelete[analogues.objs[i].id] = true;
	    analogues.objs[i].remove();
	}
    },

    write: function(s, who, style, from){
	if (who){
	    who = "/w " + who.split(" ", 1)[0] + " ";
	}
	sendChat(from, who + s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"));
    },

    showHelp: function(who, cmd, subCmd){
	var usage  = "", helpMsg = "";
	switch (subCmd){
/////
//
//	case "spin":
//	    usage += "Usage: " + cmd + " " + subCmd + " N [options]\n";
//	    usage += "Create N-1 copies of a page, each rotated by 360/N degrees.\n";
//	    helpMsg += "Parameters:\n";
//	    helpMsg += "  N:            Total number of pages, including original and rotated copies\n";
//	    helpMsg += "Options:\n";
//	    helpMsg += "  -p P, --page P        ID or name (must be unique) of page to spin\n";
//	    helpMsg += "  -P, --playerpage      Spin page with player ribbon\n";
//	    helpMsg += "                        If no page is specified, page with selected token will be spun.\n";
//	    helpMsg += "                        If no token is selected, page with player ribbon will be spun.\n";
//	    break;
//
/////
	case "link":
	    usage += "Usage: " + cmd + " " + subCmd + " [PAGE 1] ... [PAGE N] [options]\n";
	    usage += "Link two or more specified pages together as rotated versions of a page.\n";
	    helpMsg += "Parameters:\n";
	    helpMsg += "  PAGE:         ID or names (each must be unique) of pages to link together.\n";
	    helpMsg += "Options:\n";
	    helpMsg += "  -P, --playerpage      Include page with player ribbon among linked pages.\n";
	    helpMsg += "  -S, --selectedpage    Include page with selected token among linked pages.\n";
	    helpMsg += "  -a NAME, --all NAME   Include all pages with the specified name.\n";
	    break;
	case "unlink":
	    usage += "Usage: " + cmd + " " + subCmd + " [PAGE] [options]\n";
	    usage += "Unlink pages linked to the specified page.\n";
	    helpMsg += "Parameters:\n";
	    helpMsg += "  PAGE:         ID or name (must be unique) of a page in group to unlink\n";
	    helpMsg += "Options:\n";
	    helpMsg += "  -P, --playerpage      Unlink group containing page with player ribbon\n";
	    helpMsg += "                        If no page is specified, group containing page with selected token will be unlinked.\n";
	    helpMsg += "                        If no token is selected, group containing page with player ribbon will be unlinked.\n";
	    break;
	case "sync":
	    usage += "Usage: " + cmd + " " + subCmd + " [PAGE] [options]\n";
	    usage += "Synchronize pages linked to the specified page.\n";
	    helpMsg += "Parameters:\n";
	    helpMsg += "  PAGE:         ID or name (must be unique) of master page\n";
	    helpMsg += "Options:\n";
	    helpMsg += "  -P, --playerpage      Use page with player ribbon as master\n";
	    helpMsg += "                        If no page is specified, page with selected token will be used as master.\n";
	    helpMsg += "                        If no token is selected, page with player ribbon will be used as master.\n";
	    break;
	default:
	    usage += "Usage: " + cmd + " COMMAND [options]";
	    helpMsg += "help [COMMAND]:         display generic or command-specific help\n";
	    helpMsg += "spin N [...]:           create N-1 copies of a page, each rotated by 360/N degrees\n";
	    helpMsg += "link [...]:             link multiple pages together as rotated versions of one page\n";
	    helpMsg += "unlink [...]:           remove links between pages linked to specified page\n";
	    helpMsg += "sync [PAGE] [...]:      synchronize pages linked to a specified page\n";
	}
	TurnTable.write(usage, who, "", "TT");
	if (helpMsg){ TurnTable.write(helpMsg, who, "font-size: small; font-family: monospace", "TT"); }
    },

    getPages: function(pageSpec){
	var retval = getObj("page", pageSpec);
	if (retval){ return retval; }
	return findObjs({_type: "page", name: pageSpec}) || [];
    },

    getPage: function(pageSpec){
	var retval = TurnTable.getPages(pageSpec);
	if (typeof(retval) == typeof([])){
	    if (retval.length > 1){
		return "Error: More than one page has specified name";
	    }
	    return retval[0];
	}
	return retval;
    },

    syncPages: function(page){
	var pagePropList = TurnTable.OBJ_PROPS['page'];
	var pageProps = {};
	for (var i = 0; i < pagePropList.length; i++){
	    pageProps[pagePropList[i]] = page.get(pagePropList[i]);
	}
	var pages = state.TurnTable.groups[page.id];
	for (var i = 0; i < pages.length; i++){
	    if (pages[i] == page.id){ continue; }
/////
//
	    //set pageProps['width'] and ['height'] based on necessary geometry
	    if ((pages.length == 4) && (i != 2)){
		pageProps['width'] = page.get('height');
		pageProps['height'] = page.get('width');
	    }
	    else{
		pageProps['width'] = page.get('width');
		pageProps['height'] = page.get('height');
	    }
//
/////
	    var newPage = getObj("page", pages[i]);
	    if (!newPage){
/////
//
		log("couldn't get page "+pages[i]);
		continue;
		//report unable to get page
//
/////
	    }
	    newPage.set(pageProps);
	}

	var missing = {};
	for (var objType in TurnTable.OBJ_PROPS){
	    if (!TurnTable.OBJ_PROPS.hasOwnProperty(objType)){ continue; }
	    if (objType == 'page'){ continue; }
	    var propList = TurnTable.OBJ_PROPS[objType];
	    var pageObjs = findObjs({'_type': objType, '_pageid': page.id}) || [];
	    for (var i = 0; i < pageObjs.length; i++){
		var newProps = {};
		for (var j = 0; j < propList.length; j++){
		    newProps[propList[j]] = pageObjs[i].get(propList[j]);
		}
		var analogues = TurnTable.findAnalogues(pageObjs[i]);
		var x = pageObjs[i].get('left'), y = pageObjs[i].get('top');
		for (var j = 0; j < analogues.objs.length; j++){
		    var rotCoords = TurnTable.transformCoords(x, y, page.id, analogues.objs[j].get('pageid'));
		    newProps['left'] = rotCoords[0];
		    newProps['top'] = rotCoords[1];
		    newProps['rotation'] = (pageObjs[i].get('rotation') + rotCoords[2] + 360) % 360;
		    analogues.objs[j].set(newProps);
		}
		for (var j = 0; j < analogues.empty.length; j++){
		    newProps['_pageid'] = analogues.empty[j];
		    var rotCoords = TurnTable.transformCoords(x, y, page.id, analogues.empty[j]);
		    newProps['left'] = rotCoords[0];
		    newProps['top'] = rotCoords[1];
		    newProps['rotation'] = (pageObjs[i].get('rotation') + rotCoords[2] + 360) % 360;
		    var newObj = createObj(objType, newProps);
		    if (!newObj){
			if (!missing.hasOwnProperty(analogues.empty[j])){ missing[analogues.empty[j]] = {}; }
			if (!missing[analogues.empty[j]].hasOwnProperty(objType)){ missing[analogues.empty[j]][objType] = []; }
			missing[analogues.empty[j]][objType].push(pageObjs[i].id);
		    }
		    TurnTable.ignoreChange[newObj.id] = true;
		}
		for (var pageId in analogues.ambiguous){
		    if (!analogues.ambiguous.hasOwnProperty(pageId)){ continue; }
/////
//
		    //report ambiguous objects
		    if (!missing.hasOwnProperty(pageId)){ missing[pageId] = {}; }
		    if (!missing[pageId].hasOwnProperty(objType)){ missing[pageId][objType] = []; }
		    missing[pageId][objType].push(pageObjs[i].id);
//
/////
		}
	    }
	}

	return missing;
    },

    spinPage: function(page, n){
	if (state.TurnTable.groups[page.id]){
	    return "Error: Page " + page.id + " already in a group";
	}
	state.TurnTable.groups[page.id] = [page.id];
	var props = {'name': page.get('name'), 'width': page.get('width'), 'height': page.get('height')};
	for (var i = 0; i < TurnTable.OBJ_PROPS['page'].length; i++){
	    props[TurnTable.OBJ_PROPS['page'][i]] = page.get(TurnTable.OBJ_PROPS['page'][i]);
	}
	for (var i = 1; i < n; i++){
	    if (n == 4){
		if (i == 2){
		    props['width'] = page.get('width');
		    props['height'] = page.get('height');
		}
		else {
		    props['width'] = page.get('height');
		    props['height'] = page.get('width');
		}
	    }
	    var newPage = createObj("page", props);
	    if (!newPage){
		for (i -= 1; i > 0; i--){
		    var pgId = state.TurnTable.groups[page.id][i];
		    delete state.TurnTable.groups[pgId];
		    var p = getObj("page", pgId);
		    if (p){ p.remove(); }
		}
		delete state.TurnTable.groups[page.id];
		return "Error: Failed to create page";
	    }
	    state.TurnTable.groups[newPage.id] = state.TurnTable.groups[page.id];
	    state.TurnTable.groups[page.id].push(newPage);
	}
	return TurnTable.syncPages(page);
    },

    linkPages: function(pages){
	var pageIds = [];
	for (var i = 0; i < pages.length; i++){
	    if (state.TurnTable.groups[pages[i].id]){
		return "Error: Page " + pages[i].id + " already in a group";
	    }
	    pageIds.push(pages[i].id);
	}
	for (var i = 0; i < pages.length; i++){
	    state.TurnTable.groups[pages[i].id] = pageIds;
	}
    },

    unlinkPages: function(page){
	if (!state.TurnTable.groups[page.id]){
	    return "Error: Page " + page.id + " not in a group";
	}
	var groups = state.TurnTable.groups[page.id];
	for (var i = groups.length - 1; i >= 0; i--){
	    delete state.TurnTable.groups[groups[i]];
	}
    },

    handleTurnTableMessage: function(tokens, msg){
	if (tokens.length < 2){
	    return TurnTable.showHelp(msg.who, tokens[0], null);
	}

	var args = {}, posArgs = [];
	var getArg = null;
	for (var i = 2; i < tokens.length; i++){
	    if (getArg){
		if (getArg == "help"){
		    return TurnTable.showHelp(msg.who, tokens[0], tokens[i]);
		}
		if (getArg == "allPages"){
		    if (!args[getArg]){ args[getArg] = []; }
		    args[getArg].push(tokens[i]);
		}
		else{ args[getArg] = tokens[i]; }
		getArg = null;
		continue;
	    }
	    switch (tokens[i]){
	    case "-p":
	    case "--page":
		getArg = 'page';
		break;
	    case "-P":
	    case "--playerpage":
		args['page'] = Campaign().get('playerpageid');
		break;
	    case "-S":
	    case "--selectedpage":
		args['selPage'] = true;
		break;
	    case "-a":
	    case "--all":
		getArg = 'allPages';
		break;
	    case "-h":
	    case "--help":
		getArg = 'help';
		break;
	    default:
		posArgs.push(tokens[i]);
	    }
	}
	if (tokens[1] == "help"){
	    return TurnTable.showHelp(msg.who, tokens[0], tokens[2]);
	}
	if (getArg){
	    TurnTable.write("Error: Expected argument for " + getArg, msg.who, "", "TT");
	    return TurnTable.showHelp(msg.who, tokens[0], null);
	}

	var err;
	switch (tokens[1]){
	case "spin":
/////
//
	    err = "Error: The 'spin' subcommand requires page creation, which is not currently supported by the Roll20 API";
	    break;
//
/////
	    if (!posArgs[0]){
		TurnTable.write("Error: Must specify number of rotated pages", msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
	    var n = parseInt(posArgs[0]);
	    if (!n){
		TurnTable.write("Error: Invalid number of rotated pages: " + posArgs[0], msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
/////
//
	    if ((n != 2) && (n != 4)){
		TurnTable.write("Error: Only 2 and 4 rotated pages currently supported", msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
//
/////
	    if (n < 2){
		TurnTable.write("Error: Group must contain at least two pages", msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
	    if (posArgs.length > 1){
		TurnTable.write("Error: Unrecognized argument: " + posArgs[1], msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
	    var page;
	    if (args['page']){
		page = TurnTable.getPage(args['page']);
		if (typeof(page) == typeof("")){
		    err = page;
		    break;
		}
		if (!page){
		    err = "Error: Unable to locate page " + args['page'];
		    break;
		}
	    }
	    else if (msg.selected){
		for (var i = 0; i < msg.selected.length; i++){
		    var tok = getObj(msg.selected[i]._type, msg.selected[i]._id);
		    if (tok){
			page = getObj("page", tok.get('pageid'));
			if (page){ break; }
		    }
		}
	    }
	    else{
		page = getObj("page", Campaign().get('playerpageid'));
	    }
	    if (!page){
		err = "Error: Unable to determine page to spin";
		break;
	    }
	    err = TurnTable.spinPage(page, n);
	    if (!err){
		TurnTable.write("Linked " + n + " pages together.", msg.who, "", "TT");
	    }
	    else if (typeof(err) == typeof({})){
/////
//
		//warn about missing objects
		TurnTable.write("Warning: Some objects couldn't be synched.", msg.who, "", "TT");
//
/////
	    }
	    break;
	case "link":
	    var pages = [];
	    for (var i = 0; i < posArgs.length; i++){
		var page = TurnTable.getPage(posArgs[i]);
		if (typeof(page) == typeof("")){
		    TurnTable.write(page, msg.who, "", "TT");
		    return;
		}
		if (!page){
		    TurnTable.write("Error: Unable to locate page " + posArgs[i], msg.who, "", "TT");
		    return;
		}
		pages.push(page);
	    }
	    if (args['page']){
		var page = TurnTable.getPage(args['page']);
		if (typeof(page) == typeof("")){
		    err = page;
		    break;
		}
		if (!page){
		    err = "Error: Unable to locate page " + args['page'];
		    break;
		}
		pages.push(page);
	    }
	    if ((args['selPage']) && (msg.selected)){
		for (var i = 0; i < msg.selected.length; i++){
		    var tok = getObj(msg.selected[i]._type, msg.selected[i]._id);
		    if (tok){
			page = getObj("page", tok.get('pageid'));
			if (page){ pages.push(page); }
		    }
		}
	    }
	    if (args['allPages']){
		for (var i = 0; i < args['allPages'].length; i++){
		    var newPages = TurnTable.getPages(args['allPages'][i]);
		    if (typeof(newPages) == typeof("")){
			TurnTable.write(page, msg.who, "", "TT");
			return;
		    }
		    else if (typeof(newPages) == typeof([])){
			pages = pages.concat(newPages);
		    }
		    else if (newPages){
			pages.push(newPages);
		    }
		    else{
			TurnTable.write("Error: Unable to locate any pages named " + args['allPages'][i], msg.who, "", "TT");
			return;
		    }
		}
	    }
	    pages = _.uniq(pages);
/////
//
	    if ((pages.length != 2) && (pages.length != 4)){
		TurnTable.write("Error: Only 2 and 4 rotated pages currently supported", msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
//
/////
	    if (pages.length < 2){
		TurnTable.write("Error: Group must contain at least two pages", msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
	    err = TurnTable.linkPages(pages);
	    if (!err){
		TurnTable.write("Linked " + pages.length + " pages together.", msg.who, "", "TT");
		TurnTable.write("Please use sync subcommand to synchronize linked pages.", msg.who, "", "TT");
	    }
	    break;
	case "unlink":
	    if (posArgs.length > 1){
		TurnTable.write("Error: Unrecognized argument: " + posArgs[1], msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
	    var page;
	    if (posArgs.length > 0){
		args['page'] = posArgs[0];
	    }
	    if (args['page']){
		page = TurnTable.getPage(args['page']);
		if (typeof(page) == typeof("")){
		    err = page;
		    break;
		}
		if (!page){
		    err = "Error: Unable to locate page " + args['page'];
		    break;
		}
	    }
	    else if (msg.selected){
		for (var i = 0; i < msg.selected.length; i++){
		    var tok = getObj(msg.selected[i]._type, msg.selected[i]._id);
		    if (tok){
			page = getObj("page", tok.get('pageid'));
			if (page){ break; }
		    }
		}
	    }
	    else{
		page = getObj("page", Campaign().get('playerpageid'));
	    }
	    if (!page){
		err = "Error: Unable to determine page to unlink";
		break;
	    }
	    var n = state.TurnTable.groups[page.id].length;
	    err = TurnTable.unlinkPages(page);
	    if (!err){
		TurnTable.write("Unlinked " + n + " pages.", msg.who, "", "TT");
	    }
	    break;
	case "sync":
	    if (posArgs.length > 1){
		TurnTable.write("Error: Unrecognized argument: " + posArgs[1], msg.who, "", "TT");
		return TurnTable.showHelp(msg.who, tokens[0], tokens[1]);
	    }
	    var page;
	    if (posArgs.length > 0){
		args['page'] = posArgs[0];
	    }
	    if (args['page']){
		page = TurnTable.getPage(args['page']);
		if (typeof(page) == typeof("")){
		    err = page;
		    break;
		}
		if (!page){
		    err = "Error: Unable to locate page " + args['page'];
		    break;
		}
	    }
	    else if (msg.selected){
		for (var i = 0; i < msg.selected.length; i++){
		    var tok = getObj(msg.selected[i]._type, msg.selected[i]._id);
		    if (tok){
			page = getObj("page", tok.get('pageid'));
			if (page){ break; }
		    }
		}
	    }
	    else{
		page = getObj("page", Campaign().get('playerpageid'));
	    }
	    if (!page){
		err = "Error: Unable to determine master page";
		break;
	    }
	    err = TurnTable.syncPages(page);
	    if (!err){
		TurnTable.write("Synched " + state.TurnTable.groups[page.id].length + " pages.", msg.who, "", "TT");
	    }
	    else if (typeof(err) == typeof({})){
/////
//
		//warn about missing objects
		TurnTable.write("Warning: Some objects couldn't be synched.", msg.who, "", "TT");
//
/////
	    }
	    break;
	default:
	    TurnTable.write("Error: Unrecognized command: " + tokens[1], msg.who, "", "TT");
	    return TurnTable.showHelp(msg.who, tokens[0], null);
	}
	if (typeof(err) == typeof("")){
	    TurnTable.write(err, msg.who, "", "TT");
	}
    },

    handleChatMessage: function(msg){
	if ((msg.type != "api") || (msg.content.indexOf("!turntable") !=0 )){ return; }

	return TurnTable.handleTurnTableMessage(msg.content.split(" "), msg);
    },

    registerTurnTable: function(){
	TurnTable.init();
	if ((typeof(Shell) != "undefined") && (Shell) && (Shell.registerCommand)){
	    Shell.registerCommand("!turntable", "!turntable <subcommand> [args]", "Manage rotated copies of a page", TurnTable.handleTurnTableMessage);
	    if (Shell.write){
		TurnTable.write = Shell.write;
	    }
	}
	else{
	    on("chat:message", TurnTable.handleChatMessage);
	}
	on("add:path", TurnTable.handleObjCreate);
	on("add:text", TurnTable.handleObjCreate);
	on("add:graphic", TurnTable.handleObjCreate);
	on("change:path", TurnTable.handleObjChange);
	on("change:text", TurnTable.handleObjChange);
	on("change:graphic", TurnTable.handleObjChange);
	on("destroy:path", TurnTable.handleObjDelete);
	on("destroy:text", TurnTable.handleObjDelete);
	on("destroy:graphic", TurnTable.handleObjDelete);
    }
};

on("ready", function(){ TurnTable.registerTurnTable(); });
