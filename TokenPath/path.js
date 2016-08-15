var TokenPath = TokenPath || {
    PIP_IMAGE: "https://s3.amazonaws.com/files.d20.io/images/9817292/f_tAiMi01sv2nba2Uuakig/thumb.png?1432944100",
    PIP_SIZE: 30,
    START_TINT: "#80ffff",
    WAYPOINT_TINT: "#8080ff",
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

    ignoreRemoval: {},

    init: function(){
	if (!state.hasOwnProperty('TokenPath')){ state.TokenPath = {}; }
	if (!state.TokenPath.hasOwnProperty('pips')){ state.TokenPath.pips = []; }
	if (!state.TokenPath.hasOwnProperty('waypoints')){ state.TokenPath.waypoints = []; }
    },

    getControlledBy: function(tok){
	var retval = tok.get('controlledby');
	var chr = getObj("character", tok.get('represents'));
	if (chr){
	    retval = chr.get('controlledby');
	}
	return retval;
    },

    removeToken: function(tok){
	TokenPath.ignoreRemoval[tok.id] = true;
	tok.remove();
    },

    clearPath: function(){
	state.TokenPath.waypoints = [];
	while (state.TokenPath.pips.length > 0){
	    var pip = state.TokenPath.pips.pop();
	    if (pip.token){
		var tok = getObj("graphic", pip.token);
		if (tok){ TokenPath.removeToken(tok); }
	    }
	}
    },

    initPath: function(x, y){
	state.TokenPath.pips.push({'x': x, 'y': y, 'distance': 0, 'round': 0});
    },

    handleTurnChange: function(newTurnOrder, oldTurnOrder){
	var newTurns = JSON.parse((typeof(newTurnOrder) == typeof("") ? newTurnOrder : newTurnOrder.get('turnorder') || "[]"));
	var oldTurns = JSON.parse((typeof(oldTurnOrder) == typeof("") ? oldTurnOrder : oldTurnOrder.turnorder || "[]"));

	if ((!newTurns) || (!newTurns.length)){ return; } // nothing in tracker
	if ((oldTurns) && (oldTurns.length) && (newTurns[0].id == oldTurns[0].id)){ return; } // turn didn't change

	// remove existing path
	TokenPath.clearPath();

	// start new path if current turn is for a valid token
	var tok = getObj("graphic", newTurns[0].id);
	if (!tok){ return; }
	TokenPath.initPath(tok.get('left'), tok.get('top'));
    },

    drawPip: function(pip, pageId, layer, controlledBy, isStart){
	var tokArgs = {'_subtype':		"token",
			'_pageid':		pageId,
			'imgsrc':		TokenPath.PIP_IMAGE,
			'left':			pip.x,
			'top':			pip.y,
			'width':		TokenPath.PIP_SIZE,
			'height':		TokenPath.PIP_SIZE,
			'layer':		layer,
			'name':			"" + (Math.round(pip.distance * 10) / 10),
			'controlledby':		controlledBy,
			'showname':		true,
			'showplayers_name':	true};

	if (isStart){
	    tokArgs['tint_color'] = TokenPath.START_TINT;
	}

	var pipTok = createObj("graphic", tokArgs);
	pip.token = pipTok.id;
	toFront(pipTok);
    },

    drawPath: function(src, dest, grid, diag, scale, pageId, layer, controlledBy){
	// draw a path from pip src to d, excluding src; return array of pips, adding pip token for all but dest
	var retval = [];

	var gridWidth = 1, gridHeight = 1;

	if (grid in TokenPath.GRID_DIMS){
	    gridWidth = TokenPath.GRID_DIMS[grid]['width'];
	    gridHeight = TokenPath.GRID_DIMS[grid]['height'];
	}

	var xOff = dest.x - src.x, yOff = dest.y - src.y;
	if (xOff % gridWidth){ xOff = Math.round(xOff / gridWidth) * gridWidth; }
	if (yOff % gridHeight){ yOff = Math.round(yOff / gridHeight) * gridHeight; }

	if (grid){
	    var pip = src;
	    while ((Math.abs(xOff) >= gridWidth / 10) || (Math.abs(yOff) >= gridHeight / 10)){
		var xDir = (xOff ? xOff / Math.abs(xOff) : 0), yDir = (yOff ? yOff / Math.abs(yOff) : 0);
		var xStep = xDir * gridWidth, yStep = yDir * gridHeight;
		if (grid == "hex"){
		    if (yStep == 0){ xStep *= 2; }
		    if (xStep == 0){ xStep = gridWidth; }
		}
		if (grid == "hexr"){
		    if (xStep == 0){ yStep *= 2; }
		    if (yStep == 0){ yStep = gridHeight; }
		}
		if (retval.length > 0){
		    // draw previous pip
		    TokenPath.drawPip(pip, pageId, layer, controlledBy, false);
		}
		var distance = pip.distance, round = pip.round;
		if ((grid != "square") || (xStep == 0) || (yStep == 0) || (diag == "foure")){ distance += scale; }
		else if (diag == "manhattan"){ distance += 2 * scale; }
		else if (diag == "threefive"){
		    distance += scale * (1 + round);
		    round = 1 - round;
		}
		else{ distance += Math.sqrt(2) * scale; }
		pip = {'x':		pip.x + xStep,
			'y':		pip.y + yStep,
			'distance':	distance,
			'round':	round};
		retval.push(pip);
		xOff -= xStep;
		yOff -= yStep;
	    }
	    if (retval.length > 0){
		retval[retval.length - 1].x = dest.x;
		retval[retval.length - 1].y = dest.y;
	    }
	}
	else{
	    var gridSize = TokenPath.GRID_DIMS['square']['width'];
	    var totDistOff = Math.sqrt(xOff * xOff + yOff * yOff), distOff;
	    if (totDistOff >= gridSize / 2){
		if (scale == 0){ distOff = gridSize; }
		else{
		    distOff = (scale - (src.distance % scale)) / scale;
		    if (distOff < 0.5){ distOff += 1; }
		    distOff *= gridSize;
		}
		var pip = src;
		while (distOff <= totDistOff - (gridSize / 2)){
		    var offFract = distOff / totDistOff;
		    var xStep = xOff * offFract, yStep = yOff * offFract;
		    if (retval.length > 0){
			// draw previous pip
			TokenPath.drawPip(pip, pageId, layer, controlledBy, false);
		    }
		    pip = {'x':		src.x + xStep,
			    'y':	src.y + yStep,
			    'distance':	src.distance + (distOff * scale / gridSize),
			    'round':	0};
		    retval.push(pip);
		    distOff += gridSize;
		}
	    }
	    // add endpoint pip
	    if (retval.length > 0){
		// draw previous pip
		TokenPath.drawPip(pip, pageId, layer, controlledBy, false);
	    }
	    pip = {'x':		dest.x,
		    'y':		dest.y,
		    'distance':	src.distance + (totDistOff * scale / gridSize),
		    'round':	0};
	    retval.push(pip);
	}

	return retval;
    },

    updatePath: function(pathStart, pathEnd, wp, grid, diag, scale, pageId, layer, controlledBy){
	// remove old pips between pathStart and pathEnd (leaving endpoints in place)
	for (var i = pathStart + 1; i < pathEnd; i++){
	    if (!state.TokenPath.pips[i].token){ continue; }
	    var pipTok = getObj("graphic", state.TokenPath.pips[i].token);
	    if (pipTok){ TokenPath.removeToken(pipTok); }
	    delete state.TokenPath.pips[i].token;
	}

	// draw a new path from pathStart to pathEnd
	var newPath = TokenPath.drawPath(state.TokenPath.pips[pathStart], state.TokenPath.pips[pathEnd],
					    grid, diag, scale, pageId, layer, controlledBy);

	// update pathEnd
	newPath[newPath.length - 1].token = state.TokenPath.pips[pathEnd].token;
	var pipTok = getObj("graphic", newPath[newPath.length - 1].token);
	pipTok.set({'name': "" + (Math.round(newPath[newPath.length - 1].distance * 10) / 10)})

	// splice in new path
	var oldLen = pathEnd - pathStart, newLen = newPath.length, dLen = newLen - oldLen;
	newPath.unshift(oldLen);
	newPath.unshift(pathStart + 1);
	state.TokenPath.pips.splice.apply(state.TokenPath.pips, newPath);

	// update waypoints based on the length difference between the old and new paths
	for (var i = wp; i < state.TokenPath.waypoints.length; i++){
	    state.TokenPath.waypoints[i] += dLen;
	}
	return pathEnd + dLen;
    },

    handleTokenMove: function(tok, prev){
	var page = getObj("page", tok.get('pageid'));
	var grid = (page.get('showgrid') ? page.get('grid_type') : null);
	var diag = page.get('diagonaltype'), scale = page.get('scale_number');

	// check if tok is a pip token
	var pipIdx;
	for (pipIdx = 0; pipIdx < state.TokenPath.pips.length; pipIdx++){
	    if (state.TokenPath.pips[pipIdx].token == tok.id){ break; }
	}
	if (pipIdx < state.TokenPath.pips.length){
	    // tok is a pip token
	    if (grid == "square"){
		// square grid snaps to top-left instead of center; fix that
		var gridSize = TokenPath.GRID_DIMS['square']['width'];
		var xOff = tok.get('left') % gridSize, yOff = tok.get('top') % gridSize;
		var expXOff = state.TokenPath.pips[0].x % gridSize, expYOff = state.TokenPath.pips[0].y % gridSize;
		if ((xOff != expXOff) || (yOff != expYOff)){
		    tok.set({'left': tok.get('left') + expXOff - xOff, 'top': tok.get('top') + expYOff - yOff});
		}
	    }
	    // if pip didn't actually move, we don't need to do anything
	    if ((tok.get('left') == prev['left']) && (tok.get('right') == prev['right'])){ return; }
	    // determine if pip was waypoint; we'll use this later, and might change pipIdx below
	    var wpIdx, isWp = false;
	    for (wpIdx = 0; wpIdx < state.TokenPath.waypoints.length; wpIdx++){
		if (state.TokenPath.waypoints[wpIdx] == pipIdx){ isWp = true; }
		if (state.TokenPath.waypoints[wpIdx] >= pipIdx){ break; }
	    }
	    if (pipIdx == 0){
		// tok was start point; create a new start point and insert it before tok
		var startPip = {'x':		state.TokenPath.pips[0].x,
				'y':		state.TokenPath.pips[0].y,
				'distance':	0,
				'round':	0};
		TokenPath.drawPip(startPip, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok), true);
		state.TokenPath.pips.unshift(startPip);
		for (var i = 0; i < state.TokenPath.waypoints.length; i++){
		    state.TokenPath.waypoints[i] += 1;
		}
		pipIdx = 1;
	    }
	    if (pipIdx == state.TokenPath.pips.length - 1){
		// tok was end point; create a new end point and append it to end of path
		var endPip = {'x':		state.TokenPath.pips[pipIdx].x,
				'y':		state.TokenPath.pips[pipIdx].y,
				'distance':	state.TokenPath.pips[pipIdx].distance,
				'round':	state.TokenPath.pips[pipIdx].round};
		TokenPath.drawPip(endPip, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok), false);
		state.TokenPath.pips.push(endPip);
	    }
	    state.TokenPath.pips[pipIdx].x = tok.get('left');
	    state.TokenPath.pips[pipIdx].y = tok.get('top');
	    var pathStart, pathEnd, newEnd;
	    if (isWp){
		// tok was already a waypoint; update paths into and out of it
		pathStart = (wpIdx > 0 ? state.TokenPath.waypoints[wpIdx - 1] : 0);
		pathEnd = pipIdx;
		newEnd = TokenPath.updatePath(pathStart, pathEnd, wpIdx, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
		pathStart = newEnd;
		pathEnd = (wpIdx + 1 < state.TokenPath.waypoints.length ? state.TokenPath.waypoints[wpIdx + 1] : state.TokenPath.pips.length - 1);
		newEnd = TokenPath.updatePath(pathStart, pathEnd, wpIdx + 1, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
	    }
	    else{
		// tok was not a waypoint; upgrade it to one and split path it was on into one in and one out of it
		pathStart = (wpIdx > 0 ? state.TokenPath.waypoints[wpIdx - 1] : 0);
		pathEnd = pipIdx;
		newEnd = TokenPath.updatePath(pathStart, pathEnd, wpIdx, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
		state.TokenPath.waypoints.splice(wpIdx, 0, newEnd);
		tok.set({'tint_color': TokenPath.WAYPOINT_TINT});
		pathStart = newEnd;
		pathEnd = (wpIdx + 1 < state.TokenPath.waypoints.length ? state.TokenPath.waypoints[wpIdx + 1] : state.TokenPath.pips.length - 1);
		newEnd = TokenPath.updatePath(pathStart, pathEnd, wpIdx + 1, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
	    }
	    // fix up rest of path
	    if (grid){
		var allPips = state.TokenPath.pips;
		var distance = allPips[newEnd].distance, round = allPips[newEnd].round;
		for (var i = newEnd + 1; i < allPips.length; i++){
		    if ((grid != "square") || (allPips[i].x == allPips[i - 1].x) || (allPips[i].y == allPips[i - 1].y) || diag == "foure"){ distance += scale; }
		    else if (diag == "manhattan"){ distance += 2 * scale; }
		    else if (diag == "threefive"){
			distance += scale * (1 + round);
			round = 1 - round;
		    }
		    else{ distance += Math.sqrt(2) * scale; }
		    allPips[i].distance = distance;
		    allPips[i].round = round;
		    if (allPips[i].token){
			var pipTok = getObj("graphic", allPips[i].token);
			if (pipTok){
			    pipTok.set({'name': "" + (Math.round(distance * 10) / 10)});
			}
		    }
		}
	    }
	    else{
		// must recompute remaining pips so they stay on multiples of scale
		for (wpIdx += 1; wpIdx < state.TokenPath.waypoints.length; wpIdx += 1){
		    pathStart = newEnd;
		    pathEnd = (wpIdx + 1 < state.TokenPath.waypoints.length ? state.TokenPath.waypoints[wpIdx + 1] : state.TokenPath.pips.length - 1);
		    newEnd = TokenPath.updatePath(pathStart, pathEnd, wpIdx + 1, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
		}
	    }
	    return;
	}

	// tok isn't a pip; see if it's a character token
	var turnOrder = JSON.parse(Campaign().get('turnorder') || "[]");
	if ((!turnOrder) || (!turnOrder.length) || (tok.id != turnOrder[0].id)){
	    // it isn't tok's turn; ignore its movement
	    return;
	}
	if (!Campaign().get('initiativepage')){
	    TokenPath.clearPath();
	    return;
	}

	// if we get here, tok is at the top of the turn order; track its movement
	if (state.TokenPath.pips.length <= 0){
	    // path not initialized yet; do so
	    TokenPath.initPath(prev['left'], prev['top']);
	}
	if (!state.TokenPath.pips[0].token){
	    // initial pip not created yet; do so
	    TokenPath.drawPip(state.TokenPath.pips[0], tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok), true);
	}

	// delete last segment of path
	var lastGoodPip = (state.TokenPath.waypoints.length > 0 ? state.TokenPath.waypoints[state.TokenPath.waypoints.length - 1] : 0);
	while (state.TokenPath.pips.length > lastGoodPip + 1){
	    var pip = state.TokenPath.pips.pop();
	    if (pip.token){
		var pipTok = getObj("graphic", pip.token);
		if (pipTok){ TokenPath.removeToken(pipTok); }
	    }
	}

	// generate new path from last good pip to tok's current position
	var newPips = TokenPath.drawPath(state.TokenPath.pips[lastGoodPip], {'x': tok.get('left'), 'y': tok.get('top')},
					    grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
	if (newPips.length > 0){
	    var lastPip = newPips[newPips.length - 1];
	    TokenPath.drawPip(lastPip, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok), false);
	    for (var i = 0; i < newPips.length; i++){ state.TokenPath.pips.push(newPips[i]); }
	}
    },

    handleTokenDelete: function(tok){
	if (TokenPath.ignoreRemoval[tok.id]){
	    delete TokenPath.ignoreRemoval[tok.id];
	    return;
	}

	var idx;

	for (idx = 0; idx < state.TokenPath.waypoints.length; idx++){
	    if (state.TokenPath.pips[state.TokenPath.waypoints[idx]].token == tok.id){ break; }
	}
	if (idx < state.TokenPath.waypoints.length){
	    // tok was a waypoint; delete waypoint and recompute path
	    state.TokenPath.waypoints.splice(idx, 1);
	    var page = getObj("page", tok.get('pageid'));
	    var grid = (page.get('showgrid') ? page.get('grid_type') : null);
	    var diag = page.get('diagonaltype'), scale = page.get('scale_number');
	    var pathStart = (idx > 0 ? state.TokenPath.waypoints[idx - 1] : 0);
	    var pathEnd = (idx < state.TokenPath.waypoints.length ? state.TokenPath.waypoints[idx] : state.TokenPath.pips.length - 1);
	    var newEnd = TokenPath.updatePath(pathStart, pathEnd, idx, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
	    // fix up rest of path
	    if (grid){
		var allPips = state.TokenPath.pips;
		var distance = allPips[newEnd].distance, round = allPips[newEnd].round;
		for (var i = newEnd + 1; i < allPips.length; i++){
		    if ((grid != "square") || (allPips[i].x == allPips[i - 1].x) || (allPips[i].y == allPips[i - 1].y) || diag == "foure"){ distance += scale; }
		    else if (diag == "manhattan"){ distance += 2 * scale; }
		    else if (diag == "threefive"){
			distance += scale * (1 + round);
			round = 1 - round;
		    }
		    else{ distance += Math.sqrt(2) * scale; }
		    allPips[i].distance = distance;
		    allPips[i].round = round;
		    if (allPips[i].token){
			var pipTok = getObj("graphic", allPips[i].token);
			if (pipTok){
			    pipTok.set({'name': "" + (Math.round(distance * 10) / 10)});
			}
		    }
		}
	    }
	    else{
		// must recompute remaining pips so they stay on multiples of scale
		for (; idx < state.TokenPath.waypoints.length; idx += 1){
		    pathStart = newEnd;
		    pathEnd = (idx + 1 < state.TokenPath.waypoints.length ? state.TokenPath.waypoints[idx + 1] : state.TokenPath.pips.length - 1);
		    newEnd = TokenPath.updatePath(pathStart, pathEnd, idx + 1, grid, diag, scale, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok));
		}
	    }
	    return;
	}

	for (idx = 0; idx < state.TokenPath.pips.length; idx++){
	    if (state.TokenPath.pips[idx].token == tok.id){ break; }
	}
	if (idx < state.TokenPath.pips.length){
	    // tok was a non-waypoint pip; replace pip
	    var pip = state.TokenPath.pips[idx];
	    TokenPath.drawPip(pip, tok.get('pageid'), tok.get('layer'), TokenPath.getControlledBy(tok), (idx == 0));
	}
    },

    registerTokenPath: function(){
	TokenPath.init();
	on("change:campaign:turnorder", TokenPath.handleTurnChange);
	on("change:graphic", TokenPath.handleTokenMove); //maybe change:graphic:left and change:graphic:top
	on("destroy:graphic", TokenPath.handleTokenDelete);
    }
};

on("ready", function(){ TokenPath.registerTokenPath(); });
